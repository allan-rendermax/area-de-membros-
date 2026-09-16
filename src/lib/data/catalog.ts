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
