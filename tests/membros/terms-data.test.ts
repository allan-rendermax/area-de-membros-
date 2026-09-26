import { expect, it, vi } from 'vitest'
import { acceptMemberTerms, MEMBER_TERMS_VERSION } from '@/lib/data/member-terms'
const upsert = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ upsert }) }) }))
it('ignora aceite repetido e usa a versão do servidor, deixando a data para o banco', async () => {
  upsert.mockResolvedValue({ error: null })
  await acceptMemberTerms('student','store')
  expect(upsert).toHaveBeenCalledWith({ customer_id:'student',store_id:'store',terms_version:MEMBER_TERMS_VERSION }, { onConflict:'customer_id,store_id',ignoreDuplicates:true })
  upsert.mockResolvedValueOnce({ error: new Error('write failed') })
  await expect(acceptMemberTerms('student','store')).rejects.toThrow('write failed')
})
