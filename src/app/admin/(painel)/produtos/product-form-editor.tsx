'use client'

import { useActionState, useRef, useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { preserveFormFields } from '@/components/admin/preserve-form-fields'
import { ProductImageInput } from '@/components/admin/product-image-input'
import { initialProductFormState, productFormError } from '@/lib/admin/product-form-state'
import { IMAGE_FIELDS, type ProductImageSlot } from '@/lib/admin/product-image-upload'
import type { Product } from '@/lib/domain/types'
import { salvarProdutoComEstado } from './actions'
import { LockedProductFields } from './locked-product-fields'
import { UpgradeFields } from './upgrade-fields'
import type { ProductFormProps } from './product-form'

const fields = { title: 'title', description: 'description', checkout_url: 'checkoutUrl', student_checkout_url: 'studentCheckoutUrl', purchase_title: 'purchaseTitle', purchase_description: 'purchaseDescription', purchase_button_text: 'purchaseButtonText', upgrade_checkout_url: 'upgradeCheckoutUrl', upgrade_button_text: 'upgradeButtonText' } as const
const imageProperties = { cover: 'coverUrl', banner: 'bannerUrl', purchase: 'purchaseImageUrl', upgrade: 'upgradeImageUrl' } as const

export function ProductFormEditor({ product, tracks, storeId, storeSlug = '', supportUrl, upgradeSectionName }: ProductFormProps) {
  const [dirty, setDirty] = useState(false)
  const [state, action, saving] = useActionState(async (previous: typeof initialProductFormState, form: FormData) => {
    try {
      const result = await salvarProdutoComEstado(previous, form)
      if (result.status === 'saved') setDirty(false)
      return result
    } catch (error) { unstable_rethrow(error); return productFormError(error) }
  }, initialProductFormState)
  const [draft, setDraft] = useState<Product>(() => product ?? { id: 'novo-produto', storeId, title: '', slug: '', description: '', track: '', coverUrl: null, bannerUrl: null, checkoutUrl: null, role: 'front', isFeatured: false, isPublished: false, sortOrder: 0 })
  const [values, setValues] = useState<Record<string, string>>({ track: product?.track ?? '', slug: product?.slug ?? '', role: product?.role ?? 'front', content_mode: product?.contentMode ?? 'auto', sort_order: String(product?.sortOrder ?? 0) })
  const [checks, setChecks] = useState({ is_featured: product?.isFeatured ?? false, is_published: product?.isPublished ?? false })
  const [uploading, setUploading] = useState(false)
  const pendingSlots = useRef(new Set<ProductImageSlot>())
  const busy = saving || uploading
  const fieldError = (name: string) => state.fieldErrors[name] ? <p id={`${name}-error`} role="alert" className="text-sm text-red-600">{state.fieldErrors[name]}</p> : null
  const imageInput = (slot: ProductImageSlot, label: string, aspect: 'poster' | 'banner' | 'square' = 'square') => <ProductImageInput slot={slot} label={label} aspect={aspect} storeId={storeId} productId={product?.id ?? null} currentUrl={product?.[imageProperties[slot]]} title={draft.title || 'Novo produto'} disabled={saving} fieldError={state.fieldErrors[IMAGE_FIELDS[slot]]}
    onChange={url => { setDraft(current => ({ ...current, [imageProperties[slot]]: url || null })); setDirty(true) }}
    onPending={(key, pending) => { if (pending) pendingSlots.current.add(key); else pendingSlots.current.delete(key); setUploading(pendingSlots.current.size > 0) }} />

  return <form ref={preserveFormFields} action={action} onSubmit={event => { if (saving || pendingSlots.current.size) event.preventDefault() }}
    onChange={event => {
      setDirty(true)
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return
      if (target.name in values) setValues(current => ({ ...current, [target.name]: target.value }))
      if (target instanceof HTMLInputElement && target.type === 'checkbox') setChecks(current => ({ ...current, [target.name]: target.checked }))
      const key = fields[target.name as keyof typeof fields]
      if (key) setDraft(current => ({ ...current, [key]: target.value }))
    }} className={`${ui.card} min-w-0 space-y-8 p-4 sm:p-6`}>
    <input type="hidden" name="id" value={product?.id ?? ''} /><input type="hidden" name="store_id" value={storeId} />
    {state.message && <div role={state.status === 'error' ? 'alert' : 'status'} className={ui.notice}>{state.message}{state.status === 'error' && <p className="mt-1 text-sm">Suas alterações continuam no formulário.</p>}</div>}
    <fieldset disabled={saving} className="min-w-0 space-y-4">
      <legend className="mb-4 text-xl font-bold">Produto</legend>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_1fr]">
        <div className="min-w-0 space-y-5">{imageInput('cover', 'Capa (vertical 2:3) (até 2 MB)', 'poster')}{imageInput('banner', 'Banner (horizontal 16:9) (até 2 MB)', 'banner')}</div>
        <div className="min-w-0 space-y-4">
          <label className={ui.label}>Título<input name="title" required value={draft.title} onChange={() => {}} aria-invalid={Boolean(state.fieldErrors.title)} aria-describedby="title-error" className={ui.input} />{fieldError('title')}</label>
          <label className={ui.label}>Trilha<input name="track" list="product-tracks" value={values.track} onChange={() => {}} className={ui.input} /></label>
          <datalist id="product-tracks">{tracks.map(track => <option key={track} value={track} />)}</datalist>
          <label className={ui.label}>Papel<select name="role" value={values.role} onChange={() => {}} className={ui.input}><option value="front">Front</option><option value="orderbump">Orderbump</option><option value="upsell">Upsell</option></select></label>
          <label className={ui.label}>Organização dos conteúdos<select name="content_mode" value={values.content_mode} onChange={() => {}} className={ui.input}><option value="auto">Automático: Front com versões, complementares com seções</option><option value="versions">Básico e Completo</option><option value="sections">Seções personalizadas (packs, orderbumps, upsells)</option></select><span className="text-sm font-normal text-texto-suave">Em versões, cada cliente vê só o nível comprado. O Completo precisa reunir todos os materiais dessa versão. Em seções, o Completo também inclui o Básico.</span></label>
          <label className={ui.label}>Endereço (vazio = gerado do título)<input name="slug" value={values.slug} onChange={() => {}} aria-invalid={Boolean(state.fieldErrors.slug)} aria-describedby="slug-error" className={ui.input} />{fieldError('slug')}</label>
          <label className={ui.label}>Descrição<textarea name="description" rows={5} value={draft.description} onChange={() => {}} className={ui.input} /></label>
        </div>
      </div>
    </fieldset>
    <LockedProductFields product={product} draft={draft} storeSlug={storeSlug} imageInput={imageInput('purchase', 'Imagem do modal (opcional, até 2 MB)')} fieldErrors={state.fieldErrors} disabled={saving} />
    <UpgradeFields product={product} draft={draft} storeSlug={storeSlug} supportUrl={supportUrl} sectionName={upgradeSectionName} imageInput={imageInput('upgrade', 'Mockup do upgrade (quadrado 1:1, até 2 MB)')} fieldErrors={state.fieldErrors} disabled={saving} />
    <fieldset disabled={saving} className="space-y-4 border-t border-borda pt-5"><legend className="px-2 text-xl font-bold">Publicação</legend>
      <label className={ui.label}>Ordem<input name="sort_order" type="number" value={values.sort_order} onChange={() => {}} className={ui.input} /></label>
      <label className={ui.checkbox}><input name="is_featured" type="checkbox" checked={checks.is_featured} onChange={() => {}} /> Destaque no topo da vitrine</label>
      <label className={ui.checkbox}><input name="is_published" type="checkbox" checked={checks.is_published} onChange={() => {}} /> Publicado</label>
    </fieldset>
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-borda bg-superficie py-3">
      <p role="status" className="text-sm text-texto-suave">{uploading ? 'Enviando imagem…' : saving ? 'Salvando…' : dirty ? 'Alterações não salvas' : product || state.status === 'saved' ? 'Configurações salvas' : 'Novo produto em rascunho'}</p>
      <button type="submit" disabled={busy} className={`${ui.button} min-h-11 disabled:opacity-50`}>{uploading ? 'Enviando imagem…' : saving ? 'Salvando…' : 'Salvar alterações'}</button>
    </div>
  </form>
}
