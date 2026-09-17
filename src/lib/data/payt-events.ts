import { createAdminClient } from '@/lib/supabase/admin'

export type PaytEventFilter = 'todos' | 'erros' | 'desconhecidos'
export const PAYT_EVENTS_PAGE_SIZE = 50

export type PaytEventRow = {
  id: string
  receivedAt: string
  customerEmail: string | null
  productCodes: string[]
  paytStatus: string | null
  keyValid: boolean | null
  outcome: string | null
  error: string | null
}

type DbEvent = {
  id: string
  received_at: string
  customer_email: string | null
  product_codes: string[] | null
  payt_status: string | null
  key_valid: boolean | null
  outcome: string | null
  error: string | null
}

const COLUMNS = 'id, received_at, customer_email, product_codes, payt_status, key_valid, outcome, error'

function toRow(row: DbEvent): PaytEventRow {
  return {
    id: row.id,
    receivedAt: row.received_at,
    customerEmail: row.customer_email,
    productCodes: row.product_codes ?? [],
    paytStatus: row.payt_status,
    keyValid: row.key_valid,
    outcome: row.outcome,
    error: row.error,
  }
}

export async function listPaytEvents(filter: PaytEventFilter, page: number): Promise<{ rows: PaytEventRow[]; hasMore: boolean }> {
  const from = Math.max(0, page) * PAYT_EVENTS_PAGE_SIZE
  let query = createAdminClient()
    .from('payt_events')
    .select(COLUMNS)
    .order('received_at', { ascending: false })
    .range(from, from + PAYT_EVENTS_PAGE_SIZE)
  if (filter === 'erros') query = query.in('outcome', ['erro', 'invalido', 'chave_invalida', 'failed', 'invalid', 'unauthorized'])
  if (filter === 'desconhecidos') query = query.or('outcome.eq.codigo_desconhecido,error.ilike.*desconhecidos*')
  const { data, error } = await query
  if (error) throw error
  const rows = (data as DbEvent[]).map(toRow)
  return { rows: rows.slice(0, PAYT_EVENTS_PAGE_SIZE), hasMore: rows.length > PAYT_EVENTS_PAGE_SIZE }
}

export async function getPaytEvent(id: string): Promise<(PaytEventRow & { payload: unknown; processedAt: string | null }) | null> {
  const { data, error } = await createAdminClient()
    .from('payt_events')
    .select(`${COLUMNS}, payload, processed_at`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as DbEvent & { payload: unknown; processed_at: string | null }
  return { ...toRow(row), payload: row.payload, processedAt: row.processed_at }
}

export async function listKnownProductCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set()
  const { data, error } = await createAdminClient().from('offers').select('payt_product_code').in('payt_product_code', codes)
  if (error) throw error
  return new Set(data.map((o) => o.payt_product_code as string))
}
