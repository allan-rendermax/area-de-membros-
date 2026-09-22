import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ItemAnchor } from '@/components/membros/episode-card'
import { StoreHeader } from '@/components/membros/store-header'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { loadGrantedProductIds } from '@/lib/data/access'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, listModulesWithItems } from '@/lib/data/products'
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

  await recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })

  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  if (!embed) {
    if (!isHttpUrl(ctx.item.url)) notFound()
    redirect(ctx.item.url)
  }

  const modules = await listModulesWithItems(ctx.product.id, { publishedOnly: true })
  const siblings = modules.find((m) => m.id === ctx.module.id)?.items ?? []
  const index = siblings.findIndex((s) => s.id === ctx.item.id)
  const previous = index > 0 ? siblings[index - 1] : null
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null

  return (
    <>
      <StoreHeader store={store} email={customer.email} actions={<InstallAppButton />} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-24 sm:px-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="aspect-video overflow-hidden rounded-lg bg-fundo">
            <iframe
              src={embed.embedUrl}
              title={ctx.item.title}
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{ctx.item.title}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            <Link href={`/${store.slug}/produto/${ctx.product.slug}`} className="hover:text-texto">
              {ctx.product.title}
            </Link>
            {' · '}
            {ctx.module.title}
          </p>
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
        <aside className="lg:w-80">
          <h2 className="mb-3 font-semibold">{ctx.module.title}</h2>
          <ol className="flex flex-col gap-1">
            {siblings.map((s) => (
              <li key={s.id}>
                <ItemAnchor
                  item={s}
                  storeSlug={store.slug}
                  current={s.id === ctx.item.id}
                  className={`block rounded-md px-3 py-2 text-sm ${s.id === ctx.item.id ? 'bg-superficie-2 text-texto' : 'text-texto-suave hover:bg-superficie hover:text-texto'}`}
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
