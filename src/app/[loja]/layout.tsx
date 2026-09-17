import type { Metadata } from 'next'
import { getStore } from '@/lib/membros/session'

export async function generateMetadata({ params }: { params: Promise<{ loja: string }> }): Promise<Metadata> {
  const { loja } = await params
  const store = await getStore(loja)
  return { title: store.name, robots: { index: false, follow: false } }
}

export default async function LojaLayout({ children, params }: LayoutProps<'/[loja]'>) {
  const { loja } = await params
  await getStore(loja)
  return <div className="min-h-dvh bg-fundo text-texto">{children}</div>
}
