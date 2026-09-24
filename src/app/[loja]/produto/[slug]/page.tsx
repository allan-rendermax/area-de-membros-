import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { EpisodeCard, ItemAnchor } from '@/components/membros/episode-card'
import { LessonSidebar } from '@/components/membros/lesson-sidebar'
import { ProductUpgrade } from '@/components/membros/product-upgrade'
import { ResourceList } from '@/components/membros/resource-list'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { canAccessLevel } from '@/lib/access/access'
import { loadGrantedProductLevels } from '@/lib/data/access'
import { getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'
import { isHttpUrl } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'

export const dynamic = 'force-dynamic'

export default async function ProdutoPage({ params, searchParams }: PageProps<'/[loja]/produto/[slug]'>) {
  const { loja, slug } = await params
  const { store, customer } = await requireStoreSession(loja)
  const [product, levels] = await Promise.all([
    getProductBySlug(store.id, slug),
    loadGrantedProductLevels(store.id, customer),
  ])
  if (!product || !product.isPublished) notFound()
  const level = levels.get(product.id)
  if (!level) redirect(`/${store.slug}?comprar=${product.slug}`)

  const publishedModules = (await listModulesWithItems(product.id, { publishedOnly: true }))
    .filter((module) => module.isPublished)
    .map((module) => ({ ...module, items: module.items.filter((item) => item.isPublished && (item.kind === 'video' ? Boolean(toVideoEmbed(item.url)) : isHttpUrl(item.url))) }))
    .filter((module) => module.items.length > 0)
  const modules = publishedModules.filter((module) => canAccessLevel(level, module.requiredLevel ?? 'basic'))
  const lockedModules = publishedModules.filter((module) => !canAccessLevel(level, module.requiredLevel ?? 'basic'))
  const productHref = `/${store.slug}/produto/${product.slug}`
  const blocked = (await searchParams).bloqueado === '1'
  const support = supportHref(store, 'geral', customer.email)

  return (
    <>
      <StoreHeader store={store} email={customer.email} actions={<InstallAppButton />} />
      <main className="lesson-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10">
        <div className="lesson-workspace-grid grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10">
          <div className="min-w-0">
            <header className="lesson-heading flex min-w-0 items-start gap-4">
              <Link href={`/${store.slug}`} aria-label="Voltar ao acervo" className="lesson-back grid h-11 w-11 shrink-0 place-items-center rounded-full border border-borda bg-superficie text-xl text-texto hover:bg-superficie-2">←</Link>
              <div className="min-w-0 flex-1">
                <p className="lesson-eyebrow text-xs font-bold uppercase tracking-[.16em] text-texto-suave">Seu material</p>
                <h1 className="lesson-title mt-1 break-words [overflow-wrap:anywhere] text-3xl font-extrabold leading-tight sm:text-4xl">{product.title}</h1>
                <p className="mt-2 text-sm font-semibold text-destaque">Seu acesso: {level === 'complete' ? 'Completo' : 'Básico'}</p>
                {blocked && <p role="status" className="mt-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-sm">Este conteúdo faz parte da versão completa.</p>}
                {product.description && <p className="mt-3 max-w-2xl break-words text-sm leading-relaxed text-texto-suave sm:text-base">{product.description}</p>}
                {modules[0]?.items[0] && <ItemAnchor item={modules[0].items[0]} storeSlug={store.slug} className="mt-5 inline-flex min-h-11 items-center gap-3 rounded-full bg-destaque px-5 py-2.5 text-sm font-bold text-white hover:bg-destaque/80">
                  Abrir primeiro conteúdo <span aria-hidden>→</span>
                </ItemAnchor>}
              </div>
            </header>

            {modules.length === 0 ? <p className="mt-10 text-texto-suave">Nenhum conteúdo publicado ainda.</p> : (
              <div className="mt-9 space-y-11">
                {modules.map((module) => {
                  const videos = module.items.filter((item) => item.kind === 'video')
                  const hasResources = module.items.some((item) => item.kind !== 'video')
                  return <section key={module.id} aria-label={module.title} className="min-w-0">
                    <div className="lesson-section-heading mb-5 flex min-w-0 items-center gap-3">
                      <span aria-hidden className="h-1.5 w-7 shrink-0 rounded-full bg-destaque" />
                      <h2 className="min-w-0 break-words [overflow-wrap:anywhere] text-xl font-bold sm:text-2xl">{module.title}</h2>
                    </div>
                    {videos.length > 0 && <div>
                      <h3 className="mb-4 text-lg font-bold">Aulas em vídeo</h3>
                      <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                        {videos.map((item) => <EpisodeCard key={item.id} item={item} storeSlug={store.slug} />)}
                      </div>
                    </div>}
                    {hasResources && <div className={videos.length ? 'mt-8' : ''}>
                      {videos.length > 0 && <h3 className="mb-4 text-lg font-bold">Downloads e links</h3>}
                      <ResourceList items={module.items} storeSlug={store.slug} />
                    </div>}
                  </section>
                })}
              </div>
            )}
            {lockedModules.length > 0 && <section className="mt-9" aria-label="Módulos bloqueados">
              <h2 className="mb-4 text-xl font-bold">Módulos da versão completa</h2>
              <ul className="space-y-3">{lockedModules.map((module) => <li key={module.id} className="rounded-xl border border-borda bg-superficie p-4">
                <span className="font-semibold">{module.title}</span>
                <span className="ml-3 text-sm text-texto-suave">{module.items.length} {module.items.length === 1 ? 'conteúdo' : 'conteúdos'} bloqueados</span>
              </li>)}</ul>
            </section>}
            <ProductUpgrade level={level} lockedCount={lockedModules.length} checkoutUrl={product.upgradeCheckoutUrl} refreshHref={productHref} />
          </div>
          <LessonSidebar modules={modules} storeSlug={store.slug} />
        </div>
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
