import type { Material, OfferLink } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

type DbMaterial = {
  id: string
  title: string
  description: string
  cover_url: string | null
  download_url: string
  checkout_url: string | null
  sort_order: number
  is_published: boolean
}

const MATERIAL_COLUMNS = 'id, title, description, cover_url, download_url, checkout_url, sort_order, is_published'

export function toMaterial(row: DbMaterial): Material {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.cover_url,
    downloadUrl: row.download_url,
    checkoutUrl: row.checkout_url,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export async function listMaterials(storeId: string): Promise<Material[]> {
  const { data, error } = await createAdminClient()
    .from('materials')
    .select(MATERIAL_COLUMNS)
    .eq('store_id', storeId)
    .order('sort_order')
  if (error) throw error
  return data.map(toMaterial)
}

export async function getOfferLinks(storeId: string): Promise<OfferLink[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('payt_product_code, offer_materials(material_id)')
    .eq('store_id', storeId)
  if (error) throw error
  return data.flatMap((offer) =>
    (offer.offer_materials as { material_id: string }[]).map((m) => ({
      productCode: offer.payt_product_code,
      materialId: m.material_id,
    })),
  )
}

export async function getMaterial(id: string): Promise<Material | null> {
  const { data, error } = await createAdminClient().from('materials').select(MATERIAL_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toMaterial(data) : null
}

export type MaterialInput = {
  id: string | null
  storeId: string
  title: string
  description: string
  coverUrl: string | null
  downloadUrl: string
  checkoutUrl: string | null
  sortOrder: number
  isPublished: boolean
}

export async function saveMaterial(input: MaterialInput): Promise<void> {
  const row = {
    store_id: input.storeId,
    title: input.title,
    description: input.description,
    cover_url: input.coverUrl,
    download_url: input.downloadUrl,
    checkout_url: input.checkoutUrl,
    sort_order: input.sortOrder,
    is_published: input.isPublished,
    updated_at: new Date().toISOString(),
  }
  const db = createAdminClient()
  const { error } = input.id
    ? await db.from('materials').update(row).eq('id', input.id)
    : await db.from('materials').insert(row)
  if (error) throw error
}

export async function uploadCover(file: File): Promise<string> {
  const db = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('covers').upload(path, file, { contentType: file.type })
  if (error) throw error
  return db.storage.from('covers').getPublicUrl(path).data.publicUrl
}

export type Offer = { id: string; name: string; paytProductCode: string; materialIds: string[] }

type DbOffer = { id: string; name: string; payt_product_code: string; offer_materials: { material_id: string }[] }

function toOffer(row: DbOffer): Offer {
  return {
    id: row.id,
    name: row.name,
    paytProductCode: row.payt_product_code,
    materialIds: row.offer_materials.map((m) => m.material_id),
  }
}

const OFFER_COLUMNS = 'id, name, payt_product_code, offer_materials(material_id)'

export async function listOffers(storeId: string): Promise<Offer[]> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('store_id', storeId).order('name')
  if (error) throw error
  return (data as DbOffer[]).map(toOffer)
}

export async function getOffer(id: string): Promise<Offer | null> {
  const { data, error } = await createAdminClient().from('offers').select(OFFER_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toOffer(data as DbOffer) : null
}

export async function saveOffer(input: {
  id: string | null
  storeId: string
  name: string
  paytProductCode: string
  materialIds: string[]
}): Promise<void> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!input.materialIds.every((id) => uuid.test(id))) throw new Error('Material inválido')

  const db = createAdminClient()
  const row = { store_id: input.storeId, name: input.name, payt_product_code: input.paytProductCode }

  let offerId = input.id
  if (offerId) {
    const { error } = await db.from('offers').update(row).eq('id', offerId)
    if (error) throw error
  } else {
    const { data, error } = await db.from('offers').insert(row).select('id').single()
    if (error) throw error
    offerId = data.id as string
  }

  // Grava os vínculos novos antes de remover os desmarcados: se algo falhar no meio,
  // quem já comprou nunca perde acesso a um material que continua na oferta.
  if (input.materialIds.length) {
    const { error: upsertError } = await db
      .from('offer_materials')
      .upsert(
        input.materialIds.map((materialId) => ({ offer_id: offerId, material_id: materialId })),
        { onConflict: 'offer_id,material_id', ignoreDuplicates: true },
      )
    if (upsertError) throw upsertError
  }

  let removal = db.from('offer_materials').delete().eq('offer_id', offerId)
  if (input.materialIds.length) removal = removal.not('material_id', 'in', `(${input.materialIds.join(',')})`)
  const { error: deleteError } = await removal
  if (deleteError) throw deleteError
}
