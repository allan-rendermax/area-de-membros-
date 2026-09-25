import { ui } from '@/components/admin/ui'
import { LockedPoster } from '@/components/membros/locked-poster'
import { MemberTheme } from '@/components/membros/member-theme'
import type { Product } from '@/lib/domain/types'
import { getMemberTheme } from '@/lib/membros/theme'
import '@/app/[loja]/architecture.css'

export function LockedProductFields({ product, storeSlug }: { product: Product | null; storeSlug: string }) {
  return <fieldset className="grid gap-4 rounded-xl border border-borda p-4 sm:p-5">
    <legend className="px-2 text-lg font-bold">Modal do produto bloqueado</legend>
    <p className="text-sm leading-relaxed text-texto-suave">Quem ainda não comprou vê a capa em preto e branco com cadeado. Ao clicar, abre este modal. O botão leva direto ao checkout.</p>
    <label className={ui.label}>Título do modal
      <input name="purchase_title" maxLength={120} defaultValue={product?.purchaseTitle ?? ''} placeholder={product?.title || 'Nome do produto'} className={ui.input} />
      <span className="text-xs text-texto-suave">Vazio: usa o nome do produto.</span>
    </label>
    <label className={ui.label}>Texto do modal
      <textarea name="purchase_description" maxLength={5000} rows={6} defaultValue={product?.purchaseDescription ?? ''} placeholder="Apresente o produto, seus benefícios e o que está incluído. Você pode separar o texto em parágrafos." className={ui.input} />
      <span className="text-xs text-texto-suave">Vazio: usa a descrição do produto. Sem descrição, mostra só o título e o botão.</span>
    </label>
    <input type="hidden" name="purchase_image_url" value={product?.purchaseImageUrl ?? ''} />
    <label className={ui.label}>Imagem do modal (opcional, até 2 MB)
      <input name="purchase_image" type="file" accept="image/*" className={ui.input} />
      <span className="text-xs text-texto-suave">Recomendado: mockup quadrado. A imagem aparece inteira, sem cortar. Sem envio, o modal fica somente com texto.</span>
    </label>
    {product?.purchaseImageUrl && <div className="flex flex-wrap items-center gap-4 text-sm">
      <a href={product.purchaseImageUrl} target="_blank" rel="noopener noreferrer" className="underline">Ver imagem atual</a>
      <label className={ui.checkbox}><input name="remove_purchase_image" type="checkbox" /> Remover imagem</label>
    </div>}
    <label className={ui.label}>Texto do botão
      <input name="purchase_button_text" maxLength={80} defaultValue={product?.purchaseButtonText ?? ''} placeholder="Quero acessar" className={ui.input} />
    </label>
    <label className={ui.label}>Link do checkout do produto
      <input name="checkout_url" type="url" defaultValue={product?.checkoutUrl ?? ''} className={ui.input} />
    </label>
    <label className={ui.label}>Checkout de aluno com 10% de desconto
      <input name="student_checkout_url" type="url" defaultValue={product?.studentCheckoutUrl ?? ''} className={ui.input} />
      <span className="text-xs text-texto-suave">Opcional. Se preenchido, o botão usa este link, com o cupom já aplicado, no lugar do checkout normal.</span>
    </label>
    {product && <>
      <p className="text-xs text-texto-suave">Prévia com os dados salvos. Salve para conferir suas alterações.</p>
      <MemberTheme theme={getMemberTheme(storeSlug)} className="!min-h-0 rounded-xl p-3">
        <LockedPoster product={{ ...product, unlocked: false }} previewOnly />
      </MemberTheme>
    </>}
  </fieldset>
}
