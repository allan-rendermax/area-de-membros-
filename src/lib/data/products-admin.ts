import type { ItemInput, ModuleInput, OfferInput, ProductInput } from '@/lib/admin/forms'
import { moveInList } from '@/lib/admin/order'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

function friendly(error: { code?: string; message: string }, duplicateMessage: string): Error {
  return new Error(error.code === '23505' ? duplicateMessage : error.message)
}

const now = () => new Date().toISOString()

export async function saveProduct(input: ProductInput): Promise<string> {
  const db = createAdminClient()
  const row = {
    store_id: input.storeId,
    slug: input.slug,
    title: input.title,
    description: input.description,
    cover_url: input.coverUrl,
    banner_url: input.bannerUrl,
    checkout_url: input.checkoutUrl,
    is_featured: input.isFeatured,
    sort_order: input.sortOrder,
    is_published: input.isPublished,
    updated_at: now(),
  }
  const { data, error } = input.id
    ? await db.from('products').update(row).eq('id', input.id).eq('store_id', input.storeId).select('id').single()
    : await db.from('products').insert(row).select('id').single()
  if (error) throw friendly(error, 'Já existe um produto com este endereço nesta loja.')
  return data.id as string
}

async function nextSortOrder(table: 'modules' | 'items', parentColumn: 'product_id' | 'module_id', parentId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from(table)
    .select('sort_order')
    .eq(parentColumn, parentId)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (error) throw error
  return data.length ? (data[0].sort_order as number) + 1 : 0
}

async function renumber(table: 'modules' | 'items', ids: string[]): Promise<void> {
  const db = createAdminClient()
  for (const [index, id] of ids.entries()) {
    const { error } = await db.from(table).update({ sort_order: index }).eq('id', id)
    if (error) throw error
  }
}

export async function saveModule(input: ModuleInput): Promise<void> {
  const db = createAdminClient()
  const { error } = input.id
    ? await db.from('modules').update({ title: input.title, is_published: input.isPublished, updated_at: now() }).eq('id', input.id).eq('product_id', input.productId)
    : await db.from('modules').insert({
        product_id: input.productId,
        title: input.title,
        is_published: input.isPublished,
        sort_order: await nextSortOrder('modules', 'product_id', input.productId),
      })
  if (error) throw error
}

export async function deleteModule(id: string, productId: string): Promise<void> {
  const { error } = await createAdminClient().from('modules').delete().eq('id', id).eq('product_id', productId)
  if (error) throw error
}

export async function moveModule(id: string, productId: string, direction: 'up' | 'down'): Promise<void> {
  const { data, error } = await createAdminClient().from('modules').select('id').eq('product_id', productId).order('sort_order').order('created_at')
  if (error) throw error
  await renumber('modules', moveInList(data.map((r) => r.id as string), id, direction))
}

export async function saveItem(input: ItemInput): Promise<void> {
  const db = createAdminClient()
  const row = { title: input.title, kind: input.kind, url: input.url, cover_url: input.coverUrl, is_published: input.isPublished, updated_at: now() }
  const { error } = input.id
    ? await db.from('items').update(row).eq('id', input.id).eq('module_id', input.moduleId)
    : await db.from('items').insert({ ...row, module_id: input.moduleId, sort_order: await nextSortOrder('items', 'module_id', input.moduleId) })
  if (error) throw error
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await createAdminClient().from('items').delete().eq('id', id)
  if (error) throw error
}

export async function moveItem(id: string, moduleId: string, direction: 'up' | 'down'): Promise<void> {
  const { data, error } = await createAdminClient().from('items').select('id').eq('module_id', moduleId).order('sort_order').order('created_at')
  if (error) throw error
  await renumber('items', moveInList(data.map((r) => r.id as string), id, direction))
}

export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) throw new Error('Envie uma imagem de até 2 MB.')
  const db = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('covers').upload(path, file, { contentType: file.type })
  if (error) throw error
  return db.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export type AdminOffer = { id: string; name: string; paytProductCode: string; productIds: string[] }

type DbOffer = { id: string; name: string; payt_product_code: string; offer_products: { product_id: string }[] }

const OFFER_COLUMNS = 'id, name, payt_product_code, offer_products(product_id)'

function toOffer(row: DbOffer): AdminOffer {
  return { id: row.id, name: row.name, paytProductCode: row.payt_product_code, productIds: row.offer_products.map((p) => p.product_id) }
}

export async function listOffers(storeId: string): Promise<AdminOffer[]> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('store_id', storeId).order('name')
  if (error) throw error
  return (data as DbOffer[]).map(toOffer)
}

export async function getOffer(id: string, storeId: string): Promise<AdminOffer | null> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('id', id).eq('store_id', storeId).maybeSingle()
  if (error) throw error
  return data ? toOffer(data as DbOffer) : null
}

export async function saveOffer(input: OfferInput): Promise<void> {
  const db = createAdminClient()

  if (input.productIds.length) {
    const { count, error } = await db.from('products').select('id', { count: 'exact', head: true }).eq('store_id', input.storeId).in('id', input.productIds)
    if (error) throw error
    if (count !== input.productIds.length) throw new Error('Há produto de outra loja na oferta.')
  }

  const row = { store_id: input.storeId, name: input.name, payt_product_code: input.paytProductCode }
  let offerId = input.id
  if (offerId) {
    const { data, error } = await db.from('offers').update(row).eq('id', offerId).eq('store_id', input.storeId).select('id')
    if (error) throw friendly(error, 'Este código da Payt já está em outra oferta.')
    if (!data?.length) throw new Error('Oferta não encontrada nesta loja. Recarregue a página.')
  } else {
    const { data, error } = await db.from('offers').insert(row).select('id').single()
    if (error) throw friendly(error, 'Este código da Payt já está em outra oferta.')
    offerId = data.id as string
  }

  // Grava os vínculos novos antes de remover os desmarcados: quem já comprou nunca perde acesso no meio.
  if (input.productIds.length) {
    const { error } = await db
      .from('offer_products')
      .upsert(input.productIds.map((productId) => ({ offer_id: offerId, product_id: productId })), { onConflict: 'offer_id,product_id', ignoreDuplicates: true })
    if (error) throw error
  }

  let removal = db.from('offer_products').delete().eq('offer_id', offerId)
  if (input.productIds.length) removal = removal.not('product_id', 'in', `(${input.productIds.join(',')})`)
  const { error: deleteError } = await removal
  if (deleteError) throw deleteError
}
