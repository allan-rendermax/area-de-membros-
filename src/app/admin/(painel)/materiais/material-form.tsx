import type { Material } from '@/lib/domain/types'
import { salvarMaterial } from './actions'

const field = 'flex flex-col gap-1 text-sm font-medium'
const input = 'rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal'

export function MaterialForm({ material }: { material: Material | null }) {
  return (
    <form action={salvarMaterial} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="id" value={material?.id ?? ''} />
      <input type="hidden" name="cover_url" value={material?.coverUrl ?? ''} />
      <label className={field}>Título<input name="title" required defaultValue={material?.title} className={input} /></label>
      <label className={field}>Descrição (aparece no card bloqueado)<textarea name="description" rows={4} defaultValue={material?.description} className={input} /></label>
      <label className={field}>Link de download (Drive ou direto)<input name="download_url" type="url" required defaultValue={material?.downloadUrl} className={input} /></label>
      <label className={field}>Link do checkout (botão &quot;Quero acessar&quot;)<input name="checkout_url" type="url" defaultValue={material?.checkoutUrl ?? ''} className={input} /></label>
      <label className={field}>
        Capa (imagem vertical)
        {material?.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={material.coverUrl} alt="" className="h-32 w-24 rounded object-cover" />
        )}
        <input name="cover" type="file" accept="image/*" className="text-sm font-normal" />
      </label>
      <label className={field}>Ordem<input name="sort_order" type="number" defaultValue={material?.sortOrder ?? 0} className={input} /></label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="is_published" type="checkbox" defaultChecked={material?.isPublished ?? false} /> Publicado
      </label>
      <button type="submit" className="self-start rounded-lg bg-zinc-900 px-4 py-2 font-semibold text-white">Salvar</button>
    </form>
  )
}
