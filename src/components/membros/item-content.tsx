import { previewIncludesDrafts, type PreviewContext } from '@/lib/membros/preview-context'
import Link from 'next/link'
import type { AccessLevel, CustomerRow, Item, Module, ModuleWithItems, Product, Store } from '@/lib/domain/types'
import { materialTitle } from '@/lib/content/material-title'
import { MaterialHelp } from './material-help'
import { supportHref } from '@/lib/support/whatsapp'
import { listCompletedItemIds } from '@/lib/data/member-progress'
import { InstallAppButton } from './install-app-button'
import { LessonSidebar } from './lesson-sidebar'
import { LessonToolbar } from './lesson-toolbar'
import { ProductUpgrade } from './product-upgrade'
import { RecordItemVisit } from './record-item-visit'
import { ResourceList } from './resource-list'
import { StoreHeader } from './store-header'
import { toVideoEmbed } from '@/lib/content/video'
import { isHttpUrl } from '@/lib/content/url'
import { canAccessProductModule, sectionTitle } from '@/lib/access/product-content'
import { listModulesWithItems } from '@/lib/data/products'
import { withPreview } from '@/lib/membros/paths'

// Both callers authorize the store, product and selected item before rendering.
export async function renderItemContent({ ctx, store, customer, level, preview, blocked, productModules: suppliedModules }: {
  ctx: { item: Item; module: Module; product: Product }
  store: Store
  customer: CustomerRow | null
  level: AccessLevel
  preview: PreviewContext
  blocked: boolean
  productModules?: ModuleWithItems[]
}) {
  const editorial = previewIncludesDrafts(preview)
  const embed = ctx.item.kind === 'video' ? toVideoEmbed(ctx.item.url) : null
  const [completionResult, productModules] = await Promise.all([
    Promise.allSettled([customer ? listCompletedItemIds(customer.id, store.id, ctx.product.id) : Promise.resolve([])]),
    suppliedModules ?? listModulesWithItems(ctx.product.id, { publishedOnly: !editorial }),
  ])
  const completedIds = completionResult[0].status === 'fulfilled' ? completionResult[0].value : []
  const progressAvailable = completionResult[0].status === 'fulfilled'

  const publishedModules = productModules
    .filter((module) => editorial || module.isPublished)
    .map((module) => ({
      ...module,
      title: sectionTitle(module.title, module.requiredLevel, ctx.product.contentMode),
      items: module.items.filter((item) => (editorial || item.isPublished) &&
        (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))).map((item) => ({
          ...item,
          title: materialTitle(item.title, ctx.product.title),
        })),
    }))
    .filter((module) => module.items.length > 0)
  const modules = publishedModules.filter((module) => canAccessProductModule(level, module.requiredLevel, ctx.product.contentMode, editorial))
  const lockedModules = publishedModules.filter((module) => !editorial && level === 'basic' && !canAccessProductModule(level, module.requiredLevel, ctx.product.contentMode, editorial))
  const sequence = modules.flatMap((module) => module.items)
  const itemTitle = sequence.find((item) => item.id === ctx.item.id)?.title ?? ctx.item.title
  const moduleTitle = modules.find((module) => module.id === ctx.module.id)?.title ?? ctx.module.title
  const accessibleItemIds = new Set(sequence.map((item) => item.id))
  const visibleCompletedIds = completedIds.filter((id) => accessibleItemIds.has(id))
  const siblings = modules.find((module) => module.id === ctx.module.id)?.items ?? []
  const index = sequence.findIndex((item) => item.id === ctx.item.id)
  const previous = index > 0 ? sequence[index - 1] : null
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null
  const libraryHref = withPreview(`/${store.slug}#materiais`, preview)
  const itemHref = withPreview(`/${store.slug}/item/${ctx.item.id}`, preview)

  return (
    <>
      {customer && !preview && embed && <RecordItemVisit key={customer.id} storeSlug={store.slug} itemId={ctx.item.id} />}
      <StoreHeader store={store} email={customer?.email ?? ''} preview={preview} simulationHref={ctx.product.isPublished ? `/${store.slug}/produto/${ctx.product.slug}` : `/${store.slug}`} active="materials" actions={<InstallAppButton />} />
      <main className="lesson-workspace member-item-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10">
        <div className="lesson-workspace-grid grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10">
          <div className="min-w-0 order-2 lg:order-1">
            <header className="lesson-heading flex min-w-0 items-start gap-4">
              <Link href={libraryHref} aria-label="Voltar ao acervo" className="lesson-back grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borda bg-superficie text-xl text-texto hover:bg-superficie-2">←</Link>
              <div className="min-w-0 flex-1">
                <h1 className="lesson-title mt-1 text-balance break-words [overflow-wrap:anywhere] text-3xl font-extrabold leading-tight sm:text-4xl">{ctx.product.title}</h1>
                {blocked && <p role="status" className="mt-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-sm">Este conteúdo não faz parte da sua versão atual.</p>}
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
            <div className="mt-8"><MaterialHelp href={supportHref(store, 'geral', customer?.email ?? null)} /></div>
            <LessonToolbar
              key={`${customer?.id ?? 'preview'}:${ctx.item.id}`}
              preview={Boolean(preview)}
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
          <LessonSidebar upgrade={<ProductUpgrade level={level} lockedCount={lockedModules.length} checkoutUrl={ctx.product.upgradeCheckoutUrl} refreshHref={itemHref} productTitle={ctx.product.title} imageUrl={ctx.product.upgradeImageUrl || ctx.product.coverUrl} buttonText={ctx.product.upgradeButtonText} sectionName={lockedModules[0]?.title} supportUrl={supportHref(store, 'geral', customer?.email ?? null)} />} modules={modules} storeSlug={store.slug} preview={preview} currentItemId={ctx.item.id} completedItemIds={visibleCompletedIds} />
        </div>
      </main>
    </>
  )
}
