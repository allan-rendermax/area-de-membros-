'use client'

import { createClient } from '@supabase/supabase-js'
import { useRef, useState } from 'react'
import { prepararUploadImagem } from '@/app/admin/(painel)/produtos/actions'
import { IMAGE_FIELDS, validateProductImage, type ProductImageSlot } from '@/lib/admin/product-image-upload'
import { AutoCover } from '@/components/membros/auto-cover'
import { ContentImage } from '@/components/membros/content-image'
import { ui } from './ui'

export function ProductImageInput({ slot, label, storeId, productId, currentUrl, title, aspect = 'square', disabled, fieldError, onChange, onPending }: {
  slot: ProductImageSlot; label: string; storeId: string; productId: string | null; currentUrl?: string | null
  title: string; aspect?: 'poster' | 'banner' | 'square'; disabled?: boolean; fieldError?: string
  onChange: (url: string) => void; onPending: (slot: ProductImageSlot, pending: boolean) => void
}) {
  const [value, setValue] = useState(currentUrl ?? '')
  const [receipt, setReceipt] = useState('')
  const [stage, setStage] = useState<'idle' | 'preparing' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState<File | null>(null)
  const inFlight = useRef(false)
  const pending = stage === 'preparing' || stage === 'sending'

  async function upload(file: File) {
    if (inFlight.current || disabled) return
    const invalid = validateProductImage(file.size, file.type)
    setError(invalid ?? '')
    if (invalid) { setRetry(null); return }
    setRetry(file); setStage('preparing'); inFlight.current = true; onPending(slot, true)
    try {
      const ticket = await prepararUploadImagem(storeId, productId, slot, file.size, file.type)
      if (!ticket.data) throw new Error(ticket.error)
      setStage('sending')
      const { data } = ticket
      const client = createClient(data.supabaseUrl, data.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
      const { error: uploadError } = await client.storage.from(data.bucket).uploadToSignedUrl(data.path, data.token, file, { contentType: file.type })
      if (uploadError) throw new Error('Não foi possível enviar a imagem. Tente novamente.')
      setValue(data.publicUrl); setReceipt(data.receipt); onChange(data.publicUrl); setStage('done'); setRetry(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível enviar a imagem. Tente novamente.'); setStage('idle')
    } finally { inFlight.current = false; onPending(slot, false) }
  }

  return <div className="min-w-0 space-y-2">
    <input type="hidden" name={IMAGE_FIELDS[slot]} value={value} />
    <input type="hidden" name={`${slot}_image_receipt`} value={receipt} />
    <label className={ui.label}>{label}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" disabled={pending || disabled}
        aria-invalid={Boolean(error || fieldError)} aria-describedby={`${slot}-image-error`} className="block w-full min-w-0 text-sm"
        onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(file) }} />
    </label>
    <div className={aspect === 'poster' ? 'max-w-48' : 'max-w-sm'}>{aspect === 'square' ? value && <div className="aspect-square rounded-xl bg-fundo p-2"><ContentImage src={value} className="h-full w-full object-contain" sizes="320px" /></div> : <AutoCover seed={productId ?? 'novo-produto'} title={title} imageUrl={value || null} aspect={aspect} />}</div>
    {value && <button type="button" disabled={pending || disabled} className={`${ui.buttonGhost} min-h-11`} onClick={() => { setValue(''); setReceipt(''); setError(''); setStage('idle'); onChange('') }}>Remover imagem</button>}
    {pending && <p role="status" className="text-sm text-texto-suave">{stage === 'preparing' ? 'Preparando imagem…' : 'Enviando imagem…'} <progress aria-label={`Envio: ${label}`} /></p>}
    {stage === 'done' && <p role="status" className="text-sm text-texto-suave">Imagem enviada.</p>}
    {(error || fieldError) && <p id={`${slot}-image-error`} role="alert" className="text-sm text-red-600">{error || fieldError}</p>}
    {retry && error && !pending && <button type="button" className={ui.buttonGhost} disabled={disabled} onClick={() => void upload(retry)}>Tentar novamente</button>}
  </div>
}
