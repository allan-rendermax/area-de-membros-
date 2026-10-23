'use client'

import { useActionState, useRef, useState } from 'react'
import { ui } from '@/components/admin/ui'
import type { OfferPlanInput } from '@/lib/admin/offer-groups'
import type { AdminOfferGroup } from '@/lib/data/offer-groups'
import type { AccessLevel, Product } from '@/lib/domain/types'
import { salvarGrupoOferta } from './group-actions'
import { ProductSelect } from './product-select'

type DraftGrant = OfferPlanInput['grants'][number] & { key: string }
type DraftPlan = Omit<OfferPlanInput, 'grants'> & { key: string; grants: DraftGrant[]; matchType: 'product' | 'checkout' | 'upsell'; checkoutCode: string | null; matchValues: string[] }
const newPlan = (key: string, name: string, code = ''): DraftPlan => ({ key, id: null, name, paytProductCode: code, matchType: 'product', checkoutCode: null, matchValues: [], grants: [] })

export function OfferGroupForm({ offer, products, initialCode, storeId }: {
  offer: AdminOfferGroup | null; products: Product[]; initialCode: string; storeId: string
}) {
  const [state, action, pending] = useActionState(salvarGrupoOferta, { error: null })
  const [name, setName] = useState(offer?.name ?? '')
  const [plans, setPlans] = useState<DraftPlan[]>(() => offer
    ? offer.plans.map(p => ({ ...p, matchType: p.matchType ?? 'product', checkoutCode: p.checkoutCode ?? null, matchValues: p.matchValues ?? [], key: p.id!, grants: p.grants.map(g => ({ ...g, key: g.productId })) }))
    : initialCode ? [newPlan('initial', 'Completo', initialCode)]
      : [newPlan('basic', 'Básico'), newPlan('complete', 'Completo')])
  const [removing, setRemoving] = useState<string | null>(null)
  const [removedPlans, setRemovedPlans] = useState<DraftPlan[]>([])
  const nextKey = useRef(0)

  function update(key: string, patch: Partial<DraftPlan>) {
    setPlans(current => current.map(p => p.key === key ? { ...p, ...patch } : p))
  }
  function updateGrant(plan: DraftPlan, key: string, patch: Partial<Pick<DraftGrant, 'productId' | 'level'>>) {
    if (patch.productId && plan.grants.some(g => g.key !== key && g.productId === patch.productId)) return
    update(plan.key, { grants: plan.grants.map(g => g.key === key ? { ...g, ...patch } : g) })
  }

  return <form action={action} className="flex max-w-4xl flex-col gap-5">
    <input type="hidden" name="id" value={offer?.id ?? ''} />
    <input type="hidden" name="store_id" value={storeId} />
    <input type="hidden" name="version" value={offer?.version ?? 0} />
    <input type="hidden" name="plans" value={JSON.stringify(plans.map(p => ({ id: p.id, name: p.name, paytProductCode: p.paytProductCode, matchType: p.matchType, checkoutCode: p.checkoutCode, matchValues: p.matchValues.map(value => value.trim()).filter(Boolean), grants: p.grants.map(({ productId, level }) => ({ productId, level })) })))} />
    <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5 disabled:opacity-70">
      <div className={`${ui.card} p-5`}>
        <label className={ui.label}>Nome da oferta
          <input name="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Atlas Patologias" className={`${ui.input} w-full`} />
        </label>
        <p className="mt-2 text-sm text-texto-suave">Reúna os planos deste produto ou combo em um único cadastro.</p>
      </div>

      <div>
        <h2 className="font-semibold">Planos da oferta</h2>
        <p className="mt-1 text-sm text-texto-suave">Cada plano define seus produtos e níveis. Para compartilhar um ID Payt, identifique todos os planos desse ID por checkout ou upsell.</p>
      </div>

      {plans.map((plan, index) => <section key={plan.key} data-plan className={`${ui.card} min-w-0 p-4 sm:p-5`} aria-label={`Plano ${index + 1}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Plano {index + 1}</h3>
          <button type="button" disabled={plans.length === 1} className={ui.buttonDanger} onClick={() => setRemoving(plan.key)} aria-label={`Remover plano ${index + 1}`}>Remover plano</button>
        </div>
        {removing === plan.key && <div className={`${ui.notice} mb-4`}>
          <p>Remover este plano da oferta? A remoção será aplicada ao salvar. Planos com pedidos não podem ser removidos.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={ui.buttonDanger} onClick={() => {
              if (plan.id) setRemovedPlans(current => [...current, plan])
              setPlans(current => current.filter(p => p.key !== plan.key))
              setRemoving(null)
            }}>Confirmar remoção</button>
            <button type="button" className={ui.buttonGhost} onClick={() => setRemoving(null)}>Manter plano</button>
          </div>
        </div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={ui.label}>Nome do plano
            <input name={`plan_name_${index}`} required value={plan.name} onChange={e => update(plan.key, { name: e.target.value })} placeholder="Ex.: Básico, Completo, Upgrade, Combo" className={`${ui.input} min-w-0 w-full`} />
          </label>
          <label className={ui.label}>ID do produto na Payt
            <input name={`plan_code_${index}`} required readOnly={Boolean(plan.id)} value={plan.paytProductCode} onChange={e => update(plan.key, { paytProductCode: e.target.value })} spellCheck={false} className={`${ui.input} min-w-0 w-full read-only:opacity-70`} />
            {plan.id && <span className="text-xs font-normal">Para usar outro ID, adicione um plano.</span>}
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={ui.label}>Identificar compra por
            <select name={`plan_match_type_${index}`} value={plan.matchType} disabled={Boolean(plan.id)} onChange={e => update(plan.key, { matchType: e.target.value as DraftPlan['matchType'], matchValues: [] })} className={`${ui.input} w-full`}>
              <option value="product">ID do produto Payt</option>
              <option value="checkout">Link do checkout</option>
              <option value="upsell">Código de upsell</option>
            </select>
          </label>
          {plan.matchType !== 'product' && <label className={ui.label}>Código do checkout (referência opcional)
            <input name={`plan_checkout_code_${index}`} value={plan.checkoutCode ?? ''} readOnly={Boolean(plan.id)} onChange={e => update(plan.key, { checkoutCode: e.target.value })} spellCheck={false} className={`${ui.input} min-w-0 w-full read-only:opacity-70`} />
          </label>}
        </div>
        {plan.matchType !== 'product' && <label className={`${ui.label} mt-4 block`}>
          {plan.matchType === 'checkout' ? 'Links que identificam este plano (um por linha)' : 'Códigos de upsell deste plano (um por linha)'}
          <textarea name={`plan_aliases_${index}`} required rows={3} value={plan.matchValues.join('\n')} onChange={e => update(plan.key, { matchValues: e.target.value.split('\n') })} spellCheck={false} className={`${ui.input} min-w-0 w-full`} />
          <span className="mt-1 block text-xs font-normal text-texto-suave">{plan.matchType === 'checkout' ? 'Cadastre os links curtos payt.site e finais checkout.payt.com.br confirmados nos avisos da Payt. O código de referência sozinho não libera acesso.' : 'Use os identificadores upsell_code confirmados nos avisos da Payt.'} {plan.id ? 'Preserve os aliases salvos; você pode acrescentar outros.' : 'Cada identificador deve pertencer a um único plano deste ID Payt.'}</span>
        </label>}
        {plan.id && <p className="mt-2 text-xs text-texto-suave">O modo, o ID Payt e a referência são fixos após salvar. Para outra identificação, adicione um plano.</p>}
        <h4 className="mb-2 mt-5 text-sm font-medium">O que este plano libera</h4>
        <div className="flex flex-col gap-2">
          {plan.grants.map((grant, rowIndex) => <div key={grant.key} data-grant className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-md border border-borda p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <p className={`${ui.label} mb-1`}>Produto</p>
              <ProductSelect
                key={pending ? 'saving' : 'editing'}
                products={products.filter(product => product.id === grant.productId || !plan.grants.some(g => g.productId === product.id))}
                value={grant.productId} onChange={productId => updateGrant(plan, grant.key, { productId })}
                label={`Produto ${rowIndex + 1} do plano ${index + 1}`} disabled={pending}
              />
            </div>
            <label className={ui.label}>Plano
              <select name={`grant_${index}_${grant.key}`} value={grant.level} onChange={e => updateGrant(plan, grant.key, { level: e.target.value as AccessLevel })} aria-label={`Acesso do produto ${rowIndex + 1} no plano ${index + 1}`} className={`${ui.input} w-full min-w-0`}>
                <option value="basic">Básico</option>
                <option value="complete">Completo</option>
              </select>
            </label>
            <button type="button" className={`${ui.buttonGhost} h-11 w-11 shrink-0 text-lg`} aria-label={`Remover produto ${rowIndex + 1} do plano ${index + 1}`} onClick={() => update(plan.key, { grants: plan.grants.filter(g => g.key !== grant.key) })}>×</button>
          </div>)}
          {products.length === 0 && <p className="text-sm text-texto-suave">Cadastre produtos nesta loja primeiro.</p>}
          {products.length > 0 && plan.grants.length === 0 && <p className="text-sm text-texto-suave">Adicione os produtos que este plano libera.</p>}
          <button type="button" disabled={plan.grants.filter(g => !g.productId || products.some(p => p.id === g.productId)).length >= products.length} className={`${ui.buttonGhost} self-start disabled:opacity-50`} onClick={() => {
            update(plan.key, { grants: [...plan.grants, { key: `grant-${nextKey.current++}`, productId: '', level: 'basic' }] })
          }}>+ Adicionar produto</button>
        </div>
      </section>)}

      {removedPlans.map(plan => <div key={plan.key} className={`${ui.notice} flex flex-wrap items-center justify-between gap-3`}>
        <span className="min-w-0 break-words">{plan.name} será removido ao salvar.</span>
        <button type="button" className={ui.buttonGhost} aria-label={`Restaurar plano ${plan.name}`} onClick={() => {
          setPlans(current => [...current, plan])
          setRemovedPlans(current => current.filter(p => p.key !== plan.key))
        }}>Restaurar plano</button>
      </div>)}
      <button type="button" className={`${ui.buttonGhost} self-start`} onClick={() => {
        const plan = newPlan(`new-${nextKey.current++}`, '')
        setPlans(current => [...current, plan])
      }}>Adicionar plano</button>
      <p className="text-sm text-texto-suave">Alterar as liberações de um plano também muda o acesso de quem já comprou esse plano.</p>
    </fieldset>
    {state.error && <p role="alert" className="rounded-md border border-destaque/50 bg-destaque/10 p-3 text-sm">{state.error}</p>}
    <button type="submit" disabled={pending || products.length === 0 || plans.length === 0} className={`${ui.button} self-start`}>{pending ? 'Salvando…' : 'Salvar oferta'}</button>
  </form>
}
