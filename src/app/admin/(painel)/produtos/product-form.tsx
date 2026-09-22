import { ui } from '@/components/admin/ui'
import { AutoCover } from '@/components/membros/auto-cover'
import type { Product } from '@/lib/domain/types'
import { salvarProduto } from './actions'

export function ProductForm({ product, tracks }: { product: Product | null; tracks: string[] }) {
  const seed = product?.id ?? 'novo-produto'
  return (
    <form action={salvarProduto} className={`${ui.card} grid gap-6 p-5 lg:grid-cols-[240px_1fr]`}>
      <input type="hidden" name="id" value={product?.id ?? ''} />
      <input type="hidden" name="cover_url" value={product?.coverUrl ?? ''} />
      <input type="hidden" name="banner_url" value={product?.bannerUrl ?? ''} />

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm text-texto-suave">Capa (vertical 2:3) (até 2 MB)</p>
          <AutoCover seed={seed} title={product?.title ?? 'Novo produto'} imageUrl={product?.coverUrl ?? null} aspect="poster" />
          <input name="cover" type="file" accept="image/*" className="mt-2 text-sm" />
        </div>
        <div>
          <p className="mb-2 text-sm text-texto-suave">Banner (horizontal 16:9) (até 2 MB)</p>
          <AutoCover seed={seed} title="" imageUrl={product?.bannerUrl ?? null} aspect="banner" />
          <input name="banner" type="file" accept="image/*" className="mt-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label className={ui.label}>Título<input name="title" required defaultValue={product?.title} className={ui.input} /></label>
        <label className={ui.label}>
          Trilha
          <input name="track" list="product-tracks" defaultValue={product?.track ?? ''} className={ui.input} />
        </label>
        <datalist id="product-tracks">
          {tracks.map((track) => <option key={track} value={track} />)}
        </datalist>
        <label className={ui.label}>
          Endereço (vazio = gerado do título)
          <input name="slug" defaultValue={product?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={ui.input} />
        </label>
        <label className={ui.label}>Descrição<textarea name="description" rows={5} defaultValue={product?.description} className={ui.input} /></label>
        <label className={ui.label}>
          Link do checkout (botão &quot;Quero acessar&quot;)
          <input name="checkout_url" type="url" defaultValue={product?.checkoutUrl ?? ''} className={ui.input} />
        </label>
        <label className={ui.label}>Ordem<input name="sort_order" type="number" defaultValue={product?.sortOrder ?? 0} className={ui.input} /></label>
        <label className={ui.checkbox}>
          <input name="is_featured" type="checkbox" defaultChecked={product?.isFeatured ?? false} /> Destaque no topo da vitrine
        </label>
        <label className={ui.checkbox}>
          <input name="is_published" type="checkbox" defaultChecked={product?.isPublished ?? false} /> Publicado
        </label>
        <button type="submit" className={`${ui.button} self-start`}>Salvar</button>
      </div>
    </form>
  )
}
