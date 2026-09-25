'use client'

import { useActionState, useRef, useState } from 'react'
import { ui } from '@/components/admin/ui'
import type { OfferPlanInput } from '@/lib/admin/offer-groups'
import type { AdminOfferGroup } from '@/lib/data/offer-groups'
import type { AccessLevel, Product } from '@/lib/domain/types'
import { salvarGrupoOferta } from './group-actions'

type DraftPlan = OfferPlanInput & { key: string }
const newPlan = (key: string, name: string, code = ''): DraftPlan => ({ key, id: null, name, paytProductCode: code, grants: [] })

export function OfferGroupForm({ offer, products, initialCode, storeId }: {
  offer: AdminOfferGroup | null; products: Product[]; initialCode: string; storeId: string
}) {
  const [state, action, pending] = useActionState(salvarGrupoOferta, { error: null })
  const [name, setName] = useState(offer?.name ?? '')
  const [plans, setPlans] = useState<DraftPlan[]>(() => offer
    ? offer.plans.map(p => ({ ...p, key: p.id! }))
    : initialCode ? [newPlan('initial', 'Completo', initialCode)]
      : [newPlan('basic', 'Básico'), newPlan('complete', 'Completo')])
  const [removing, setRemoving] = useState<string | null>(null)
  const [removedPlans, setRemovedPlans] = useState<DraftPlan[]>([])
  const nextKey = useRef(0)

  function update(key: string, patch: Partial<OfferPlanInput>) {
    setPlans(current => current.map(p => p.key === key ? { ...p, ...patch } : p))
  }
  function setGrant(plan: DraftPlan, productId: string, level: string) {
    const grants = plan.grants.filter(g => g.productId !== productId)
    if (level) grants.push({ productId, level: level as AccessLevel })
    update(plan.key, { grants })
  }

  return <form action={action} className="flex max-w-4xl flex-col gap-5">
    <input type="hidden" name="id" value={offer?.id ?? ''} />
    <input type="hidden" name="store_id" value={storeId} />
    <input type="hidden" name="version" value={offer?.version ?? 0} />
    <input type="hidden" name="plans" value={JSON.stringify(plans.map(p => ({ id: p.id, name: p.name, paytProductCode: p.paytProductCode, grants: p.grants })))} />
    <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5 disabled:opacity-70">
      <div className={`${ui.card} p-5`}>
        <label className={ui.label}>Nome da oferta
          <input name="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Atlas Patologias" className={`${ui.input} w-full`} />
        </label>
        <p className="mt-2 text-sm text-texto-suave">Reúna os planos deste produto ou combo em um único cadastro.</p>
      </div>

      <div>
        <h2 className="font-semibold">Planos da oferta</h2>
        <p className="mt-1 text-sm text-texto-suave">Cada plano tem seu próprio ID Payt e define quais produtos libera.</p>
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
        <h4 className="mb-2 mt-5 text-sm font-medium">O que este plano libera</h4>
        <div className="flex flex-col gap-2">
          {products.map(product => <label key={product.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-borda p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words text-sm">{product.title}</span>
            <select name={`grant_${index}_${product.id}`} value={plan.grants.find(g => g.productId === product.id)?.level ?? ''} onChange={e => setGrant(plan, product.id, e.target.value)} aria-label={`Acesso a ${product.title} no plano ${index + 1}`} className={`${ui.input} sm:w-40 sm:shrink-0`}>
              <option value="">Não liberar</option>
              <option value="basic">Básico</option>
              <option value="complete">Completo</option>
            </select>
          </label>)}
          {products.length === 0 && <p className="text-sm text-texto-suave">Cadastre produtos nesta loja primeiro.</p>}
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
