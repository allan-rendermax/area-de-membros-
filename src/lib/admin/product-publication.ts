import type { AccessLevel, ContentMode } from '@/lib/domain/types'
import type { OfferInput } from './forms'
import { assessProductReadiness } from '@/lib/access/product-readiness'
import { getProductById, listModulesWithItems } from '@/lib/data/products'
import { getOffer, listOffers } from '@/lib/data/products-admin'

function requireReady(title: string, emptyLevels: AccessLevel[]) {
  if (emptyLevels.length) throw new Error(`${title}: publique ao menos um material válido em ${emptyLevels.map((level) => level === 'basic' ? 'Básico' : 'Completo').join(' e ')} antes de comercializar esse acesso.`)
}

export async function assertProductPublicationReady(input: { productId?: string; storeId: string; isPublished: boolean; mode?: ContentMode }): Promise<void> {
  if (!input.isPublished) return
  if (!input.productId) throw new Error('Salve como rascunho, adicione os materiais e depois publique o produto.')
  const product = await getProductById(input.productId)
  if (!product || product.storeId !== input.storeId) throw new Error('Produto inválido para esta loja.')
  const mode = input.mode ?? 'sections'
  // Existing commercial configurations remain editable; the editor surfaces a warning.
  if (product.isPublished && (product.contentMode ?? 'sections') === mode) return
  const [modules, offers] = await Promise.all([
    listModulesWithItems(product.id, { publishedOnly: false }), listOffers(input.storeId),
  ])
  const offeredLevels = [...new Set(offers.filter((offer) => offer.productIds.includes(product.id)).map((offer) => offer.productLevels?.[product.id] ?? 'complete'))]
  const readiness = assessProductReadiness({ mode, modules, offeredLevels })
  requireReady(product.title, readiness.emptyLevels)
  if (!readiness.itemCounts.basic && !readiness.itemCounts.complete) throw new Error('Publique ao menos um material válido antes de publicar o produto. Você pode salvar como rascunho.')
}

export async function assertOfferProductsReady(input: OfferInput): Promise<void> {
  const previous = input.id ? await getOffer(input.id, input.storeId) : null
  if (input.id && !previous) throw new Error('Oferta inválida para esta loja.')
  await Promise.all(input.productIds.map(async (productId) => {
    const product = await getProductById(productId)
    if (!product || product.storeId !== input.storeId) throw new Error('Produto inválido para esta loja.')
    const level = input.productLevels?.[productId] ?? 'complete'
    if (previous?.productIds.includes(productId) && (previous.productLevels?.[productId] ?? 'complete') === level) return
    if (!product.isPublished) throw new Error(`${product.title}: publique o produto antes de vinculá-lo a uma nova oferta.`)
    const modules = await listModulesWithItems(productId, { publishedOnly: false })
    requireReady(product.title, assessProductReadiness({ mode: product.contentMode ?? 'sections', modules, offeredLevels: [level] }).emptyLevels)
  }))
}
