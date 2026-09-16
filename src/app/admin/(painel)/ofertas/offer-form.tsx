import type { Offer } from '@/lib/data/catalog'
import type { Material } from '@/lib/domain/types'
import { salvarOferta } from './actions'

const field = 'flex flex-col gap-1 text-sm font-medium'
const input = 'rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal'

export function OfferForm({ offer, materials }: { offer: Offer | null; materials: Material[] }) {
  return (
    <form action={salvarOferta} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={offer?.id ?? ''} />
      <label className={field}>Nome (ex.: Plano Completo)<input name="name" required defaultValue={offer?.name} className={input} /></label>
      <label className={field}>Código do produto na Payt<input name="payt_product_code" required defaultValue={offer?.paytProductCode} className={input} /></label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Materiais liberados</legend>
        {materials.map((m) => (
          <label key={m.id} className="flex items-center gap-2">
            <input type="checkbox" name="material_ids" value={m.id} defaultChecked={offer?.materialIds.includes(m.id)} />
            {m.title}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="self-start rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white">Salvar</button>
    </form>
  )
}
