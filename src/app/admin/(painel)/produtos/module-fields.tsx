'use client'

import { useActionState, useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { preserveFormFields } from '@/components/admin/preserve-form-fields'
import { initialProductFormState, productFormError } from '@/lib/admin/product-form-state'
import { sectionTitle } from '@/lib/access/product-content'
import type { AccessLevel, ContentMode, Module } from '@/lib/domain/types'
import { salvarModulo } from './actions'

export function ModuleFields({ productId, module, contentMode, initialLevel = 'basic', initialTitle = '' }: { productId: string; module?: Module; contentMode?: ContentMode; initialLevel?: AccessLevel; initialTitle?: string }) {
  const [title, setTitle] = useState(module ? sectionTitle(module.title, module.requiredLevel, contentMode) : initialTitle)
  const [level, setLevel] = useState(module?.requiredLevel ?? initialLevel)
  const [published, setPublished] = useState(module?.isPublished ?? true)
  const [state, action, pending] = useActionState(async (_previous: typeof initialProductFormState, form: FormData) => {
    try {
      const result = await salvarModulo(form)
      if (result.status === 'saved' && !module) {
        setTitle(''); setLevel(initialLevel); setPublished(true)
      }
      return result
    } catch (error) { unstable_rethrow(error); return productFormError(error) }
  }, initialProductFormState)
  return <form ref={preserveFormFields} action={action} onSubmit={event => { if (pending) event.preventDefault() }} className={module ? 'flex flex-1 flex-wrap items-end gap-3' : `${ui.card} flex flex-wrap items-end gap-3 p-4`}>
    <input type="hidden" name="id" value={module?.id ?? ''} /><input type="hidden" name="product_id" value={productId} />
    {state?.message && <p role={state.status === 'error' ? 'alert' : 'status'} className={`${ui.notice} w-full`}>{state.message}</p>}
    <label className={`${ui.label} min-w-48 flex-1`}>{module ? 'Nome da seção' : 'Nova seção'}<input name="title" required value={title} onChange={event => setTitle(event.target.value)} disabled={pending} placeholder="Ex.: Materiais do pack" className={ui.input} /></label>
    <label className={ui.label}>Acesso<select name="required_level" value={level} onChange={event => setLevel(event.target.value as AccessLevel)} disabled={pending} className={ui.input}><option value="basic">{contentMode === 'versions' ? 'Versão Básico' : 'Incluído no Básico'}</option><option value="complete">{contentMode === 'versions' ? 'Versão Completo' : 'Exclusivo do Completo'}</option></select></label>
    <label className={ui.checkbox}><input name="is_published" type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)} disabled={pending} /> Publicado</label>
    <button type="submit" disabled={pending} className={module ? ui.buttonGhost : ui.button}>{pending ? 'Salvando…' : module ? `Salvar seção ${title}` : 'Criar módulo'}</button>
  </form>
}
