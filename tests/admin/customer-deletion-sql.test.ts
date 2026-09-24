import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const id = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const dbs: PGlite[] = []
afterEach(async () => { await Promise.all(dbs.splice(0).map(db => db.close())) })
async function setup() {
  const db = new PGlite(); dbs.push(db)
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id) on delete cascade);
    create table auth.refresh_tokens(session_id uuid references auth.sessions(id) on delete cascade);
    create table auth.identities(user_id uuid references auth.users(id) on delete cascade);
    create table storage.objects(owner_id text);
    create table public.customers(id uuid primary key references auth.users(id) on delete cascade, email text);
    create table public.orders(id int, customer_email text, payt_transaction_id text, store_id uuid);
    create table public.payt_events(id int, customer_email text, payload jsonb);
    create table public.email_log(customer_id uuid references public.customers(id) on delete cascade, to_email text);
    create table public.customer_devices(customer_id uuid references public.customers(id) on delete cascade);
    create table public.item_access(customer_id uuid references public.customers(id) on delete cascade);
    create table public.member_progress(customer_id uuid references public.customers(id) on delete cascade);
    create table public.login_attempts(email_hash text);
    insert into auth.users values ('${id}','cliente@example.test'),('${other}','outro@example.test');
    insert into public.customers select * from auth.users;
    insert into auth.sessions values ('${id}','${id}'),('${other}','${other}');
    insert into auth.refresh_tokens values ('${id}'),('${other}');
    insert into auth.identities values ('${id}'),('${other}');
    insert into public.orders values (1,'cliente@example.test','TX-1','${id}'),(2,'cliente@example.test','TX-2','${other}'),(3,'outro@example.test','TX-3','${other}');
    insert into public.payt_events values
      (1,'cliente@example.test','{}'),
      (2,null,'{"customer":{"email":" CLIENTE@example.test "}}'),
      (3,'email-antigo@example.test','{"transaction_id":"TX-1"}'),
      (4,'outro@example.test','{"transaction_id":"TX-3"}');
    insert into public.email_log values ('${id}','antigo@example.test'),(null,'cliente@example.test'),('${other}','outro@example.test');
    insert into public.customer_devices select id from public.customers;
    insert into public.item_access select id from public.customers;
    insert into public.member_progress select id from public.customers;
    insert into public.login_attempts values ('hash-cliente'),('hash-outro');
  `)
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260924040000_delete_customer.sql', import.meta.url), 'utf8'))
  return db
}
function remove(db: PGlite, confirmation: string | null = 'cliente@example.test', protectedEmails = ['admin@example.test']) {
  return db.query('select public.delete_customer_atomic($1::uuid,$2::text,$3::text[],$4::text)', [id, confirmation, protectedEmails, 'hash-cliente'])
}
describe('exclusão definitiva de cliente', () => {
  it('apaga Auth, sessões, pedidos de todas as lojas e registros vinculados, preservando outro cliente', async () => {
    const db = await setup()
    await remove(db)
    expect((await db.query('select id from auth.users')).rows).toEqual([{ id: other }])
    expect((await db.query('select user_id from auth.sessions')).rows).toEqual([{ user_id: other }])
    expect((await db.query('select session_id from auth.refresh_tokens')).rows).toEqual([{ session_id: other }])
    expect((await db.query('select user_id from auth.identities')).rows).toEqual([{ user_id: other }])
    expect((await db.query('select id from public.customers')).rows).toEqual([{ id: other }])
    expect((await db.query('select id from public.orders')).rows).toEqual([{ id: 3 }])
    expect((await db.query('select id from public.payt_events')).rows).toEqual([{ id: 4 }])
    for (const table of ['email_log','customer_devices','item_access','member_progress']) {
      expect((await db.query(`select customer_id from public.${table}`)).rows).toEqual([{ customer_id: other }])
    }
    expect((await db.query('select email_hash from public.login_attempts')).rows).toEqual([{ email_hash: 'hash-outro' }])
  })
  it.each(['', null, 'outro@example.test'])('rejeita confirmação incorreta: %s', async confirmation => {
    const db = await setup()
    await expect(remove(db, confirmation)).rejects.toThrow(/e-mail/i)
    expect((await db.query('select * from public.orders')).rows).toHaveLength(3)
  })
  it('protege administrador mesmo se o e-mail público divergir do Auth', async () => {
    const db = await setup()
    await db.query('update auth.users set email=$1 where id=$2', ['ADMIN@example.test', id])
    await expect(remove(db)).rejects.toThrow(/administrador/i)
    expect((await db.query('select * from auth.users')).rows).toHaveLength(2)
  })
  it('protege administrador pelo cadastro público e exige lista de proteção', async () => {
    const db = await setup()
    await expect(remove(db, 'cliente@example.test', ['cliente@example.test'])).rejects.toThrow(/administrador/i)
    await expect(remove(db, 'cliente@example.test', [])).rejects.toThrow(/proteção/i)
  })
  it('rejeita e-mail alterado entre a abertura da página e a confirmação', async () => {
    const db = await setup()
    await db.query('update public.customers set email=$1 where id=$2', ['novo@example.test', id])
    await expect(remove(db)).rejects.toThrow(/e-mail/i)
  })
  it('não apaga parcialmente quando a exclusão do Auth falha', async () => {
    const db = await setup()
    await db.exec(`create table auth.restrict_delete(user_id uuid references auth.users(id)); insert into auth.restrict_delete values ('${id}')`)
    await expect(remove(db)).rejects.toThrow()
    expect((await db.query('select * from public.orders')).rows).toHaveLength(3)
    expect((await db.query('select * from public.payt_events')).rows).toHaveLength(4)
    expect((await db.query('select * from public.customers')).rows).toHaveLength(2)
  })
  it('protege arquivos pertencentes ao usuário sem apagar histórico parcialmente', async () => {
    const db = await setup()
    await db.query('insert into storage.objects values ($1)', [id])
    await expect(remove(db)).rejects.toThrow(/arquivos/i)
    expect((await db.query('select * from public.orders')).rows).toHaveLength(3)
  })
  it('rejeita repetição sem atingir outra conta', async () => {
    const db = await setup()
    await remove(db)
    await expect(remove(db)).rejects.toThrow(/não encontrado/i)
    expect((await db.query('select id from auth.users')).rows).toEqual([{ id: other }])
  })
  it('restringe execução ao backend service_role', async () => {
    const db = await setup()
    expect((await db.query(`select rolname as role, has_function_privilege(rolname,
      'public.delete_customer_atomic(uuid,text,text[],text)', 'execute') as allowed
      from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname`)).rows)
      .toEqual([{ role: 'anon', allowed: false }, { role: 'authenticated', allowed: false }, { role: 'service_role', allowed: true }])
  })
})
