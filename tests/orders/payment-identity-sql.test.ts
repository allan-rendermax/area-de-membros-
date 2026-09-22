import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const STORE_ID = '00000000-0000-4000-8000-000000000001'
const BASE_MIGRATION_PATH = fileURLToPath(
  new URL('../../supabase/migrations/20260917000001_cuspidora_base.sql', import.meta.url),
)
const IDENTITY_MIGRATION_PATH = fileURLToPath(
  new URL('../../supabase/migrations/20260922150000_order_payment_identity.sql', import.meta.url),
)
const FUNCTION_SIGNATURE =
  'public.apply_order_status(uuid, text, text, text, text, text, text, smallint, text, boolean, integer)'

type CallResult = {
  out_order_id: string
  out_changed: boolean
  out_status: string
}

type OrderRow = {
  customer_email: string
  customer_name: string
  status: string
  status_rank: number
}

const databases: PGlite[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.close()))
})

function previousApplyOrderStatusSql() {
  const source = readFileSync(BASE_MIGRATION_PATH, 'utf8')
  const start = source.indexOf('create or replace function public.apply_order_status(')
  const grantStart = source.indexOf('grant execute on function public.apply_order_status(', start)
  const end = source.indexOf(';', grantStart)

  if (start < 0 || grantStart < 0 || end < 0) {
    throw new Error('Não foi possível extrair apply_order_status da migration base.')
  }

  return source.slice(start, end + 1)
}

