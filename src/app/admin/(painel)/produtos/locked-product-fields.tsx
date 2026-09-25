import type { ReactNode } from 'react'
import { ui } from '@/components/admin/ui'
import { LockedPoster } from '@/components/membros/locked-poster'
import { MemberTheme } from '@/components/membros/member-theme'
import type { Product } from '@/lib/domain/types'
import { getMemberTheme } from '@/lib/membros/theme'
import '@/app/[loja]/architecture.css'

export function LockedProductFields({ product, draft, storeSlug, imageInput, fieldErrors = {}, disabled }: { product: Product | null; draft: Product; storeSlug: string; imageInput: ReactNode; fieldErrors?: Record<string, string>; disabled?: boolean }) {
  const error = (name: string) => fieldErrors[name] ? <p role="alert" className="text-sm text-red-600">{fieldErrors[name]}</p> : null
  return <fieldset disabled={disabled} className="min-w-0 space-y-4 border-t border-borda pt-5">
    <legend className="px-2 text-xl font-bold">Compra de produto bloqueado</legend>
    <p className="text-sm leading-relaxed text-texto-suave">Quem ainda não comprou vê a capa em preto e branco com cadeado. Ao clicar, abre este modal. O botão leva direto ao checkout.</p>
    <label className={ui.label}>Título do modal<input name="purchase_title" maxLength={120} value={draft.purchaseTitle ?? ''} onChange={() => {}} placeholder={draft.title || 'Nome do produto'} className={ui.input} /><span className="text-sm font-normal text-texto-suave">Vazio: usa o nome do produto.</span>{error('purchase_title')}</label>
    <label className={ui.label}>Texto do modal<textarea name="purchase_description" maxLength={5000} rows={6} value={draft.purchaseDescription ?? ''} onChange={() => {}} placeholder="Apresente o produto e o que está incluído." className={ui.input} /><span className="text-sm font-normal text-texto-suave">Vazio: usa a descrição do produto. Sem descrição, mostra só o título e o botão.</span>{error('purchase_description')}</label>
    {imageInput}
    <p className="text-sm text-texto-suave">O mockup quadrado aparece inteiro, sem cortar. Sem imagem, o modal fica somente com texto.</p>
    <label className={ui.label}>Texto do botão<input name="purchase_button_text" maxLength={80} value={draft.purchaseButtonText ?? ''} onChange={() => {}} placeholder="Quero acessar" className={ui.input} />{error('purchase_button_text')}</label>
    <label className={ui.label}>Link do checkout do produto<input name="checkout_url" type="url" value={draft.checkoutUrl ?? ''} onChange={() => {}} aria-invalid={Boolean(fieldErrors.checkout_url)} className={ui.input} />{error('checkout_url')}</label>
    <label className={ui.label}>Checkout de aluno com 10% de desconto<input name="student_checkout_url" type="url" value={draft.studentCheckoutUrl ?? ''} onChange={() => {}} aria-invalid={Boolean(fieldErrors.student_checkout_url)} className={ui.input} /><span className="text-sm font-normal text-texto-suave">Opcional. Use um checkout que já tenha o cupom aplicado.</span>{error('student_checkout_url')}</label>
    {!draft.checkoutUrl && !draft.studentCheckoutUrl && <p className="text-sm text-texto-suave">Compra indisponível: configure um checkout.</p>}
    <p className="text-sm text-texto-suave">Prévia — alterações ainda não salvas</p>
    <MemberTheme theme={getMemberTheme(storeSlug)} className="!min-h-0 rounded-xl p-3"><LockedPoster product={{ ...draft, title: draft.title || 'Novo produto', unlocked: false }} previewOnly /></MemberTheme>
  </fieldset>
}
