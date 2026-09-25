import type { ReactNode } from 'react'
import { ui } from '@/components/admin/ui'
import { ProductUpgrade } from '@/components/membros/product-upgrade'
import { MemberTheme } from '@/components/membros/member-theme'
import { getMemberTheme } from '@/lib/membros/theme'
import type { Product } from '@/lib/domain/types'

export function UpgradeFields({ product, draft, storeSlug, supportUrl, sectionName, imageInput, fieldErrors = {}, disabled }: { product: Product | null; draft: Product; storeSlug: string; supportUrl?: string | null; sectionName?: string; imageInput: ReactNode; fieldErrors?: Record<string, string>; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="min-w-0 space-y-4 border-t border-borda pt-5">
    <legend className="px-2 text-xl font-bold">Upgrade para Completo</legend>
    <label className={ui.label}>Link do checkout para upgrade ao Completo<input name="upgrade_checkout_url" type="url" value={draft.upgradeCheckoutUrl ?? ''} onChange={() => {}} aria-invalid={Boolean(fieldErrors.upgrade_checkout_url)} className={ui.input} />{fieldErrors.upgrade_checkout_url && <p role="alert" className="text-sm text-red-600">{fieldErrors.upgrade_checkout_url}</p>}</label>
    <label className={ui.label}>Texto do botão de upgrade<input name="upgrade_button_text" maxLength={80} placeholder="Quero a versão completa" value={draft.upgradeButtonText ?? ''} onChange={() => {}} className={ui.input} /></label>
    {imageInput}
    <p className="text-sm text-texto-suave">Sem imagem própria, usamos a capa do produto no modal.</p>
    {!draft.upgradeCheckoutUrl && <p className="text-sm text-texto-suave">{supportUrl ? 'Upgrade encaminha ao suporte.' : 'Configure um checkout de upgrade ou um contato de suporte na loja.'}</p>}
    <p className="text-sm text-texto-suave">Prévia — alterações ainda não salvas</p>
    <MemberTheme theme={getMemberTheme(storeSlug)} className="!min-h-0 rounded-xl p-3"><ProductUpgrade level="basic" lockedCount={1} previewOnly productTitle={draft.title || 'Novo produto'} imageUrl={draft.upgradeImageUrl || draft.coverUrl} buttonText={draft.upgradeButtonText} checkoutUrl={draft.upgradeCheckoutUrl} refreshHref="" supportUrl={supportUrl} sectionName={sectionName} /></MemberTheme>
  </fieldset>
}