async function createDatabase(applyIdentityMigration: boolean) {
  const db = new PGlite()
  databases.push(db)

  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create table public.orders (
      id uuid primary key default md5(random()::text || clock_timestamp()::text)::uuid,
      store_id uuid,
      payt_transaction_id text not null,
      payt_product_code text not null,
      payt_product_name text not null default '',
      customer_email text not null,
      customer_name text not null default '',
      status text not null check (status in ('pendente','pago','cancelado','reembolsado','chargeback')),
      status_rank smallint not null,
      payt_type text not null default 'order',
      is_test boolean not null default false,
      amount_cents integer,
      paid_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (payt_transaction_id, payt_product_code)
    );
  `)
  await db.exec(previousApplyOrderStatusSql())

  if (applyIdentityMigration && existsSync(IDENTITY_MIGRATION_PATH)) {
    await db.exec(readFileSync(IDENTITY_MIGRATION_PATH, 'utf8'))
  }

  return db
}

async function applyStatus(
  db: PGlite,
  input: {
    transactionId: string
    productCode?: string
    customerEmail: string
    customerName: string
    status: string
    statusRank: number
  },
) {
  const result = await db.query<CallResult>(
    `select * from public.apply_order_status(
      $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text,
      $7::text, $8::smallint, $9::text, $10::boolean, $11::integer
    )`,
    [
      STORE_ID,
      input.transactionId,
      input.productCode ?? 'PRODUTO-1',
      'Produto',
      input.customerEmail,
      input.customerName,
      input.status,
      input.statusRank,
      'order',
      false,
      4900,
    ],
  )

  return result.rows[0]
}

async function order(db: PGlite, transactionId: string) {
  const result = await db.query<OrderRow>(
    `select customer_email, customer_name, status, status_rank
       from public.orders
      where payt_transaction_id = $1`,
    [transactionId],
  )
  return result.rows[0]
}

describe('migration de identidade de pagamento', () => {
  it('reproduz a titularidade antiga antes da migration', async () => {
    const db = await createDatabase(false)

    await applyStatus(db, {
      transactionId: 'tx-before-migration',
      customerEmail: 'antigo@example.com',
      customerName: 'Nome Antigo',
      status: 'pendente',
      statusRank: 0,
    })
    await applyStatus(db, {
      transactionId: 'tx-before-migration',
      customerEmail: ' NOVO@Example.com ',
      customerName: 'Nome Novo',
      status: 'pago',
      statusRank: 1,
    })

    await expect(order(db, 'tx-before-migration')).resolves.toMatchObject({
      customer_email: 'antigo@example.com',
      customer_name: 'Nome Antigo',
      status: 'pago',
    })
  })

  it('assume a identidade normalizada no primeiro pagamento de um pedido pendente', async () => {
    const db = await createDatabase(true)

    await applyStatus(db, {
      transactionId: 'tx-first-payment',
      customerEmail: 'precheckout@example.com',
      customerName: 'Pré-checkout',
      status: 'pendente',
      statusRank: 0,
    })
    const result = await applyStatus(db, {
      transactionId: 'tx-first-payment',
      customerEmail: ' COMPRADOR@Example.com ',
      customerName: 'Comprador Final',
      status: 'pago',
      statusRank: 1,
    })

    expect(result).toMatchObject({ out_changed: true, out_status: 'pago' })
    await expect(order(db, 'tx-first-payment')).resolves.toEqual({
      customer_email: 'comprador@example.com',
      customer_name: 'Comprador Final',
      status: 'pago',
      status_rank: 1,
    })
  })

  it('normaliza o e-mail ao inserir um pedido novo', async () => {
    const db = await createDatabase(true)

    await applyStatus(db, {
      transactionId: 'tx-new-paid',
      customerEmail: ' NOVO@Example.com ',
      customerName: 'Novo Comprador',
      status: 'pago',
      statusRank: 1,
    })

    await expect(order(db, 'tx-new-paid')).resolves.toMatchObject({
      customer_email: 'novo@example.com',
      customer_name: 'Novo Comprador',
    })
  })

  it('preserva correção administrativa em duplicata e evento pendente atrasado', async () => {
    const db = await createDatabase(true)

    await applyStatus(db, {
      transactionId: 'tx-admin-edit',
      customerEmail: 'original@example.com',
      customerName: 'Original',
      status: 'pago',
      statusRank: 1,
    })
    await db.query(
      `update public.orders
          set customer_email = $1, customer_name = $2
        where payt_transaction_id = $3`,
      ['corrigido@example.com', 'Titular Corrigido', 'tx-admin-edit'],
    )

    const duplicate = await applyStatus(db, {
      transactionId: 'tx-admin-edit',
      customerEmail: 'original@example.com',
      customerName: 'Original',
      status: 'pago',
      statusRank: 1,
    })
    const latePending = await applyStatus(db, {
      transactionId: 'tx-admin-edit',
      customerEmail: 'atrasado@example.com',
      customerName: 'Atrasado',
      status: 'pendente',
      statusRank: 0,
    })

    expect(duplicate).toMatchObject({ out_changed: false, out_status: 'pago' })
    expect(latePending).toMatchObject({ out_changed: false, out_status: 'pago' })
    await expect(order(db, 'tx-admin-edit')).resolves.toEqual({
      customer_email: 'corrigido@example.com',
      customer_name: 'Titular Corrigido',
      status: 'pago',
      status_rank: 1,
    })
  })

  it.each([
    ['reembolsado', 'tx-refund'],
    ['chargeback', 'tx-chargeback'],
  ])('mantém titular e não retrocede depois de %s', async (finalStatus, transactionId) => {
    const db = await createDatabase(true)

    await applyStatus(db, {
      transactionId,
      customerEmail: 'titular@example.com',
      customerName: 'Titular',
      status: 'pago',
      statusRank: 1,
    })
    const revoked = await applyStatus(db, {
      transactionId,
      customerEmail: 'evento-final@example.com',
      customerName: 'Evento Final',
      status: finalStatus,
      statusRank: 2,
    })
    const stalePaid = await applyStatus(db, {
      transactionId,
      customerEmail: 'atrasado@example.com',
      customerName: 'Atrasado',
      status: 'pago',
      statusRank: 1,
    })

    expect(revoked).toMatchObject({ out_changed: true, out_status: finalStatus })
    expect(stalePaid).toMatchObject({ out_changed: false, out_status: finalStatus })
    await expect(order(db, transactionId)).resolves.toEqual({
      customer_email: 'titular@example.com',
      customer_name: 'Titular',
      status: finalStatus,
      status_rank: 2,
    })
  })

  it('preserva contrato e permite execução somente ao service_role', async () => {
    const db = await createDatabase(true)
    const metadata = await db.query<{
      result_type: string
      security_definer: boolean
      settings: string[]
    }>(`
      select pg_get_function_result(p.oid) as result_type,
             p.prosecdef as security_definer,
             p.proconfig as settings
        from pg_proc p
       where p.oid = '${FUNCTION_SIGNATURE}'::regprocedure
    `)
    const privileges = await db.query<{
      anon: boolean
      authenticated: boolean
      service_role: boolean
    }>(`
      select has_function_privilege('anon', '${FUNCTION_SIGNATURE}', 'EXECUTE') as anon,
             has_function_privilege('authenticated', '${FUNCTION_SIGNATURE}', 'EXECUTE') as authenticated,
             has_function_privilege('service_role', '${FUNCTION_SIGNATURE}', 'EXECUTE') as service_role
    `)

    expect(metadata.rows[0]).toEqual({
      result_type: 'TABLE(out_order_id uuid, out_changed boolean, out_status text)',
      security_definer: true,
      settings: ['search_path=""'],
    })
    expect(privileges.rows[0]).toEqual({
      anon: false,
      authenticated: false,
      service_role: true,
    })
  })
})
