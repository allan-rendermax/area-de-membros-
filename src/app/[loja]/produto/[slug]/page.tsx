import { InstallAppButton } from '@/components/membros/install-app-button'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AutoCover } from '@/components/membros/auto-cover'
import { Carousel } from '@/components/membros/carousel'
import { EPISODE_WIDTH, EpisodeCard } from '@/components/membros/episode-card'
import { ResourceList } from '@/components/membros/resource-list'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { loadGrantedProductIds } from '@/lib/data/access'
import { getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'
import { withMemberArtwork } from '@/lib/membros/theme'
import { isHttpUrl } from '@/lib/content/url'

export const dynamic = 'force-dynamic'

export default async function ProdutoPage({ params }: PageProps<'/[loja]/produto/[slug]'>) {
  const { loja, slug } = await params
  const { store, customer } = await requireStoreSession(loja)
  const [product, granted] = await Promise.all([
    getProductBySlug(store.id, slug),
    loadGrantedProductIds(store.id, customer),
  ])
  if (!product || !product.isPublished) notFound()

  if (!granted.has(product.id)) redirect(`/${store.slug}?comprar=${product.slug}`)

  const modules = (await listModulesWithItems(product.id, { publishedOnly: true })).filter((m) =>
    m.items.some((item) => item.kind === 'video' || isHttpUrl(item.url)))
  const support = supportHref(store, 'geral', customer.email)
  const artwork = withMemberArtwork(product, store.slug)

  return (
    <>
      <StoreHeader store={store} email={customer.email} actions={<InstallAppButton />} />
      <main className="pb-24">
        <section className="member-product-banner relative">
          <AutoCover seed={product.id} title="" imageUrl={artwork.bannerUrl ?? artwork.coverUrl} aspect="banner" className="max-h-[55vh] w-full rounded-none sm:aspect-[21/9]" eager />
          <div className="absolute inset-0 bg-gradient-to-t from-fundo via-fundo/50 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-8 sm:pb-10">
            <Link href={`/${store.slug}`} className="text-sm text-texto-suave hover:text-texto">
              ← Voltar
            </Link>
            <h1 className="mt-2 max-w-3xl break-words text-3xl leading-tight font-extrabold sm:text-5xl">{product.title}</h1>
            {product.description && <p className="member-product-description mt-3 line-clamp-4 max-w-2xl text-sm text-texto-suave sm:text-base">{product.description}</p>}
          </div>
        </section>

        {modules.length === 0 && <p className="px-4 pt-6 text-texto-suave sm:px-8">Nenhum conteúdo publicado ainda.</p>}

        <div className="flex flex-col gap-10 pt-6">
          {modules.map((m) => {
            const videos = m.items.filter((item) => item.kind === 'video')
            const hasResources = m.items.some((item) => item.kind !== 'video' && isHttpUrl(item.url))
            return (
              <section key={m.id} aria-label={m.title} className="min-w-0">
                {modules.length === 1 ? (
                  videos.length > 0 && <div className="px-4 sm:px-8">
                    <h2 className="mb-4 text-xl font-bold">Aulas em vídeo</h2>
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {videos.map((item) => <li key={item.id}><EpisodeCard item={item} storeSlug={store.slug} /></li>)}
                    </ul>
                  </div>
                ) : videos.length > 0 && <Carousel title={m.title}>
                  {videos.map((item) => <EpisodeCard key={item.id} item={item} storeSlug={store.slug} className={EPISODE_WIDTH} />)}
                </Carousel>}
                {hasResources && <div className="mt-6 px-4 sm:px-8">
                  <h2 className="mb-4 break-words text-xl font-bold">{modules.length > 1 ? `${m.title} · Downloads e links` : 'Downloads e links'}</h2>
                  <ResourceList items={m.items} storeSlug={store.slug} />
                </div>}
              </section>
            )
          })}
        </div>
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
