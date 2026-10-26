import { beforeEach, expect, it, vi } from 'vitest'
import { isSupportUser, teamOwners } from '@/lib/telegram/team-access'
const {single,from}=vi.hoisted(()=>({single:vi.fn(),from:vi.fn()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({from})}))
const config={token:'token',secret:'secret',storeSlug:'store',allowedUsers:[123,456]}
beforeEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();vi.stubEnv('TELEGRAM_OWNER_USER_IDS','123');from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:single})})})})
it('mantém proprietário independente de linhas mutáveis',async()=>{expect(await isSupportUser(123,config)).toBe(true);expect(from).not.toHaveBeenCalled()})
it('consulta cada update e revogação vence configuração antiga',async()=>{
  single.mockResolvedValueOnce({data:{active:true}}).mockResolvedValueOnce({data:{active:false}})
  expect(await isSupportUser(456,config)).toBe(true);expect(await isSupportUser(456,config)).toBe(false);expect(single).toHaveBeenCalledTimes(2)
})
it('nega ausente e não assume permissão quando banco falha',async()=>{
  single.mockResolvedValueOnce({data:null}).mockResolvedValueOnce({error:{code:'offline'}})
  expect(await isSupportUser(456,config)).toBe(false);await expect(isSupportUser(456,config)).rejects.toThrow('unavailable')
})
it('configuração inválida de proprietário falha fechada',()=>{vi.stubEnv('TELEGRAM_OWNER_USER_IDS','123,bad');expect(()=>teamOwners()).toThrow()})
