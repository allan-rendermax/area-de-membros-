import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AutoCover } from '@/components/membros/auto-cover'
import { Carousel } from '@/components/membros/carousel'
import { EPISODE_WIDTH, EpisodeCard } from '@/components/membros/episode-card'
import { StoreHeader } from '@/components/membros/store-header'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { loadStoreAccess } from '@/lib/data/access'
import { getProductBySlug, listModulesWithItems } from '@/lib/data/products'
import { requireStoreSession } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'

export const dynamic = 'force-dynamic'

export default async function ProdutoPage({ params }: PageProps<'/[loja]/produto/[slug]'>) {
  const { loja, slug } = await params
  const { store, customer } = await requireStoreSession(loja)
  const product = await getProductBySlug(store.id, slug)
  if (!product || !product.isPublished) notFound()

  const { granted } = await loadStoreAccess(store.id, customer.email)
  if (!granted.has(product.id)) redirect(`/${store.slug}?comprar=${product.slug}`)

  const modules = (await listModulesWithItems(product.id, { publishedOnly: true })).filter((m) => m.items.length > 0)
  const support = supportHref(store, 'geral', customer.email)

  return (
    <>
      <StoreHeader store={store} email={customer.email} />
      <main className="pb-24">
        <section className="relative">
          <AutoCover seed={product.id} title="" imageUrl={product.bannerUrl ?? product.coverUrl} aspect="banner" className="max-h-[55vh] w-full rounded-none sm:aspect-[21/9]" />
          <div className="absolute inset-0 bg-gradient-to-t from-fundo via-fundo/50 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-8 sm:pb-10">
            <Link href={`/${store.slug}`} className="text-sm text-texto-suave hover:text-texto">
              ← Voltar
            </Link>
            <h1 className="mt-2 max-w-3xl text-3xl leading-tight font-extrabold sm:text-5xl">{product.title}</h1>
            {product.description && <p className="mt-3 line-clamp-4 max-w-2xl text-sm text-texto-suave sm:text-base">{product.description}</p>}
          </div>
        </section>

        {modules.length === 0 && <p className="px-4 pt-6 text-texto-suave sm:px-8">Nenhum conteúdo publicado ainda.</p>}

        {modules.length === 1 && (
          <section className="px-4 pt-6 sm:px-8" aria-label="Conteúdo">
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modules[0].items.map((item) => (
                <li key={item.id}>
                  <EpisodeCard item={item} storeSlug={store.slug} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {modules.length > 1 && (
          <div className="flex flex-col gap-8 pt-6">
            {modules.map((m) => (
              <Carousel key={m.id} title={m.title}>
                {m.items.map((item) => (
                  <EpisodeCard key={item.id} item={item} storeSlug={store.slug} className={EPISODE_WIDTH} />
                ))}
              </Carousel>
            ))}
          </div>
        )}
      </main>
      <WhatsAppFloating href={support} />
    </>
  )
}
