import type { ModuleWithItems, Product } from '@/lib/domain/types'
import type { AdminOffer } from '@/lib/data/products-admin'
import { assessProductReadiness } from '@/lib/access/product-readiness'
import { ui } from './ui'

export function ProductReadinessNotice({ product, modules, offers }: { product: Product; modules: ModuleWithItems[]; offers: AdminOffer[] }) {
  const levels = [...new Set(offers.filter((offer) => offer.productIds.includes(product.id)).map((offer) => offer.productLevels?.[product.id] ?? 'complete'))]
  const readiness = assessProductReadiness({ mode: product.contentMode ?? 'sections', modules, offeredLevels: levels })
  return <aside aria-label="Conferência da entrega" className={`${ui.card} p-4 text-sm`}>
    <h2 className="font-semibold">Conferência da entrega</h2>
    <p className="mt-2 text-texto-suave">Materiais publicados e utilizáveis: Básico {readiness.itemCounts.basic} · Completo {readiness.itemCounts.complete}.</p>
    <p className="mt-2 text-texto-suave">{product.contentMode === 'versions' ? 'Quem compra Completo vê somente Completo. Inclua nessa versão tudo o que a oferta promete.' : 'Em seções, Completo inclui os materiais do Básico e os exclusivos.'}</p>
    {readiness.emptyLevels.length > 0 && <p role="status" className="mt-3 font-semibold text-destaque">Atenção: há oferta vinculada sem material utilizável em {readiness.emptyLevels.map((level) => level === 'basic' ? 'Básico' : 'Completo').join(' e ')}. Compras existentes foram preservadas; revise a entrega antes de continuar vendendo.</p>}
    <p className="mt-2 text-texto-suave">Para retirar um material problemático, despublique-o e salve. Confira esta contagem depois e ajuste a oferta ou publique uma substituição se a versão ficar vazia.</p>
  </aside>
}
