import { beforeEach, expect, it, vi } from 'vitest'
import { createManualOrder } from '@/lib/data/orders'
const io = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => io }))
const input = { storeId: 'store', offerId: 'offer', customerId: 'customer', adminEmail: 'admin@example.test', note: 'Ajuste' }
beforeEach(() => { vi.resetAllMocks(); io.rpc.mockResolvedValue({ error: null }) })
it('envia IDs para validação e gravação atômica sem pré-leitura sujeita à exclusão', async () => {
  await createManualOrder(input)
  expect(io.from).not.toHaveBeenCalled()
  expect(io.rpc).toHaveBeenCalledExactlyOnceWith('create_manual_order_atomic', {
    p_store_id: 'store', p_offer_id: 'offer', p_customer_id: 'customer', p_admin_email: 'admin@example.test', p_note: 'Ajuste',
  })
})
it('não volta ao INSERT inseguro se a migração estiver ausente', async () => {
  io.rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'missing' } })
  await expect(createManualOrder(input)).rejects.toThrow(/disponível|migração/)
  expect(io.from).not.toHaveBeenCalled()
})
it('propaga rejeição do banco para o administrador', async () => {
  io.rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Cliente não encontrado.' } })
  await expect(createManualOrder(input)).rejects.toThrow('Cliente não encontrado.')
})
