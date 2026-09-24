import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveItem, saveModule } from '@/lib/data/products-admin'

const db = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), insert: vi.fn(), items: [] as { kind: string; url: string }[], moduleLevel: 'basic' as 'basic' | 'complete' }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: db.from }) }))

const moduleInput = { id: 'module-1', productId: 'product-1', title: 'Extras', isPublished: true, requiredLevel: 'complete' as const }
const itemInput = { id: 'item-1', moduleId: 'module-1', title: 'Guia', kind: 'arquivo' as const, url: '', coverUrl: null, isPublished: true }
const publicUrl = 'https://project.supabase.co/storage/v1/object/public/arquivos/old.pdf'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SUPABASE_URL = 'https://project.supabase.co'
  db.items = []
  db.moduleLevel = 'basic'
  db.from.mockImplementation((table: string) => {
    if (table === 'items') return {
      select: () => ({ eq: async () => ({ data: db.items, error: null }) }),
      update: (row: unknown) => { db.update(row); return { eq: () => ({ eq: async () => ({ error: null }) }) } },
    }
    if (table === 'modules') return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { product_id: 'product-1', required_level: db.moduleLevel }, error: null }) }) }),
      update: (row: unknown) => { db.update(row); return { eq: () => ({ eq: async () => ({ error: null }) }) } },
    }
    throw new Error(`unexpected table ${table}`)
  })
})

describe('proteção de arquivos próprios públicos', () => {
  it('recusa marcar módulo Completo enquanto há arquivo público legado', async () => {
    db.items = [{ kind: 'arquivo', url: publicUrl }]
    await expect(saveModule(moduleInput)).rejects.toThrow('Reenvie')
    expect(db.update).not.toHaveBeenCalled()
  })

  it('aceita link externo ao marcar módulo Completo', async () => {
    db.items = [{ kind: 'arquivo', url: 'https://drive.google.com/file' }]
    await expect(saveModule(moduleInput)).resolves.toBeUndefined()
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ required_level: 'complete' }))
  })

  it('recusa arquivo público próprio em módulo Completo', async () => {
    db.moduleLevel = 'complete'
    await expect(saveItem({ ...itemInput, url: publicUrl }, 'product-1')).rejects.toThrow('Reenvie')
    expect(db.update).not.toHaveBeenCalled()
  })

  it('recusa arquivo público próprio mesmo se o item foi classificado como Link', async () => {
    db.moduleLevel = 'complete'
    await expect(saveItem({ ...itemInput, kind: 'link', url: publicUrl }, 'product-1')).rejects.toThrow('Reenvie')
    expect(db.update).not.toHaveBeenCalled()
  })

  it('aceita referência privada em módulo Completo', async () => {
    db.moduleLevel = 'complete'
    await expect(saveItem({ ...itemInput, url: 'https://project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/new.pdf' }, 'product-1')).resolves.toBeUndefined()
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('arquivos-restritos') }))
  })

  it('recusa item em módulo de outro produto', async () => {
    await expect(saveItem({ ...itemInput, url: 'https://example.com/file.pdf' }, 'other-product')).rejects.toThrow('Módulo inválido')
    expect(db.update).not.toHaveBeenCalled()
  })
})
