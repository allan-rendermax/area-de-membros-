import type { Metadata } from 'next'
import { getStore } from '@/lib/membros/session'
import { Barlow_Condensed } from 'next/font/google'
import { MemberTheme } from '@/components/membros/member-theme'
import { getMemberTheme } from '@/lib/membros/theme'
import './architecture.css'

const display = Barlow_Condensed({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-arquitetura-display', display: 'swap' })

export async function generateMetadata({ params }: { params: Promise<{ loja: string }> }): Promise<Metadata> {
  const { loja } = await params
  const store = await getStore(loja)
  return {
    title: store.name,
    robots: { index: false, follow: false },
    manifest: `/${store.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: store.name, statusBarStyle: 'black-translucent' },
    icons: { apple: `/icons/${store.slug}/192` },
  }
}

export default async function LojaLayout({ children, params }: LayoutProps<'/[loja]'>) {
  const { loja } = await params
  const store = await getStore(loja)
  const theme = getMemberTheme(store.slug)
  return <MemberTheme theme={theme} className={theme ? display.variable : ''}>{children}</MemberTheme>
}
