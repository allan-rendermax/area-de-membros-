import { ui } from '@/components/admin/ui'
import type { AdminOffer } from '@/lib/data/products-admin'
import type { Product } from '@/lib/domain/types'
import { salvarOferta } from './actions'

export function OfferForm({ offer, products, initialCode }: { offer: AdminOffer | null; products: Product[]; initialCode: string }) {
  return (
    <form action={salvarOferta} className={`${ui.card} flex max-w-xl flex-col gap-4 p-5`}>
      <input type="hidden" name="id" value={offer?.id ?? ''} />
      <label className={ui.label}>Nome (ex.: Plano Completo)<input name="name" required defaultValue={offer?.name} className={ui.input} /></label>
      <label className={ui.label}>
        Código do produto na Payt
        <input name="payt_product_code" required readOnly={Boolean(offer)} defaultValue={offer?.paytProductCode ?? initialCode} className={ui.input} />
        {offer && <span className="text-sm text-texto-suave">Para usar outro código, cadastre uma nova oferta.</span>}
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-texto-suave">Produtos liberados</legend>
        {products.map((p) => (
          <label key={p.id} className={ui.checkbox}>
            <input type="checkbox" name="product_ids" value={p.id} defaultChecked={offer?.productIds.includes(p.id)} />
            {p.title}
          </label>
        ))}
        {products.length === 0 && <p className="text-sm text-texto-suave">Cadastre produtos nesta loja primeiro.</p>}
      </fieldset>
      <button type="submit" className={`${ui.button} self-start`}>Salvar</button>
    </form>
  )
}
