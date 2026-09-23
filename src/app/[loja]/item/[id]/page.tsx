import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ItemAnchor } from '@/components/membros/episode-card'
import { ResourceList } from '@/components/membros/resource-list'
import { StoreHeader } from '@/components/membros/store-header'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { loadGrantedProductIds } from '@/lib/data/access'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, listPublishedItemsInModule } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'

export const dynamic = 'force-dynamic'

const navButton = 'rounded-md border border-borda px-4 py-2 text-sm hover:bg-superficie-2'

export default async function ItemPage({ params }: PageProps<'/[loja]/item/[id]'>) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const { store, customer } = await requireStoreSession(loja)

  const [ctx, granted] = await Promise.all([
    getItemWithContext(id),
    loadGrantedProductIds(store.id, customer),
  ])
  if (!ctx || ctx.product.storeId !== store.id || !ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished) {
    notFound()
  }

  if (!granted.has(ctx.product.id)) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)

  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  if (ctx.item.kind === 'video' && !embed) notFound()
  if (ctx.item.kind !== 'video' && !isHttpUrl(ctx.item.url)) notFound()
  if (ctx.item.kind === 'video') await recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })

  const siblings = await listPublishedItemsInModule(ctx.module.id)
  const index = siblings.findIndex((s) => s.id === ctx.item.id)
  const previous = index > 0 ? siblings[index - 1] : null
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  return (
    <>
      <StoreHeader store={store} email={customer.email} actions={<InstallAppButton />} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-24 sm:px-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          {embed && <div className="aspect-video overflow-hidden rounded-lg bg-fundo">
            <iframe
              src={embed.embedUrl}
              title={ctx.item.title}
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>}
          <Link href={`/${store.slug}/produto/${ctx.product.slug}`} className="mt-4 inline-block text-sm text-texto-suave hover:text-texto">← Voltar ao produto</Link>
          <h1 className="mt-4 break-words text-2xl font-bold">{ctx.item.title}</h1>
          <p className="mt-1 break-words text-sm text-texto-suave">
            <Link href={`/${store.slug}/produto/${ctx.product.slug}`} className="hover:text-texto">
              {ctx.product.title}
            </Link>
            {' · '}
            {ctx.module.title}
          </p>
          {siblings.some((s) => s.kind !== 'video' && isHttpUrl(s.url)) && <section className="mt-8" aria-label="Downloads e links">
            <h2 className="mb-4 text-xl font-bold">Downloads e links</h2>
            <ResourceList items={siblings} storeSlug={store.slug} currentItemId={ctx.item.id} />
          </section>}
          <nav className="mt-4 flex flex-wrap gap-3" aria-label="Navegação entre itens">
            {previous && (
              <ItemAnchor item={previous} storeSlug={store.slug} className={navButton}>
                ← Anterior
              </ItemAnchor>
            )}
            {next && (
              <ItemAnchor item={next} storeSlug={store.slug} className={navButton}>
                Próximo →
              </ItemAnchor>
            )}
          </nav>
        </div>
        <aside className="min-w-0 lg:w-80">
          <h2 className="mb-3 break-words font-semibold">{ctx.module.title}</h2>
          <ol className="flex flex-col gap-1">
            {siblings.map((s) => (
              <li key={s.id}>
                <ItemAnchor
                  item={s}
                  storeSlug={store.slug}
                  current={s.id === ctx.item.id}
                  className={`block break-words rounded-md px-3 py-2 text-sm ${s.id === ctx.item.id ? 'bg-superficie-2 text-texto' : 'text-texto-suave hover:bg-superficie hover:text-texto'}`}
                >
                  {s.title}
                </ItemAnchor>
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </>
  )
}
