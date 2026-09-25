import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { toProduct, type DbProduct, PRODUCT_COLUMNS } from '@/lib/data/products'
import { buildShelf } from '@/lib/access/access'

it('preserva conteúdo existente e inicializa personalização vazia', async () => {
  const db = new PGlite()
  try {
    await db.exec("create table products(id text, title text); insert into products values ('p','Atlas');")
    await db.exec(readFileSync(new URL('../../supabase/migrations/20260925020000_locked_product_modal.sql', import.meta.url), 'utf8'))
    expect((await db.query('select * from products')).rows).toEqual([{ id: 'p', title: 'Atlas', purchase_title: null, purchase_description: null, purchase_image_url: null, purchase_button_text: null }])
    await expect(db.exec("update products set purchase_button_text=repeat('x',81)")).rejects.toThrow()
  } finally { await db.close() }
})

it('leva os campos persistidos até o produto bloqueado na vitrine', () => {
  const row = { id: 'p', title: 'Atlas', is_published: true, sort_order: 0, purchase_title: 'Conheça o Atlas', purchase_description: 'Todos os detalhes', purchase_image_url: 'https://example.com/image.png', purchase_button_text: 'Comprar Atlas' } as DbProduct
  const product = toProduct(row)
  expect(PRODUCT_COLUMNS).toContain('purchase_button_text')
  expect(buildShelf([product], new Set()).locked[0]).toMatchObject({ purchaseTitle: 'Conheça o Atlas', purchaseDescription: 'Todos os detalhes', purchaseImageUrl: 'https://example.com/image.png', purchaseButtonText: 'Comprar Atlas' })
})
