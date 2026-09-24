import Link from 'next/link'
import type { Store } from '@/lib/domain/types'
import { getMemberTheme } from '@/lib/membros/theme'
import { withPreview } from '@/lib/membros/paths'

export function StoreHeader({
  store,
  email,
  actions,
  active,
  legacyHome = false,
  preview = false,
}: {
  store: Pick<Store, 'slug' | 'name' | 'logoUrl'>
  email: string
  actions?: React.ReactNode
  active?: 'home' | 'materials'
  legacyHome?: boolean
  preview?: boolean
}) {
  const architecture = getMemberTheme(store.slug) === 'arquitetura'
  return (
    <header className="member-header sticky top-0 z-40 bg-gradient-to-b from-fundo to-fundo/85 backdrop-blur">
      {preview && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-borda bg-superficie px-4 py-2 text-xs sm:px-8">
        <p><strong>Modo de prévia</strong> · Inclui rascunhos · Nenhum progresso é registrado</p>
        <Link href="/admin/produtos" className="inline-flex min-h-9 items-center font-semibold text-destaque underline underline-offset-4">Voltar ao painel</Link>
      </div>}
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href={withPreview(`/${store.slug}`, preview)} className="flex min-w-0 items-center gap-3">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="h-8 w-auto" />
          ) : (
            <span className="member-brand-mark grid h-8 w-8 shrink-0 place-items-center rounded bg-destaque font-bold text-texto">
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="member-brand truncate font-semibold">{store.name}</span>
        </Link>
        {architecture && (
          <nav className="arq-nav mr-auto" aria-label="Navegação da arquitetura">
            <Link href={withPreview(`/${store.slug}`, preview)} aria-current={active === 'home' ? 'page' : undefined}>Início</Link>
            <Link href={withPreview(`/${store.slug}#materiais`, preview)} aria-current={active === 'materials' ? 'location' : undefined}>Meus materiais</Link>
          </nav>
        )}
        <div className="flex items-center gap-3">
          {architecture && !legacyHome && <Link href={withPreview(`/${store.slug}#materiais`, preview)} aria-current={active === 'materials' ? 'location' : undefined} className="inline-flex min-h-11 items-center text-xs font-semibold text-texto hover:text-destaque sm:hidden">Meus materiais</Link>}
          {!preview && actions}
          {!preview && <details className="relative">
            <summary className={`${legacyHome ? '' : 'flex min-h-11 items-center '}cursor-pointer list-none rounded-full bg-superficie-2 px-3 py-1.5 text-sm text-texto-suave hover:text-texto`}>
              Conta
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-md border border-borda bg-superficie p-3 text-sm shadow-xl">
              <p className="truncate text-texto-suave">{email}</p>
              <form action={`/sair?loja=${store.slug}`} method="post" className="mt-3">
                <button type="submit" className="w-full rounded-md bg-superficie-2 px-3 py-2 text-left hover:bg-borda">
                  Sair
                </button>
              </form>
            </div>
          </details>}
        </div>
      </div>
    </header>
  )
}
