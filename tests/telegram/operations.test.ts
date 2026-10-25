import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupportOperations } from '@/lib/telegram/operations'
import type { OperationData } from '@/lib/telegram/operations'
import type { SupportAction } from '@/lib/telegram/types'

let data: OperationData
let currentEmail: string
const action: SupportAction = { id: 'action', userId: 123, chatId: 123, kind: 'correct', customerId: 'customer', storeId: 'store', expectedEmail: 'old@example.test', newEmail: 'new@example.test', state: 'processing', expiresAt: '2026-10-25T13:00:00Z', promptId: 1, logId: null, result: null }
beforeEach(() => {
  currentEmail = 'old@example.test'
  data = {
    getCustomer: vi.fn(async () => ({ id: 'customer', email: currentEmail, name: 'Cliente', blocked: false })),
    findCustomer: vi.fn(async () => null), search: vi.fn(async () => []), authEmail: vi.fn(async () => currentEmail), destinationExists: vi.fn(async () => false),
    access: vi.fn(async () => [{ id: 'product', title: 'Atlas', level: 'complete' as const }]), orders: vi.fn(async () => [{ transaction: 'TX', status: 'pago' }]), delivery: vi.fn(async () => 'Entregue ao servidor do destinatário'),
    changeEmail: vi.fn(async (_id, email) => { currentEmail = email }), quotaAvailable: vi.fn(async () => true), send: vi.fn(async () => ({ ok: true, logId: 'log' })),
  }
})
const ops = () => createSupportOperations({ storeId: 'store', storeName: 'Loja', adminEmails: ['admin@example.test'] }, data)
describe('operações de suporte', () => {
  it('corrige preservando identidade e depois envia ao novo endereço', async () => {
    const result = await ops().execute(action)
    expect(data.changeEmail).toHaveBeenCalledWith('customer', 'new@example.test', 'old@example.test')
    expect(data.send).toHaveBeenCalledWith('customer', 'store', 'new@example.test')
    expect(result.state).toBe('done'); expect(result.text).toContain('aceito'); expect(result.text).toContain('new@example.test')
  })
  it('não envia para endereço alterado depois da abertura do botão', async () => {
    currentEmail = 'changed@example.test'
    expect((await ops().execute(action)).state).toBe('done')
    expect(data.changeEmail).not.toHaveBeenCalled(); expect(data.send).not.toHaveBeenCalled()
  })
  it('Auth divergente impede alteração e reenvio', async () => {
    vi.mocked(data.authEmail).mockResolvedValue('divergent@example.test')
    await ops().execute(action); expect(data.changeEmail).not.toHaveBeenCalled(); expect(data.send).not.toHaveBeenCalled()
  })
  it.each(['blocked', 'noAccess', 'destination', 'admin', 'quota', 'wrongStore'])('recusa condição insegura: %s', async condition => {
    let input = action
    if (condition === 'blocked') vi.mocked(data.getCustomer).mockResolvedValue({ id: 'customer', email: currentEmail, name: 'Cliente', blocked: true })
    if (condition === 'noAccess') vi.mocked(data.access).mockResolvedValue([])
    if (condition === 'destination') vi.mocked(data.destinationExists).mockResolvedValue(true)
    if (condition === 'admin') input = { ...action, newEmail: 'admin@example.test' }
    if (condition === 'quota') vi.mocked(data.quotaAvailable).mockResolvedValue(false)
    if (condition === 'wrongStore') input = { ...action, storeId: 'other' }
    await ops().execute(input); expect(data.changeEmail).not.toHaveBeenCalled(); expect(data.send).not.toHaveBeenCalled()
  })
  it('falha após correção relata correção concluída e envio incerto', async () => {
    vi.mocked(data.send).mockRejectedValue(new Error('timeout'))
    const r = await ops().execute(action)
    expect(currentEmail).toBe('new@example.test'); expect(r.state).toBe('uncertain'); expect(r.text).toContain('corrigido')
  })
  it('perda de acesso após correção impede envio', async () => {
    vi.mocked(data.access).mockResolvedValueOnce([{ id: 'product', title: 'Atlas', level: 'complete' }]).mockResolvedValueOnce([])
    const r = await ops().execute(action); expect(r.state).toBe('uncertain'); expect(data.send).not.toHaveBeenCalled()
  })
  it('reenvio não modifica cadastro', async () => {
    await ops().execute({ ...action, kind: 'resend', newEmail: null })
    expect(data.changeEmail).not.toHaveBeenCalled(); expect(data.send).toHaveBeenCalledWith('customer', 'store', 'old@example.test')
  })
})
