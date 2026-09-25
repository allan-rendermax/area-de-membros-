import { materialTitle } from '@/lib/content/material-title'
import { MaterialHelp } from '@/components/membros/material-help'
import { supportHref } from '@/lib/support/whatsapp'
import { listCompletedItemIds } from '@/lib/data/member-progress'
import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { LessonSidebar } from '@/components/membros/lesson-sidebar'
import { LessonToolbar } from '@/components/membros/lesson-toolbar'
import { LockedModules } from '@/components/membros/locked-modules'
import { ProductUpgrade } from '@/components/membros/product-upgrade'
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

function isGenericTitle(title: string) {
  return /^clique\s+aqui(?:\s+para\b.*)?[.!]?$/i.test(title.trim())
}

export default async function ItemPage({ params, searchParams }: PageProps<'/[loja]/item/[id]'>) {
  const { loja, id } = await params
  if (!isUuid(id)) notFound()
  const query = await searchParams
  const preview = query.previa === '1'
  const blocked = !preview && query.bloqueado === '1'
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

  const publishedModules = productModules
    .filter((module) => preview || module.isPublished)
    .map((module) => ({
      ...module,
      title: isGenericTitle(module.title) ? 'Materiais' : module.title,
      items: module.items.filter((item) => (preview || item.isPublished) &&
        (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))).map((item) => ({
          ...item,
          title: materialTitle(item.title, ctx.product.title),
        })),
    }))
    .filter((module) => module.items.length > 0)
  const modules = publishedModules.filter((module) => canAccessLevel(level, module.requiredLevel ?? 'basic'))
  const lockedModules = publishedModules.filter((module) => !canAccessLevel(level, module.requiredLevel ?? 'basic'))
  const sequence = modules.flatMap((module) => module.items)
  const itemTitle = sequence.find((item) => item.id === ctx.item.id)?.title ?? ctx.item.title
  const moduleTitle = modules.find((module) => module.id === ctx.module.id)?.title ?? ctx.module.title
  const accessibleItemIds = new Set(sequence.map((item) => item.id))
  const visibleCompletedIds = completedIds.filter((id) => accessibleItemIds.has(id))
  const siblings = modules.find((module) => module.id === ctx.module.id)?.items ?? []
  const index = sequence.findIndex((item) => item.id === ctx.item.id)
  const previous = index > 0 ? sequence[index - 1] : null
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null
  const libraryHref = withPreview(`/${store.slug}`, preview)
  const itemHref = withPreview(`/${store.slug}/item/${ctx.item.id}`, preview)

  return (
    <>
      <StoreHeader store={store} email={customer?.email ?? ''} preview={preview} active="materials" actions={<InstallAppButton />} />
      <main className="lesson-workspace member-item-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10">
        <div className="lesson-workspace-grid grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10">
          <div className="min-w-0 order-2 lg:order-1">
            <header className="lesson-heading flex min-w-0 items-start gap-4">
              <Link href={libraryHref} aria-label="Voltar ao acervo" className="lesson-back grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borda bg-superficie text-xl text-texto hover:bg-superficie-2">←</Link>
              <div className="min-w-0 flex-1">
                <h1 className="lesson-title mt-1 text-balance break-words [overflow-wrap:anywhere] text-3xl font-extrabold leading-tight sm:text-4xl">{ctx.product.title}</h1>
                {blocked && <p role="status" className="mt-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-sm">Este conteúdo faz parte da versão completa.</p>}
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

            {siblings.some((item) => item.kind !== 'video') && <section className="mt-9" aria-label="Materiais disponíveis">
              <h2 className="lesson-section-heading mb-5 text-2xl font-bold">Materiais disponíveis</h2>
              <ResourceList items={siblings} storeSlug={store.slug} preview={preview} currentItemId={ctx.item.id} />
            </section>}

            {!progressAvailable && <p role="status" className="mt-6 text-sm text-texto-suave">Não foi possível carregar seu progresso. Os materiais continuam disponíveis. Atualize a página para tentar novamente.</p>}
            <LockedModules modules={lockedModules} />
            <ProductUpgrade level={level} lockedCount={lockedModules.length} checkoutUrl={ctx.product.upgradeCheckoutUrl} refreshHref={itemHref} />
            <div className="mt-8"><MaterialHelp href={supportHref(store, 'geral', customer?.email ?? null)} /></div>
            <LessonToolbar
              key={`${customer?.id ?? 'preview'}:${ctx.item.id}`}
              preview={preview}
              storeSlug={store.slug}
              initialCompleted={visibleCompletedIds.includes(ctx.item.id)}
              progressAvailable={progressAvailable}
              productTitle={ctx.product.title}
              moduleTitle={moduleTitle}
              itemId={ctx.item.id}
              itemTitle={itemTitle}
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
