import type { ItemInput, ModuleInput, OfferInput, ProductInput } from '@/lib/admin/forms'
import { itemUploadFilename, validateItemUpload, type ItemUploadTicket } from '@/lib/admin/item-upload'
import { moveInList } from '@/lib/admin/order'
import { env } from '@/lib/env'
import { isLegacyPublicFileUrl, privateFileUrl, PRIVATE_FILES_BUCKET } from '@/lib/content/private-files'
import type { AccessLevel } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

function friendly(error: { code?: string; message: string }, duplicateMessage: string): Error {
  return new Error(error.code === '23505' ? duplicateMessage : error.message)
}

const now = () => new Date().toISOString()

export async function listTracks(storeId: string): Promise<string[]> {
  const { data, error } = await createAdminClient()
    .from('products')
    .select('track')
    .eq('store_id', storeId)
    .neq('track', '')
  if (error) throw error
  return [...new Set(data.map((row) => (row.track as string).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export async function saveProduct(input: ProductInput): Promise<string> {
  const db = createAdminClient()
  const row = {
    store_id: input.storeId,
    slug: input.slug,
    title: input.title,
    track: input.track,
    description: input.description,
    cover_url: input.coverUrl,
    banner_url: input.bannerUrl,
    checkout_url: input.checkoutUrl,
    upgrade_checkout_url: input.upgradeCheckoutUrl ?? null,
    content_mode: input.contentMode ?? 'sections',
    upgrade_image_url: input.upgradeImageUrl ?? null,
    upgrade_button_text: input.upgradeButtonText ?? null,
    purchase_title: input.purchaseTitle ?? null,
    purchase_description: input.purchaseDescription ?? null,
    purchase_image_url: input.purchaseImageUrl ?? null,
    purchase_button_text: input.purchaseButtonText ?? null,
    role: input.role,
    student_checkout_url: input.studentCheckoutUrl ?? null,
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
  const requiredLevel = input.requiredLevel ?? 'basic'
  if (requiredLevel === 'complete' && input.id) {
    const { data: items, error: itemsError } = await db.from('items').select('url').eq('module_id', input.id)
    if (itemsError) throw itemsError
    if (items.some((item) => isLegacyPublicFileUrl(item.url as string, env.supabaseUrl))) {
      throw new Error('Reenvie os arquivos públicos deste módulo para o armazenamento privado antes de marcar como Completo.')
    }
  }
  const { error } = input.id
    ? await db.from('modules').update({ title: input.title, required_level: requiredLevel, is_published: input.isPublished, updated_at: now() }).eq('id', input.id).eq('product_id', input.productId)
    : await db.from('modules').insert({
        product_id: input.productId,
        title: input.title,
        required_level: requiredLevel,
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

export async function saveItem(input: ItemInput, productId?: string): Promise<void> {
  const db = createAdminClient()
  const { data: module, error: moduleError } = await db.from('modules').select('product_id, required_level').eq('id', input.moduleId).maybeSingle()
  if (moduleError) throw moduleError
  if (!module || (productId && module.product_id !== productId)) throw new Error('Módulo inválido para este produto.')
  if (module.required_level === 'complete' && isLegacyPublicFileUrl(input.url, env.supabaseUrl)) {
    throw new Error('Reenvie este arquivo para o armazenamento privado antes de salvar em um módulo Completo.')
  }
  const row = { title: input.title, kind: input.kind, url: input.url, cover_url: input.coverUrl, is_published: input.isPublished, updated_at: now() }
  const { error } = input.id
    ? await db.from('items').update(row).eq('id', input.id).eq('module_id', input.moduleId)
    : await db.from('items').insert({ ...row, module_id: input.moduleId, sort_order: await nextSortOrder('items', 'module_id', input.moduleId) })
  if (error) throw error
}

export async function deleteItem(id: string, productId: string): Promise<void> {
  const { error } = await createAdminClient().rpc('delete_item_scoped_atomic', {
    p_item_id: id,
    p_product_id: productId,
  })
  if (error) throw error
}

export async function moveItem(id: string, moduleId: string, productId: string, direction: 'up' | 'down'): Promise<void> {
  const { error } = await createAdminClient().rpc('move_item_scoped_atomic', {
    p_item_id: id,
    p_module_id: moduleId,
    p_product_id: productId,
    p_direction: direction,
  })
  if (error) throw error
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

export async function createItemUpload(name: string, size: number): Promise<ItemUploadTicket> {
  const validationError = validateItemUpload(name, size)
  if (validationError) throw new Error(validationError)
  const path = `${crypto.randomUUID()}/${itemUploadFilename(name)}`
  const bucket = createAdminClient().storage.from(PRIVATE_FILES_BUCKET)
  const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false })
  if (error || !data?.token) throw new Error('Não foi possível preparar o envio do arquivo. Tente novamente.')
  return {
    path,
    token: data.token,
    bucket: PRIVATE_FILES_BUCKET,
    publicUrl: privateFileUrl(env.supabaseUrl, path),
    supabaseUrl: env.supabaseUrl,
    publishableKey: env.supabasePublishableKey,
  }
}

export type AdminOffer = { id: string; name: string; paytProductCode: string; productIds: string[]; productLevels?: Record<string, AccessLevel> }

type DbOffer = { id: string; name: string; payt_product_code: string; offer_products: { product_id: string; grant_level?: AccessLevel }[] }

const OFFER_COLUMNS = 'id, name, payt_product_code, offer_products(product_id, grant_level)'

function toOffer(row: DbOffer): AdminOffer {
  return { id: row.id, name: row.name, paytProductCode: row.payt_product_code, productIds: row.offer_products.map((p) => p.product_id), productLevels: Object.fromEntries(row.offer_products.map((p) => [p.product_id, p.grant_level ?? 'complete'])) }
}

export async function listOffers(storeId: string): Promise<AdminOffer[]> {
  const { data, error } = await createAdminClient().from('offers').select(`${OFFER_COLUMNS}, offer_groups(name)`).eq('store_id', storeId).order('name')
  if (error) throw error
  return (data as unknown as (DbOffer & { offer_groups: { name: string } | null })[]).map(row => ({
    ...toOffer(row), name: row.offer_groups ? `${row.offer_groups.name} — ${row.name}` : row.name,
  }))
}

export async function getOffer(id: string, storeId: string): Promise<AdminOffer | null> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('id', id).eq('store_id', storeId).maybeSingle()
  if (error) throw error
  return data ? toOffer(data as DbOffer) : null
}

export async function saveOffer(input: OfferInput): Promise<void> {
  if (input.productIds.length === 0) throw new Error('Selecione ao menos um produto para a oferta.')
  const grants = input.productIds.map((productId) => {
    const level = input.productLevels?.[productId] ?? 'complete'
    if (level !== 'basic' && level !== 'complete') throw new Error('Nível de acesso inválido na oferta.')
    return { product_id: productId, grant_level: level }
  })
  const { error } = await createAdminClient().rpc('save_offer_levels_atomic', {
    p_id: input.id,
    p_store_id: input.storeId,
    p_name: input.name,
    p_product_code: input.paytProductCode,
    p_grants: grants,
  })
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new Error('A migração de persistência administrativa ainda não foi aplicada. A oferta não foi salva.')
  }
  if (error) throw friendly(error, 'Este código da Payt já está em outra oferta.')
}
