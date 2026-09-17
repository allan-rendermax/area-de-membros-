import { ImageResponse } from 'next/og'
import { isValidStoreSlug } from '@/lib/content/slug'
import { getStoreBySlug } from '@/lib/data/stores'

const SIZES: Record<string, { size: number; padding: number }> = {
  '192': { size: 192, padding: 0 },
  '512': { size: 512, padding: 0 },
  maskable: { size: 512, padding: 100 },
}

export async function GET(_request: Request, { params }: { params: Promise<{ loja: string; size: string }> }) {
  const { loja, size } = await params
  const spec = SIZES[size]
  const store = spec && isValidStoreSlug(loja) ? await getStoreBySlug(loja) : null
  if (!spec || !store) return new Response('Not found', { status: 404 })

  const inner = spec.size - spec.padding * 2
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0c' }}>
        <div
          style={{
            width: inner,
            height: inner,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#e11d2e',
            borderRadius: spec.padding ? inner / 2 : inner * 0.2,
            color: '#ffffff',
            fontSize: inner * 0.55,
            fontWeight: 700,
          }}
        >
          {store.name.charAt(0).toUpperCase()}
        </div>
      </div>
    ),
    { width: spec.size, height: spec.size, headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
