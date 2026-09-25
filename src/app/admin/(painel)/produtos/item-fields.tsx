'use client'

import { createClient } from '@supabase/supabase-js'
import { startTransition, useRef, useState } from 'react'
import { materialTitle } from '@/lib/content/material-title'
import { ui } from '@/components/admin/ui'
import type { Item } from '@/lib/domain/types'
import { validateItemUpload } from '@/lib/admin/item-upload'
import { prepararUploadArquivo, salvarItem } from './actions'

type UploadStage = 'idle' | 'preparing' | 'sending' | 'done'

export function ItemFields({ moduleId, productId, productTitle, item }: { moduleId: string; productId: string; productTitle: string; item?: Item }) {
  const [url, setUrl] = useState(item?.url ?? '')
  const [stage, setStage] = useState<UploadStage>('idle')
  const [error, setError] = useState('')
  const [retryFile, setRetryFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadInFlight = useRef(false)
  const uploading = stage === 'preparing' || stage === 'sending'

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
    <form action={salvarItem}
      onSubmit={(event) => { if (uploadInFlight.current) event.preventDefault() }}
      className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={item?.id ?? ''} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input type="hidden" name="product_id" value={productId} />
      <label className={ui.label}>Nome do material
        <input name="title" required defaultValue={materialTitle(item?.title, productTitle)} className={ui.input} />
        <span className="text-xs font-normal text-texto-suave">Por padrão, usamos o nome do produto. Você pode editar o nome visível no cartão e na lista de conteúdos.</span>
      </label>
      <label className={ui.label}>
        Tipo
        <select name="kind" defaultValue={item?.kind ?? 'arquivo'} className={ui.input}>
          <option value="arquivo">Arquivo para download (PDF, ZIP…)</option>
          <option value="video">Vídeo (YouTube, Vimeo, Panda)</option>
          <option value="link">Link externo (Drive, site, versão editável)</option>
        </select>
      </label>
      <div className="sm:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className={`${ui.label} min-w-0 flex-1`}>URL do material
            <input name="url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} className={`${ui.input} w-full`} />
          </label>
          <input ref={fileInput} type="file" accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            aria-label="Arquivo para enviar" className="sr-only"
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (selected) upload(selected)
            }} />
          <button type="button" className={`${ui.buttonGhost} shrink-0`} disabled={uploading} onClick={() => fileInput.current?.click()}>Enviar arquivo</button>
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
        <input name="cover_url" type="url" defaultValue={item?.coverUrl ?? ''} className={ui.input} />
      </label>
      <label className={ui.checkbox}>
        <input name="is_published" type="checkbox" defaultChecked={item?.isPublished ?? true} /> Publicado
      </label>
      <button type="submit" disabled={uploading} className={`${ui.button} justify-self-start disabled:opacity-40`}>{item ? 'Salvar item' : 'Adicionar item'}</button>
    </form>
  )
}
