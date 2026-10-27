import { beforeEach, expect, it, vi } from 'vitest'
import { runDailyReport, syncDelivery } from '@/lib/telegram/monitoring-server'
import { authorizeTelegramJob } from '@/lib/telegram/jobs'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), send: vi.fn(), reports: new Set<number>(), updates: [] as {table:string;value:Record<string,unknown>}[] }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mock }))
vi.mock('@/lib/data/stores', () => ({ getStoreBySlug: async () => ({ id: 'store', name: 'Loja' }) }))
vi.mock('@/lib/env', () => ({ env: { resendApiKey: 'test' } }))
vi.mock('@/lib/telegram/config', () => ({ getTelegramConfig: () => ({ token: 'token', allowedUsers: [123,456], storeSlug: 'loja' }) }))
vi.mock('@/lib/telegram/client', () => ({ createTelegramClient: () => ({ send: mock.send }) }))
beforeEach(() => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); mock.reports.clear(); mock.updates=[]
  mock.send.mockResolvedValue(42)
  mock.rpc.mockImplementation(async (name: string) => ({ data: name === 'telegram_support_claim_job' ? true : name === 'telegram_support_failures' ? {total:0,rows:[],updatedAt:null,unknown:0} : {}, error: null }))
  mock.from.mockImplementation((table: string) => ({
    select: () => ({ in: async () => ({data:[{id:'log',provider_id:'provider'}],error:null}) }),
    upsert: async (value: Record<string,unknown>) => {mock.updates.push({table,value});return {error:null}},
    insert: async (value: {user_id:number}) => {
      if(mock.reports.has(value.user_id)) return {error:{code:'23505'}}
      mock.reports.add(value.user_id); return {error:null}
    },
    update: (value: Record<string,unknown>) => {
      mock.updates.push({table,value})
      const result = {error:null}, chain = { eq: () => chain, then: (resolve: (x:unknown)=>unknown) => Promise.resolve(result).then(resolve) }
      return chain
    },
  }))
})
it('sincroniza somente e-mails pertencentes à plataforma e reconhece convites', async () => {
  vi.stubGlobal('fetch',vi.fn(async () => Response.json({data:[{id:'provider',last_event:'bounced',subject:'Seu convite para o Clube da Construção',created_at:new Date().toISOString()}],has_more:false})))
  expect(await syncDelivery()).toEqual({synced:1})
  expect(mock.updates.find(x=>x.table==='telegram_email_delivery')?.value).toMatchObject([{log_id:'log',is_access:false,event:'bounced'}])
  expect(mock.updates.some(x=>'last_success_at' in x.value)).toBe(true)
})
it('não apresenta falha de sincronização como conferência completa', async () => {
  vi.stubGlobal('fetch',vi.fn(async () => new Response('',{status:429})))
  await expect(syncDelivery()).rejects.toThrow('telegram_provider_list_failed')
  expect(mock.updates.some(x=>'last_success_at' in x.value)).toBe(false)
})
it('envia relatório somente ao destinatário explícito e uma vez por data', async () => {
  vi.stubEnv('TELEGRAM_REPORT_USER_IDS','123,999,123')
  const now = new Date('2026-10-26T02:05:00Z')
  expect(await runDailyReport(now)).toEqual({sent:1})
  expect(await runDailyReport(now)).toEqual({sent:0})
  expect(mock.send).toHaveBeenCalledTimes(1); expect(mock.send.mock.calls[0][0]).toBe(123)
})
it('timeout no Telegram mantém resultado incerto e não reenvia automaticamente', async () => {
  vi.stubEnv('TELEGRAM_REPORT_USER_IDS','123'); mock.send.mockRejectedValue(new Error('timeout'))
  await expect(runDailyReport(new Date('2026-10-26T02:05:00Z'))).rejects.toThrow('telegram_report_send_uncertain')
  expect(mock.updates.some(x=>x.value.state==='uncertain')).toBe(true)
  expect(await runDailyReport(new Date('2026-10-26T02:06:00Z'))).toEqual({sent:0})
  expect(mock.send).toHaveBeenCalledTimes(1)
})
it('cron nega segredo ausente ou errado', () => {
  vi.stubEnv('CRON_SECRET',''); vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','')
  expect(authorizeTelegramJob(new Request('https://example.test'))).toBe(false)
  vi.stubEnv('CRON_SECRET','private')
  expect(authorizeTelegramJob(new Request('https://example.test',{headers:{authorization:'Bearer wrong'}}))).toBe(false)
  expect(authorizeTelegramJob(new Request('https://example.test',{headers:{authorization:'Bearer private'}}))).toBe(true)
})
