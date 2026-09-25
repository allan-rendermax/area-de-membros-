import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it, vi } from 'vitest'
import { parseProductForm } from '@/lib/admin/forms'
import { saveProduct } from '@/lib/data/products-admin'
import { PRODUCT_COLUMNS, toProduct, type DbProduct } from '@/lib/data/products'

const update = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ update }) }) }))

const promotional = 'https://checkout.example.test/item?coupon=ALUNO10&utm_source=members#payment'

describe('checkout de aluno', () => {
  it('seleciona e mapeia o checkout de aluno sem alterar a URL', () => {
    const row = {
      id: 'p', store_id: 's', slug: 'atlas', title: 'Atlas', track: '', description: '',
      cover_url: null, banner_url: null, checkout_url: null, student_checkout_url: promotional,
      is_featured: false, sort_order: 0, is_published: true,
    } as DbProduct
    expect(PRODUCT_COLUMNS.split(', ')).toContain('student_checkout_url')
    expect(toProduct(row).studentCheckoutUrl).toBe(promotional)
    expect(toProduct({ ...row, student_checkout_url: null }).studentCheckoutUrl).toBeNull()
  })

  it('grava o campo no payload de atualização', async () => {
    let payload: Record<string, unknown> = {}
    update.mockImplementation((row) => { payload = row; return { eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'p' }, error: null }) }) }) }) } })
    const form = new FormData()
    form.set('id', '00000000-0000-4000-8000-000000000001')
    form.set('title', 'Atlas')
    form.set('student_checkout_url', promotional)
    form.set('content_mode', 'versions')
    form.set('upgrade_button_text', 'Liberar meu Atlas')
    form.set('upgrade_image_url', 'https://example.com/mockup.png')
    form.set('purchase_title', 'Seu próximo Atlas')
    form.set('purchase_description', 'Descrição com\n\nparágrafos')
    form.set('purchase_image_url', 'https://example.com/sale.png')
    form.set('purchase_button_text', 'Quero comprar')
    await saveProduct(parseProductForm(form, 's'))
    expect(payload.student_checkout_url).toBe(promotional)
    expect(payload.content_mode).toBe('versions')
    expect(payload.upgrade_button_text).toBe('Liberar meu Atlas')
    expect(payload.upgrade_image_url).toBe('https://example.com/mockup.png')
    expect(payload.purchase_title).toBe('Seu próximo Atlas')
    expect(payload.purchase_description).toBe('Descrição com\n\nparágrafos')
    expect(payload.purchase_image_url).toBe('https://example.com/sale.png')
    expect(payload.purchase_button_text).toBe('Quero comprar')
  })

  it('migration conserva registro existente e inicializa campo como null', async () => {
    const db = new PGlite()
    try {
      await db.exec("create table public.products(id text primary key, title text); insert into public.products values ('p', 'Atlas');")
      const migration = fileURLToPath(new URL('../../supabase/migrations/20260924000002_student_checkout.sql', import.meta.url))
      await db.exec(readFileSync(migration, 'utf8'))
      const result = await db.query<{ title: string; student_checkout_url: string | null }>("select title, student_checkout_url from public.products where id = 'p'")
      expect(result.rows).toEqual([{ title: 'Atlas', student_checkout_url: null }])
    } finally { await db.close() }
  })
})
