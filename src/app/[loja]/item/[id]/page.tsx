import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { LessonSidebar } from '@/components/membros/lesson-sidebar'
import { LessonToolbar } from '@/components/membros/lesson-toolbar'
import { ResourceList } from '@/components/membros/resource-list'
import { StoreHeader } from '@/components/membros/store-header'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { loadGrantedProductIds } from '@/lib/data/access'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, listPublishedItemsInModule } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'

export const dynamic = 'force-dynamic'

export default async function ItemPage({ params }: PageProps<'/[loja]/item/[id]'>) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const { store, customer } = await requireStoreSession(loja)

  const [ctx, granted] = await Promise.all([
    getItemWithContext(id),
    loadGrantedProductIds(store.id, customer),
  ])
  if (!ctx || ctx.product.storeId !== store.id || !ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished) notFound()
  if (!granted.has(ctx.product.id)) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)

  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  if (ctx.item.kind === 'video' && !embed) notFound()
  if (ctx.item.kind !== 'video' && !isHttpUrl(ctx.item.url)) notFound()
  if (ctx.item.kind === 'video') await recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })

  const siblings = (await listPublishedItemsInModule(ctx.module.id))
    .filter((item) => item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))
  const index = siblings.findIndex((item) => item.id === ctx.item.id)
  const previous = index > 0 ? siblings[index - 1] : null
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null
  const productHref = `/${store.slug}/produto/${ctx.product.slug}`

  return (
    <>
      <StoreHeader store={store} email={customer.email} actions={<InstallAppButton />} />
      <main className="lesson-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10">
        <div className="lesson-workspace-grid grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10">
          <div className="min-w-0">
            <header className="lesson-heading flex min-w-0 items-start gap-4">
              <Link href={productHref} aria-label="Voltar ao produto" className="lesson-back grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borda bg-superficie text-xl text-texto hover:bg-superficie-2">←</Link>
              <div className="min-w-0 flex-1">
                <p className="lesson-eyebrow break-words text-xs font-bold uppercase tracking-[.16em] text-texto-suave">{ctx.module.title}</p>
                <h1 className="lesson-title mt-1 break-words [overflow-wrap:anywhere] text-3xl font-extrabold leading-tight sm:text-4xl">{ctx.item.title}</h1>
                <Link href={productHref} className="mt-2 inline-block break-words text-sm text-texto-suave hover:text-texto">{ctx.product.title}</Link>
              </div>
            </header>

            {embed && <div className="mt-7 aspect-video overflow-hidden rounded-xl border border-borda bg-fundo">
              <iframe
                src={embed.embedUrl}
                title={ctx.item.title}
                className="h-full w-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>}

            {siblings.some((item) => item.kind !== 'video') && <section className="mt-9" aria-label="Downloads e links">
              <h2 className="lesson-section-heading mb-5 text-2xl font-bold">Downloads e links</h2>
              <ResourceList items={siblings} storeSlug={store.slug} currentItemId={ctx.item.id} />
            </section>}

            <LessonToolbar
              storeId={store.id}
              customerId={customer.id}
              productTitle={ctx.product.title}
              moduleTitle={ctx.module.title}
              itemId={ctx.item.id}
              itemTitle={ctx.item.title}
              description={ctx.product.description}
              previous={previous ? { href: `/${store.slug}/item/${previous.id}`, title: previous.title } : null}
              next={next ? { href: `/${store.slug}/item/${next.id}`, title: next.title } : null}
            />
          </div>
          <LessonSidebar modules={[{ ...ctx.module, items: siblings }]} storeSlug={store.slug} currentItemId={ctx.item.id} />
        </div>
      </main>
    </>
  )
}
