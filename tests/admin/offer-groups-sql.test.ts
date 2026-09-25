import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const store = '00000000-0000-4000-8000-000000000001'
const otherStore = '00000000-0000-4000-8000-000000000002'
const product = '00000000-0000-4000-8000-000000000101'
const otherProduct = '00000000-0000-4000-8000-000000000102'
const basicId = '00000000-0000-4000-8000-000000000201'
const completeId = '00000000-0000-4000-8000-000000000202'
const basic = { id: basicId, name: 'Básico', payt_product_code: 'BASIC', grants: [{ product_id: product, grant_level: 'basic' }] }
const complete = { id: completeId, name: 'Completo', payt_product_code: 'COMPLETE', grants: [{ product_id: product, grant_level: 'complete' }] }
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })
const sql = (file: string) => readFileSync(new URL(`../../supabase/migrations/${file}.sql`, import.meta.url), 'utf8')
async function setup() {
  const db = new PGlite()
  dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
    create table stores (id uuid primary key);
    create table products (id uuid primary key, store_id uuid references stores(id), title text);
    create table modules (id uuid primary key);
    create table offers (id uuid primary key default gen_random_uuid(), store_id uuid references stores(id), name text not null, payt_product_code text unique not null);
    create table offer_products (offer_id uuid references offers(id) on delete cascade, product_id uuid references products(id), primary key(offer_id, product_id));
    create table orders (payt_product_code text, status text, store_id uuid, is_test boolean);
    insert into stores values ('${store}'), ('${otherStore}');
    insert into products values ('${product}', '${store}', 'Atlas'), ('${otherProduct}', '${otherStore}', 'Outra loja');
    insert into offers values ('${basicId}', '${store}', 'Atlas — Básico', 'BASIC'), ('${completeId}', '${store}', 'Atlas — Completo', 'COMPLETE');
    insert into offer_products values ('${basicId}', '${product}'), ('${completeId}', '${product}');
  `)
  await db.exec(sql('20260924010000_product_access_levels'))
  await db.query('update offer_products set grant_level=$1 where offer_id=$2', ['basic', basicId])
  await db.exec(sql('20260924030000_delete_offer'))
  await db.exec(sql('20260925030000_offer_groups'))
  return db
}
async function group(db: PGlite) {
  return (await db.query<{ id: string; name: string; version: number }>('select * from offer_groups where store_id=$1', [store])).rows[0]
}
async function save(db: PGlite, plans: unknown[], opts: { id?: string | null; storeId?: string; version?: number; name?: string } = {}) {
  const g = await group(db)
  return db.query('select save_offer_group_atomic($1,$2,$3,$4,$5::jsonb) as id', [opts.id === undefined ? g.id : opts.id, opts.storeId ?? store, opts.name ?? 'Atlas', opts.version ?? g.version, JSON.stringify(plans)])
}

describe('oferta com planos — banco real', () => {
  it('agrupa versões preservando UUIDs, códigos e liberações que as compras resolvem', async () => {
    const db = await setup()
    expect((await db.query('select name, version from offer_groups')).rows).toEqual([{ name: 'Atlas', version: 1 }])
    expect((await db.query('select id, payt_product_code from offers order by id')).rows).toEqual([{ id: basicId, payt_product_code: 'BASIC' }, { id: completeId, payt_product_code: 'COMPLETE' }])
    await save(db, [basic, complete, { ...complete, id: null, name: 'Upgrade', payt_product_code: 'UPGRADE' }])
    expect((await db.query('select o.payt_product_code as code, p.grant_level as level from offers o join offer_products p on p.offer_id=o.id order by code')).rows).toEqual([
      { code: 'BASIC', level: 'basic' }, { code: 'COMPLETE', level: 'complete' }, { code: 'UPGRADE', level: 'complete' },
    ])
    expect((await group(db)).version).toBeGreaterThan(1)
  })
  it('cria grupo com combo e níveis independentes por produto', async () => {
    const db = await setup()
    await db.query('update products set store_id=$1 where id=$2', [store, otherProduct])
    await save(db, [{ ...basic, id: null, payt_product_code: 'COMBO', grants: [...basic.grants, { product_id: otherProduct, grant_level: 'complete' }] }], { id: null, name: 'Combo' })
    expect((await db.query("select grant_level from offer_products join offers on offers.id=offer_id where payt_product_code='COMBO' order by product_id")).rows).toEqual([{ grant_level: 'basic' }, { grant_level: 'complete' }])
  })
  it('recusa código duplicado no envio e em outra oferta com rollback integral', async () => {
    const db = await setup()
    await expect(save(db, [basic, { ...complete, id: null, payt_product_code: 'BASIC' }], { name: 'Alterado' })).rejects.toThrow(/código/i)
    await expect(save(db, [{ ...basic, id: null }], { id: null, name: 'Nova' })).rejects.toThrow()
    expect((await group(db)).name).toBe('Atlas')
    expect((await db.query('select * from offer_groups')).rows).toHaveLength(1)
    expect((await db.query('select * from offers')).rows).toHaveLength(2)
  })
  it('recusa código alterado e plano de outro grupo, mesmo dentro da mesma loja', async () => {
    const db = await setup()
    await expect(save(db, [{ ...basic, payt_product_code: 'MUDOU' }, complete])).rejects.toThrow(/código/i)
    await expect(save(db, [basic], { id: null })).rejects.toThrow(/plano/i)
    await expect(save(db, [basic, complete], { storeId: otherStore })).rejects.toThrow(/loja/i)
    await expect(save(db, [{ ...basic, grants: [{ product_id: otherProduct, grant_level: 'basic' }] }, complete])).rejects.toThrow(/loja/i)
    expect((await group(db)).version).toBe(1)
  })
  it.each([[], [{ ...basic, grants: [] }], [{ ...basic, grants: [{ product_id: product }] }], [{ ...basic, grants: [{ product_id: product, grant_level: 'vip' }] }], [{ ...basic, name: '' }], [{ ...basic, payt_product_code: 'A B' }]].map(plans => ({ plans })))('recusa conteúdo incompleto ou inválido: $plans', async ({ plans }) => {
    const db = await setup()
    await expect(save(db, plans as unknown[])).rejects.toThrow()
    expect((await group(db)).version).toBe(1)
    expect((await db.query('select * from offers')).rows).toHaveLength(2)
  })
  it('recusa formulário desatualizado sem remover plano recém-criado', async () => {
    const db = await setup()
    await save(db, [basic, complete, { ...complete, id: null, payt_product_code: 'UPGRADE' }])
    await expect(save(db, [basic, complete], { version: 1 })).rejects.toThrow(/alterada/i)
    expect((await db.query('select * from offers')).rows).toHaveLength(3)
  })
  it('invalida aba aberta quando a tela antiga altera um plano ou sua liberação', async () => {
    const db = await setup()
    const opened = await group(db)
    await db.query('select save_offer_levels_atomic($1,$2,$3,$4,$5::jsonb)', [completeId, store, 'Atualizado na tela antiga', 'COMPLETE', JSON.stringify(basic.grants)])
    await expect(save(db, [basic, complete], { version: opened.version })).rejects.toThrow(/alterada/i)
    expect((await db.query('select grant_level from offer_products where offer_id=$1', [completeId])).rows).toEqual([{ grant_level: 'basic' }])
  })
  it('invalida aba aberta após exclusão legada e alteração direta de liberações', async () => {
    const db = await setup()
    const opened = await group(db)
    await db.query('update offer_products set grant_level=$1 where offer_id=$2', ['complete', basicId])
    expect((await group(db)).version).toBeGreaterThan(opened.version)
    const beforeDelete = await group(db)
    await db.query('select delete_offer_atomic($1,$2,$3)', [completeId, store, 'Atlas — Completo'])
    expect((await group(db)).version).toBeGreaterThan(beforeDelete.version)
    await expect(save(db, [basic], { version: beforeDelete.version })).rejects.toThrow(/alterada/i)
  })
  it.each(['pago', 'pendente', 'cancelado', 'reembolsado', 'chargeback'])('bloqueia remoção de plano com pedido %s e desfaz outras edições', async status => {
    const db = await setup()
    await db.query('insert into orders values ($1,$2,null,true)', ['COMPLETE', status])
    await expect(save(db, [{ ...basic, grants: [{ product_id: product, grant_level: 'complete' }] }], { name: 'Editado' })).rejects.toThrow(/pedidos/i)
    expect((await db.query('select grant_level from offer_products where offer_id=$1', [basicId])).rows).toEqual([{ grant_level: 'basic' }])
    expect((await group(db)).name).toBe('Atlas')
    const g = await group(db)
    await expect(db.query('select delete_offer_group_atomic($1,$2,$3)', [g.id, store, 'Atlas'])).rejects.toThrow(/pedidos/i)
    expect((await db.query('select * from offers')).rows).toHaveLength(2)
  })
  it('remove planos sem pedidos e exclui grupo com confirmação sem apagar produtos', async () => {
    const db = await setup()
    await save(db, [basic])
    expect((await db.query('select id from offers')).rows).toEqual([{ id: basicId }])
    const g = await group(db)
    await expect(db.query('select delete_offer_group_atomic($1,$2,$3)', [g.id, store, 'errado'])).rejects.toThrow(/nome/i)
    await db.query('select delete_offer_group_atomic($1,$2,$3)', [g.id, store, 'Atlas'])
    expect((await db.query('select * from offer_groups')).rows).toHaveLength(0)
    expect((await db.query('select * from offers')).rows).toHaveLength(0)
    expect((await db.query('select * from products')).rows).toHaveLength(2)
  })
  it('mantém INSERT legado compatível e impede vínculo direto com grupo de outra loja', async () => {
    const db = await setup()
    await db.query('select save_offer_levels_atomic(null,$1,$2,$3,$4::jsonb)', [store, 'Legada', 'LEGACY', JSON.stringify(basic.grants)])
    expect((await db.query("select group_id from offers where payt_product_code='LEGACY'")).rows[0]).toMatchObject({ group_id: expect.any(String) })
    const g = await group(db)
    await expect(db.query('insert into offers(store_id,name,payt_product_code,group_id) values ($1,$2,$3,$4)', [otherStore, 'Outra', 'OTHER', g.id])).rejects.toThrow()
  })
  it('somente service_role pode executar salvamento e exclusão; tabela possui RLS', async () => {
    const db = await setup()
    for (const fn of ['save_offer_group_atomic(uuid,uuid,text,integer,jsonb)', 'delete_offer_group_atomic(uuid,uuid,text)']) {
      const result = await db.query('select rolname as role, has_function_privilege(rolname,$1,\'execute\') as allowed from pg_roles where rolname in (\'anon\',\'authenticated\',\'service_role\') order by rolname', [`public.${fn}`])
      expect(result.rows).toEqual([{ role: 'anon', allowed: false }, { role: 'authenticated', allowed: false }, { role: 'service_role', allowed: true }])
    }
    expect((await db.query("select relrowsecurity from pg_class where relname='offer_groups'")).rows).toEqual([{ relrowsecurity: true }])
  })
})
