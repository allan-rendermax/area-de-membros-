import { beforeEach, describe, expect, it, vi } from 'vitest'
import { salvarLoja } from '@/app/admin/(painel)/lojas/actions'

const io = vi.hoisted(() => ({
  events: [] as string[],
  saveStore: vi.fn(),
  requireAdmin: vi.fn(),
  updateTag: vi.fn((tag: string) => { io.events.push(`invalidate:${tag}`) }),
  revalidatePath: vi.fn((path: string) => { io.events.push(`revalidate:${path}`) }),
}))

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin: io.requireAdmin }))
vi.mock('@/lib/data/stores', () => ({ saveStore: io.saveStore }))
vi.mock('@/lib/data/products-admin', () => ({ uploadImage: vi.fn() }))
vi.mock('next/cache', () => ({ updateTag: io.updateTag, revalidatePath: io.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${decodeURIComponent(path)}`) } }))

function form() {
  const data = new FormData()
  data.set('name', 'Loja A')
  data.set('slug', 'loja-a')
  return data
}

describe('invalidação da loja salva', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    io.events.length = 0
    io.requireAdmin.mockResolvedValue({ email: 'admin@example.com' })
    io.saveStore.mockImplementation(async () => {
      io.events.push('save:resolved')
      return 'store-a'
    })
  })

  it('invalida a tag pública após a gravação e então revalida o admin', async () => {
    await expect(salvarLoja(form())).rejects.toThrow('NEXT_REDIRECT:/admin/lojas/store-a?msg=Loja salva.')

    expect(io.events).toEqual(['save:resolved', 'invalidate:public-stores', 'revalidate:/admin'])
    expect(io.updateTag).toHaveBeenCalledWith('public-stores')
    expect(io.revalidatePath).toHaveBeenCalledWith('/admin', 'layout')
  })

  it('não invalida quando a gravação falha', async () => {
    io.saveStore.mockRejectedValueOnce(new Error('gravação indisponível'))

    await expect(salvarLoja(form())).rejects.toThrow(/NEXT_REDIRECT:.*gravação indisponível/)
    expect(io.updateTag).not.toHaveBeenCalled()
    expect(io.revalidatePath).not.toHaveBeenCalled()
  })
})
