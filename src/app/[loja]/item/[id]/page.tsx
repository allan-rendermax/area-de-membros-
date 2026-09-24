import { MaterialHelp } from '@/components/membros/material-help'
import { supportHref } from '@/lib/support/whatsapp'
import { listCompletedItemIds } from '@/lib/data/member-progress'
import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { LessonSidebar } from '@/components/membros/lesson-sidebar'
import { LessonToolbar } from '@/components/membros/lesson-toolbar'
import { ResourceList } from '@/components/membros/resource-list'
import { StoreHeader } from '@/components/membros/store-header'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { canAccessLevel } from '@/lib/access/access'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { recordItemAccess } from '@/lib/data/item-access'
import { getItemWithContext, listModulesWithItems } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { requireStorePreview } from '@/lib/membros/preview'
import { withPreview } from '@/lib/membros/paths'

export const dynamic = 'force-dynamic'

export default async function ItemPage({ params, searchParams }: PageProps<'/[loja]/item/[id]'>) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const preview = (await searchParams).previa === '1'
  const { store, customer } = await (preview ? requireStorePreview(loja) : requireStoreSession(loja))

  const [ctx, levels] = await Promise.all([
    getItemWithContext(id),
    customer ? loadGrantedProductLevels(store.id, customer) : Promise.resolve(null),
  ])
  if (!ctx || ctx.product.storeId !== store.id || (!preview && (!ctx.product.isPublished || !ctx.module.isPublished || !ctx.item.isPublished))) notFound()
  const level = preview ? 'complete' : levels?.get(ctx.product.id)
  if (!level) redirect(`/${store.slug}?comprar=${ctx.product.slug}`)
  if (!canAccessLevel(level, ctx.module.requiredLevel ?? 'basic')) redirect(`/${store.slug}/produto/${ctx.product.slug}?bloqueado=1`)

  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  if (ctx.item.kind === 'video' && !embed) notFound()
  if (ctx.item.kind !== 'video' && !isHttpUrl(ctx.item.url)) notFound()
  const completionResult = await Promise.allSettled([customer ? listCompletedItemIds(customer.id, store.id, ctx.product.id) : Promise.resolve([])])
  const completedIds = completionResult[0].status === 'fulfilled' ? completionResult[0].value : []
  const progressAvailable = completionResult[0].status === 'fulfilled'
  const [productModules] = await Promise.all([
    listModulesWithItems(ctx.product.id, { publishedOnly: !preview }),
    customer && ctx.item.kind === 'video'
      ? recordItemAccess({ customerId: customer.id, storeId: store.id, productId: ctx.product.id, itemId: ctx.item.id, kind: ctx.item.kind })
      : Promise.resolve(),
  ])

  const modules = productModules
    .filter((module) => (preview || module.isPublished) && canAccessLevel(level, module.requiredLevel ?? 'basic'))
    .map((module) => ({
      ...module,
      items: module.items.filter((item) => (preview || item.isPublished) &&
        (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))),
    }))
    .filter((module) => module.items.length > 0)
  const sequence = modules.flatMap((module) => module.items)
  const accessibleItemIds = new Set(sequence.map((item) => item.id))
  const visibleCompletedIds = completedIds.filter((id) => accessibleItemIds.has(id))
  const siblings = modules.find((module) => module.id === ctx.module.id)?.items ?? []
  const index = sequence.findIndex((item) => item.id === ctx.item.id)
  const previous = index > 0 ? sequence[index - 1] : null
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null
  const productHref = withPreview(`/${store.slug}/produto/${ctx.product.slug}`, preview)

  return (
    <>
      <StoreHeader store={store} email={customer?.email ?? ''} preview={preview} active="materials" actions={<InstallAppButton />} />
      <main className="lesson-workspace member-item-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10">
        <div className="lesson-workspace-grid grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10">
          <div className="min-w-0 order-2 lg:order-1">
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
              <ResourceList items={siblings} storeSlug={store.slug} preview={preview} currentItemId={ctx.item.id} />
            </section>}

            {!progressAvailable && <p role="status" className="mt-6 text-sm text-texto-suave">Não foi possível carregar seu progresso. Os materiais continuam disponíveis. Atualize a página para tentar novamente.</p>}
            <div className="mt-8"><MaterialHelp href={supportHref(store, 'geral', customer?.email ?? null)} /></div>
            <LessonToolbar
              key={`${customer?.id ?? 'preview'}:${ctx.item.id}`}
              preview={preview}
              storeSlug={store.slug}
              initialCompleted={visibleCompletedIds.includes(ctx.item.id)}
              progressAvailable={progressAvailable}
              productTitle={ctx.product.title}
              moduleTitle={ctx.module.title}
              itemId={ctx.item.id}
              itemTitle={ctx.item.title}
              description={ctx.product.description}
              previous={previous ? { href: withPreview(`/${store.slug}/item/${previous.id}`, preview), title: previous.title } : null}
              next={next ? { href: withPreview(`/${store.slug}/item/${next.id}`, preview), title: next.title } : null}
            />
          </div>
          <LessonSidebar modules={modules} storeSlug={store.slug} preview={preview} currentItemId={ctx.item.id} completedItemIds={visibleCompletedIds} />
        </div>
      </main>
    </>
  )
}
