import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeCustomerEmail } from '@/lib/data/customers'

const io = vi.hoisted(() => ({
  email: 'old@example.com',
  authUpdate: vi.fn(), rpc: vi.fn(), customerRead: vi.fn(), destinationRead: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  auth: { admin: { updateUserById: io.authUpdate } },
  rpc: io.rpc,
  from: (table: string) => {
    if (table !== 'customers') throw new Error('unexpected table')
    return { select: () => ({ eq: (column: string) => ({ maybeSingle: () =>
      column === 'id' ? io.customerRead() : io.destinationRead(),
    }) }) }
  },
}) }))

beforeEach(() => {
  io.email = 'old@example.com'
  io.authUpdate.mockReset().mockResolvedValue({ error: null })
  io.rpc.mockReset().mockResolvedValue({ error: null })
  io.customerRead.mockReset().mockImplementation(async () => ({ data: { id: 'customer', email: io.email, name: 'Name', blocked_at: null }, error: null }))
  io.destinationRead.mockReset().mockResolvedValue({ data: null, error: null })
})

describe('correção de email', () => {
  it('envia email anterior como precondição da RPC', async () => {
    await changeCustomerEmail('customer', 'new@example.com')
    expect(io.rpc).toHaveBeenCalledWith('change_customer_email_atomic', {
      p_id: 'customer', p_expected_email: 'old@example.com', p_new_email: 'new@example.com',
    })
    expect(io.authUpdate).toHaveBeenCalledWith('customer', { email: 'new@example.com', email_confirm: true })
  })

  it('compensa Auth se RPC falha e cliente ainda mantém email anterior', async () => {
    io.rpc.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    await expect(changeCustomerEmail('customer', 'new@example.com')).rejects.toThrow()
    expect(io.authUpdate).toHaveBeenLastCalledWith('customer', { email: 'old@example.com', email_confirm: true })
  })

  it('não compensa Auth quando RPC com resposta ambígua já gravou o novo email', async () => {
    io.rpc.mockImplementation(async () => { io.email = 'new@example.com'; throw new Error('network') })
    await expect(changeCustomerEmail('customer', 'new@example.com')).resolves.toBeUndefined()
    expect(io.authUpdate).toHaveBeenCalledTimes(1)
  })

  it('não compensa Auth se transporte falha enquanto RPC ainda pode concluir', async () => {
    io.rpc.mockImplementation(async () => {
      setTimeout(() => { io.email = 'new@example.com' }, 0)
      throw new Error('network timeout')
    })
    await expect(changeCustomerEmail('customer', 'new@example.com')).rejects.toThrow('reconciliação')
    expect(io.authUpdate).toHaveBeenCalledTimes(1)
    await new Promise((resolve) => setTimeout(resolve, 1))
    expect(io.email).toBe('new@example.com')
  })

  it('não compensa Auth se PostgREST retorna falha de transporte sem SQLSTATE', async () => {
    io.rpc.mockResolvedValue({ error: { code: 'PGRST000', message: 'upstream unavailable' } })
    await expect(changeCustomerEmail('customer', 'new@example.com')).rejects.toThrow('reconciliação')
    expect(io.authUpdate).toHaveBeenCalledTimes(1)
  })

  it('sinaliza reconciliação quando não consegue conhecer estado após falha da RPC', async () => {
    io.rpc.mockRejectedValue(new Error('network'))
    io.customerRead.mockResolvedValueOnce({ data: { id: 'customer', email: 'old@example.com', name: 'Name', blocked_at: null }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('offline') })
    await expect(changeCustomerEmail('customer', 'new@example.com')).rejects.toThrow('reconciliação')
    expect(io.authUpdate).toHaveBeenCalledTimes(1)
  })

  it('sinaliza reconciliação se compensação de Auth falha', async () => {
    io.rpc.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } })
    io.authUpdate.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('auth offline') })
    await expect(changeCustomerEmail('customer', 'new@example.com')).rejects.toThrow('reconciliação')
  })
})
