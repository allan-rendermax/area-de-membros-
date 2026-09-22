import Link from 'next/link'
import type { Store } from '@/lib/domain/types'
import { getMemberTheme } from '@/lib/membros/theme'

export function StoreHeader({
  store,
  email,
  actions,
}: {
  store: Pick<Store, 'slug' | 'name' | 'logoUrl'>
  email: string
  actions?: React.ReactNode
}) {
  const architecture = getMemberTheme(store.slug) === 'arquitetura'
  return (
    <header className="member-header sticky top-0 z-40 bg-gradient-to-b from-fundo to-fundo/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href={`/${store.slug}`} className="flex min-w-0 items-center gap-3">
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
            <Link href={`/${store.slug}`}>Início</Link>
            <Link href={`/${store.slug}#materiais`}>Meus materiais</Link>
          </nav>
        )}
        <div className="flex items-center gap-3">
          {actions}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full bg-superficie-2 px-3 py-1.5 text-sm text-texto-suave hover:text-texto">
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
          </details>
        </div>
      </div>
    </header>
  )
}
