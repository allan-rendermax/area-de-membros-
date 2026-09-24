import { ui } from '@/components/admin/ui'
import type { AdminOffer } from '@/lib/data/products-admin'
import type { Product } from '@/lib/domain/types'
import { salvarOferta } from './actions'

export function OfferForm({ offer, products, initialCode, storeId }: { offer: AdminOffer | null; products: Product[]; initialCode: string; storeId: string }) {
  return (
    <form action={salvarOferta} className={`${ui.card} flex max-w-xl flex-col gap-4 p-5`}>
      <input type="hidden" name="id" value={offer?.id ?? ''} />
      <input type="hidden" name="store_id" value={storeId} />
      <label className={ui.label}>Nome (ex.: Plano Completo)<input name="name" required defaultValue={offer?.name} className={ui.input} /></label>
      <label className={ui.label}>
        Código do produto na Payt
        <input name="payt_product_code" required readOnly={Boolean(offer)} defaultValue={offer?.paytProductCode ?? initialCode} className={ui.input} />
        {offer && <span className="text-sm text-texto-suave">Para usar outro código, cadastre uma nova oferta.</span>}
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-texto-suave">Produtos liberados</legend>
        {products.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borda p-2">
            <label className={ui.checkbox}>
              <input type="checkbox" name="product_ids" value={p.id} defaultChecked={offer?.productIds.includes(p.id)} />
              {p.title}
            </label>
            <select name={`grant_level_${p.id}`} aria-label={`Nível liberado para ${p.title}`} defaultValue={offer?.productLevels?.[p.id] ?? 'complete'} className={ui.input}>
              <option value="basic">Básico</option>
              <option value="complete">Completo</option>
            </select>
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-texto-suave">Cadastre produtos nesta loja primeiro.</p>}
      </fieldset>
      <p className="text-sm text-texto-suave">Alterar o nível de uma oferta também muda o acesso de quem já comprou essa oferta.</p>
      <button type="submit" className={`${ui.button} self-start`}>Salvar</button>
    </form>
  )
}
