import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const io = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: io.client }))
import { deleteItem, moveItem } from '@/lib/data/products-admin'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const productA = uuid(1), productB = uuid(2), productC = uuid(3)
const moduleA = uuid(11), moduleB = uuid(12), moduleC = uuid(13), secondModuleA = uuid(14)
const itemA = uuid(21), itemA2 = uuid(22), itemA3 = uuid(23), itemB = uuid(24), itemC = uuid(25)
const missing = uuid(99)
const db = new PGlite()

// Only the network boundary is replaced: both RPCs and legacy query chains run
// real SQL, so removing a scope predicate can mutate the fixture and fail tests.
function client() {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      const params = Object.entries(args)
      try {
        await db.query(`select public.${name}(${params.map(([key], i) => `${key} => $${i + 1}`).join(',')})`, params.map(([, value]) => value))
        return { error: null }
      } catch (error) { return { error } }
    },
    from: (table: string) => {
      if (table !== 'items') throw new Error(`Unexpected table: ${table}`)
      let command = 'select id from public.items'
      const params: unknown[] = [], filters: string[] = [], orders: string[] = []
      const query = {
        select: () => query,
        delete: () => { command = 'delete from public.items'; return query },
        update: (row: { sort_order: number }) => { params.push(row.sort_order); command = 'update public.items set sort_order = $1'; return query },
        eq: (key: string, value: unknown) => { params.push(value); filters.push(`${key} = $${params.length}`); return query },
        order: (key: string) => { orders.push(key); return query },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => db.query(
          `${command}${filters.length ? ` where ${filters.join(' and ')}` : ''}${orders.length ? ` order by ${orders.join(',')}` : ''}`, params,
        ).then(result => resolve({ data: result.rows, error: null }), reject),
      }
      return query
    },
  }
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.products(id uuid primary key, store_id uuid not null);
    create table public.modules(id uuid primary key, product_id uuid not null references public.products(id));
    create table public.items(id uuid primary key, module_id uuid not null references public.modules(id), sort_order integer not null, created_at timestamptz not null default '2026-01-01', updated_at timestamptz not null default '2026-01-01');
    insert into public.products values ('${productA}','${uuid(101)}'),('${productB}','${uuid(101)}'),('${productC}','${uuid(102)}');
    insert into public.modules values ('${moduleA}','${productA}'),('${secondModuleA}','${productA}'),('${moduleB}','${productB}'),('${moduleC}','${productC}');
    grant usage on schema public to service_role;
    grant all on public.products, public.modules, public.items to service_role;
  `)
  const migration = new URL('../../supabase/migrations/20260926000000_scope_item_mutations.sql', import.meta.url)
  await db.exec(readFileSync(migration, 'utf8'))
})
afterAll(async () => { await db.close() })
beforeEach(async () => {
  await db.exec(`truncate public.items;
    insert into public.items(id,module_id,sort_order) values
      ('${itemA}','${moduleA}',10),('${itemA2}','${moduleA}',20),('${itemA3}','${moduleA}',30),
      ('${itemB}','${moduleB}',10),('${itemC}','${moduleC}',10);`)
  io.client.mockImplementation(client)
})

const snapshot = async () => (await db.query<{ id: string; module_id: string; sort_order: number; created_at: string; updated_at: string }>('select * from public.items order by id')).rows
const ordered = async () => (await db.query<{ id: string }>('select id from public.items where module_id=$1 order by sort_order,created_at,id', [moduleA])).rows.map(row => row.id)

describe('mutações de material vinculadas ao produto autorizado', () => {
  it.each([['mesma loja', itemB], ['outra loja', itemC], ['ausente', missing]])('recusa excluir item de %s sem mutação', async (_label, item) => {
    const before = await snapshot()
    await expect(deleteItem(item, productA)).rejects.toThrow('Item inválido para este produto.')
    expect(await snapshot()).toEqual(before)
  })

  it.each([
    ['mesma loja', itemB, moduleB, productA],
    ['outra loja', itemC, moduleC, productA],
    ['módulo incorreto no mesmo produto', itemA, secondModuleA, productA],
    ['item fora do módulo válido', itemB, moduleA, productA],
    ['item ausente', missing, moduleA, productA],
    ['módulo ausente', itemA, missing, productA],
    ['produto ausente', itemA, moduleA, missing],
  ])('recusa mover: %s, preservando todos os itens', async (_label, item, module, product) => {
    const before = await snapshot()
    await expect(moveItem(item, module, product, 'up')).rejects.toThrow(/inválido para este produto/)
    expect(await snapshot()).toEqual(before)
  })

  it('exclui somente o item vinculado ao produto validado', async () => {
    const before = await snapshot()
    await deleteItem(itemA, productA)
    expect(await snapshot()).toEqual(before.filter(row => row.id !== itemA))
    await expect(deleteItem(itemA, productA)).rejects.toThrow('Item inválido para este produto.')
  })

  it('move nas duas direções mantendo outros produtos intactos', async () => {
    const others = (await snapshot()).filter(row => row.module_id !== moduleA)
    await moveItem(itemA2, moduleA, productA, 'up')
    expect(await ordered()).toEqual([itemA2, itemA, itemA3])
    await moveItem(itemA2, moduleA, productA, 'down')
    expect(await ordered()).toEqual([itemA, itemA2, itemA3])
    expect((await snapshot()).filter(row => row.module_id !== moduleA)).toEqual(others)
  })

  it('primeiro para cima e último para baixo não alteram registros', async () => {
    const before = await snapshot()
    await moveItem(itemA, moduleA, productA, 'up')
    await moveItem(itemA3, moduleA, productA, 'down')
    expect(await snapshot()).toEqual(before)
  })

  it('desfaz toda a reordenação quando a escrita falha', async () => {
    const before = await snapshot()
    await db.exec(`create function public.reject_item_update() returns trigger language plpgsql as $$ begin if new.id='${itemA2}' then raise exception 'write failed'; end if; return new; end; $$;
      create trigger reject_item_update before update on public.items for each row execute function public.reject_item_update();`)
    try {
      await expect(moveItem(itemA2, moduleA, productA, 'up')).rejects.toThrow('write failed')
      expect(await snapshot()).toEqual(before)
    } finally { await db.exec('drop trigger reject_item_update on public.items; drop function public.reject_item_update();') }
  })

  it('nega execução pública e permite apenas service_role', async () => {
    for (const signature of ['delete_item_scoped_atomic(uuid,uuid)', 'move_item_scoped_atomic(uuid,uuid,uuid,text)']) {
      expect((await db.query(`select has_function_privilege('anon',$1,'execute') a, has_function_privilege('authenticated',$1,'execute') u, has_function_privilege('service_role',$1,'execute') s`, [`public.${signature}`])).rows)
        .toEqual([{ a: false, u: false, s: true }])
    }
    await db.exec('set role service_role')
    try { await deleteItem(itemA, productA) } finally { await db.exec('reset role') }
    expect(await ordered()).toEqual([itemA2, itemA3])
  })
})
