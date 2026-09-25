'use client'

import { createClient } from '@supabase/supabase-js'
import { startTransition, useActionState, useRef, useState } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { initialProductFormState, productFormError } from '@/lib/admin/product-form-state'
import { materialTitle } from '@/lib/content/material-title'
import { ui } from '@/components/admin/ui'
import { preserveFormFields } from '@/components/admin/preserve-form-fields'
import type { Item } from '@/lib/domain/types'
import { validateItemUpload } from '@/lib/admin/item-upload'
import { prepararUploadArquivo, salvarItem } from './actions'

type UploadStage = 'idle' | 'preparing' | 'sending' | 'done'

export function ItemFields({ moduleId, productId, productTitle, item }: { moduleId: string; productId: string; productTitle: string; item?: Item }) {
  const [title, setTitle] = useState(materialTitle(item?.title, productTitle))
  const [kind, setKind] = useState(item?.kind ?? 'arquivo')
  const [cover, setCover] = useState(item?.coverUrl ?? '')
  const [published, setPublished] = useState(item?.isPublished ?? true)
  const [url, setUrl] = useState(item?.url ?? '')
  const [stage, setStage] = useState<UploadStage>('idle')
  const [error, setError] = useState('')
  const [retryFile, setRetryFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadInFlight = useRef(false)
  const uploading = stage === 'preparing' || stage === 'sending'
  const [state, saveAction, saving] = useActionState(async (_previous: typeof initialProductFormState, form: FormData) => {
    try {
      const result = await salvarItem(form)
      if (result.status === 'saved') {
        setStage('idle'); setError(''); setRetryFile(null)
        if (!item) {
          setTitle(materialTitle(undefined, productTitle)); setKind('arquivo'); setCover(''); setPublished(true); setUrl('')
        }
      }
      return result
    } catch (error) { unstable_rethrow(error); return productFormError(error) }
  }, initialProductFormState)

  function upload(file: File) {
    if (uploadInFlight.current) return
    const validationError = validateItemUpload(file.name, file.size)
    setError(validationError ?? '')
    setStage('idle')
    setRetryFile(validationError ? null : file)
    if (validationError) return

    uploadInFlight.current = true
    setStage('preparing')
    startTransition(() => {
      void (async () => {
        try {
          const result = await prepararUploadArquivo(productId, file.name, file.size)
          if (result.error || !result.data) {
            setError(result.error ?? 'Não foi possível preparar o envio do arquivo. Tente novamente.')
            setStage('idle')
            return
          }
          setStage('sending')
          const { path, token, publicUrl, supabaseUrl, publishableKey, bucket } = result.data
          const supabase = createClient(supabaseUrl, publishableKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          })
          const { error: storageError } = await supabase.storage.from(bucket ?? 'arquivos').uploadToSignedUrl(path, token, file)
          if (storageError) {
            setError('Não foi possível enviar o arquivo. Tente novamente.')
            setStage('idle')
            return
          }
          setUrl(publicUrl)
          setRetryFile(null)
          setStage('done')
        } catch {
          setError('Não foi possível enviar o arquivo. Tente novamente.')
          setStage('idle')
        } finally {
          uploadInFlight.current = false
        }
      })()
    })
  }

  return (
    <form ref={preserveFormFields} action={saveAction}
      onSubmit={(event) => { if (uploadInFlight.current || saving) event.preventDefault() }}
      className="grid gap-3 sm:grid-cols-2">
      {state?.message && <p role={state.status === 'error' ? 'alert' : 'status'} className={`${ui.notice} sm:col-span-2`}>{state.message}{state.status === 'error' && ' Suas alterações continuam no formulário.'}</p>}
      <input type="hidden" name="id" value={item?.id ?? ''} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input type="hidden" name="product_id" value={productId} />
      <label className={ui.label}>Nome do material
        <input name="title" required value={title} onChange={event => setTitle(event.target.value)} disabled={saving} className={ui.input} />
        <span className="text-xs font-normal text-texto-suave">Por padrão, usamos o nome do produto. Você pode editar o nome visível no cartão e na lista de conteúdos.</span>
      </label>
      <label className={ui.label}>
        Tipo
        <select name="kind" value={kind} onChange={event => setKind(event.target.value as typeof kind)} disabled={saving} className={ui.input}>
          <option value="arquivo">Arquivo para download (PDF, ZIP…)</option>
          <option value="video">Vídeo (YouTube, Vimeo, Panda)</option>
          <option value="link">Link externo (Drive, site, versão editável)</option>
        </select>
      </label>
      <div className="sm:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`${ui.label} min-w-0 flex-1`}>URL do material
            <input name="url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} disabled={saving} aria-invalid={Boolean(state?.fieldErrors.url)} className={`${ui.input} w-full`} />
            {state?.fieldErrors.url && <span role="alert" className="text-sm text-red-600">{state.fieldErrors.url}</span>}
          </label>
          <input ref={fileInput} type="file" accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            aria-label="Arquivo para enviar" className="sr-only"
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (selected) upload(selected)
            }} />
          <button type="button" className={`${ui.buttonGhost} shrink-0`} disabled={uploading || saving} onClick={() => fileInput.current?.click()}>Enviar arquivo</button>
        </div>
        <p className="mt-2 text-xs text-texto-suave">Arquivos enviados aqui ficam privados. Use Link externo para Drive, sites e versões editáveis; esses provedores controlam sua própria proteção.</p>
        {retryFile && !uploading && error && <button type="button" className={`${ui.buttonGhost} mt-2`} onClick={() => upload(retryFile)}>Tentar novamente</button>}
        {uploading && <div role="status" aria-live="polite" className="mt-2 text-sm text-texto-suave">
          {stage === 'preparing' ? 'Preparando envio…' : 'Enviando arquivo…'}
          <progress aria-label="Progresso do envio" className="ml-2" />
        </div>}
        {stage === 'done' && <p role="status" className="mt-2 text-sm text-texto-suave">Arquivo enviado. Confira o Link antes de salvar.</p>}
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
      <label className={`${ui.label} sm:col-span-2`}>
        Capa (opcional, link de imagem)
        <input name="cover_url" type="url" value={cover} onChange={event => setCover(event.target.value)} disabled={saving} className={ui.input} />
      </label>
      <label className={ui.checkbox}>
        <input name="is_published" type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)} disabled={saving} /> Publicado
      </label>
      <button type="submit" disabled={uploading || saving} aria-label={`Salvar material ${title}`} className={`${ui.button} justify-self-start disabled:opacity-40`}>{saving ? 'Salvando…' : item ? 'Salvar item' : 'Adicionar item'}</button>
    </form>
  )
}
