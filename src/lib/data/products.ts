import type { AccessLevel, Item, ItemKind, Module, ModuleWithItems, Product, ProductLink, ProductRole, StoreRef } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'

export const PRODUCT_COLUMNS =
  'id, store_id, slug, title, track, description, cover_url, banner_url, checkout_url, upgrade_checkout_url, student_checkout_url, role, is_featured, sort_order, is_published'
export const MODULE_COLUMNS = 'id, product_id, title, required_level, sort_order, is_published'
export const ITEM_COLUMNS = 'id, module_id, title, kind, url, cover_url, sort_order, is_published'

export type DbProduct = {
  id: string
  store_id: string
  slug: string
  title: string
  track: string
  description: string
  cover_url: string | null
  banner_url: string | null
  checkout_url: string | null
  upgrade_checkout_url?: string | null
  role: ProductRole
  student_checkout_url: string | null
  is_featured: boolean
  sort_order: number
  is_published: boolean
}

export type DbModule = { id: string; product_id: string; title: string; required_level?: AccessLevel; sort_order: number; is_published: boolean }

export type DbItem = {
  id: string
  module_id: string
  title: string
  kind: ItemKind
  url: string
  cover_url: string | null
  sort_order: number
  is_published: boolean
}

export function toProduct(row: DbProduct): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    slug: row.slug,
    title: row.title,
    track: row.track,
    description: row.description,
    coverUrl: row.cover_url,
    bannerUrl: row.banner_url,
    checkoutUrl: row.checkout_url,
    upgradeCheckoutUrl: row.upgrade_checkout_url ?? null,
    role: row.role,
    studentCheckoutUrl: row.student_checkout_url ?? null,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export function toModule(row: DbModule): Module {
  return { id: row.id, productId: row.product_id, title: row.title, requiredLevel: row.required_level ?? 'basic', sortOrder: row.sort_order, isPublished: row.is_published }
}

export function toItem(row: DbItem): Item {
  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    kind: row.kind,
    url: row.url,
    coverUrl: row.cover_url,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
  }
}

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await createAdminClient()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('store_id', storeId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data as DbProduct[]).map(toProduct)
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await createAdminClient().from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toProduct(data as DbProduct) : null
}

export async function getProductBySlug(storeId: string, slug: string): Promise<Product | null> {
  const { data, error } = await createAdminClient()
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('store_id', storeId)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? toProduct(data as DbProduct) : null
}

export async function listModulesWithItems(productId: string, opts: { publishedOnly: boolean }): Promise<ModuleWithItems[]> {
  const db = createAdminClient()
  let query = db
    .from('modules')
    .select(`${MODULE_COLUMNS}, items(${ITEM_COLUMNS})`)
    .eq('product_id', productId)
    .order('sort_order')
    .order('created_at')
    .order('sort_order', { referencedTable: 'items' })
    .order('created_at', { referencedTable: 'items' })
  if (opts.publishedOnly) query = query.eq('is_published', true).eq('items.is_published', true)
  const { data, error } = await query
  if (error) throw error
  type DbModuleWithItems = DbModule & { items: DbItem[] }
  return (data as DbModuleWithItems[])
    .filter((row) => !opts.publishedOnly || row.is_published)
    .map((row) => ({
      ...toModule(row),
      items: row.items.map(toItem).filter((child) => !opts.publishedOnly || child.isPublished),
    }))
}

export async function getItemWithContext(itemId: string): Promise<{ item: Item; module: Module; product: Product } | null> {
  type DbItemContext = DbItem & { modules: (DbModule & { products: DbProduct | null }) | null }
  const { data, error } = await createAdminClient()
    .from('items')
    .select(`${ITEM_COLUMNS}, modules(${MODULE_COLUMNS}, products(${PRODUCT_COLUMNS}))`)
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw error
  const row = data as DbItemContext | null
  if (!row?.modules?.products) return null
  return { item: toItem(row), module: toModule(row.modules), product: toProduct(row.modules.products) }
}

export async function listPublishedItemsInModule(moduleId: string): Promise<Item[]> {
  const { data, error } = await createAdminClient()
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('module_id', moduleId)
    .eq('is_published', true)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data as DbItem[]).map(toItem)
}

export async function getProductLinks(storeId: string): Promise<ProductLink[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('payt_product_code, offer_products(product_id, grant_level)')
    .eq('store_id', storeId)
  if (error) throw error
  return data.flatMap((offer) =>
    (offer.offer_products as { product_id: string; grant_level?: AccessLevel }[]).map((link) => ({
      productCode: offer.payt_product_code as string,
      productId: link.product_id,
      grantLevel: link.grant_level ?? 'complete',
    })),
  )
}

export async function findStoreForProductCode(code: string): Promise<StoreRef | null> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('stores(id, slug, name)')
    .eq('payt_product_code', code)
    .maybeSingle()
  if (error) throw error
  return (data?.stores as unknown as StoreRef | null) ?? null
}

export async function getProductsForCode(code: string): Promise<{ id: string; title: string }[]> {
  const { data, error } = await createAdminClient()
    .from('offers')
    .select('offer_products(products(id, title, sort_order, is_published))')
    .eq('payt_product_code', code)
    .maybeSingle()
  if (error) throw error
  if (!data) return []

  type Linked = { id: string; title: string; sort_order: number; is_published: boolean }
  return (data.offer_products as unknown as { products: Linked | null }[])
    .map((row) => row.products)
    .filter((p): p is Linked => p !== null && p.is_published)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ id: p.id, title: p.title }))
}
