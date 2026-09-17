import { isValidStoreSlug } from '@/lib/content/slug'
import { getStoreBySlug } from '@/lib/data/stores'

export async function GET(_request: Request, { params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params
  const store = isValidStoreSlug(loja) ? await getStoreBySlug(loja) : null
  if (!store) return new Response('Not found', { status: 404 })

  const manifest = {
    id: `/${store.slug}`,
    name: store.name,
    short_name: store.name.slice(0, 12),
    start_url: `/${store.slug}`,
    scope: `/${store.slug}`,
    display: 'standalone',
    background_color: '#0b0b0c',
    theme_color: '#0b0b0c',
    lang: 'pt-BR',
    icons: [
      { src: `/icons/${store.slug}/192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${store.slug}/512`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${store.slug}/maskable`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  })
}
