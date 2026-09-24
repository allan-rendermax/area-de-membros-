import { ui } from '@/components/admin/ui'
import type { Store } from '@/lib/domain/types'
import { salvarLoja } from './actions'

export function StoreForm({ store }: { store: Store | null }) {
  return (
    <form action={salvarLoja} className={`${ui.card} flex max-w-2xl flex-col gap-4 p-5`}>
      <input type="hidden" name="id" value={store?.id ?? ''} />
      <input type="hidden" name="logo_url" value={store?.logoUrl ?? ''} />
      <input type="hidden" name="login_image_url" value={store?.loginImageUrl ?? ''} />
      <label className={ui.label}>Nome<input name="name" required defaultValue={store?.name} className={ui.input} /></label>
      <label className={ui.label}>
        Endereço (vira seusite.com/endereco; vazio = gerado do nome)
        <input name="slug" defaultValue={store?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={ui.input} />
      </label>
      <label className={ui.label}>
        WhatsApp de suporte (opcional)
        <input name="support_whatsapp" inputMode="tel" defaultValue={store?.supportWhatsapp ?? ''} placeholder="5511999998888" className={ui.input} />
        <span className="text-sm text-texto-suave">Informe DDI + DDD + número. Se deixar vazio, apenas os outros canais de suporte serão exibidos.</span>
      </label>
      <label className={ui.label}>Link de suporte (opcional)<input name="support_url" type="url" defaultValue={store?.supportUrl ?? ''} className={ui.input} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={ui.label}>
          Logo (até 2 MB)
          {store?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="h-12 w-auto rounded bg-fundo p-1" />
          )}
          <input name="logo" type="file" accept="image/*" className="text-sm" />
        </label>
        <label className={ui.label}>
          Imagem do login (até 2 MB)
          {store?.loginImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.loginImageUrl} alt="" className="aspect-video w-full rounded object-cover" />
          )}
          <input name="login_image" type="file" accept="image/*" className="text-sm" />
        </label>
      </div>
      <button type="submit" className={`${ui.button} self-start`}>Salvar</button>
    </form>
  )
}
