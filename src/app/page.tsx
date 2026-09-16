import { redirect } from 'next/navigation'
import { buildVitrine } from '@/lib/access/access'
import { loadCustomerAccess } from '@/lib/data/access'
import { getDefaultStore } from '@/lib/data/stores'
import { createClient } from '@/lib/supabase/server'
import { Cover } from './vitrine/cover'
import { LockedCard } from './vitrine/locked-card'

export const dynamic = 'force-dynamic'

const grid = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-8'

export default async function VitrinePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user?.email) redirect('/entrar')

  const store = await getDefaultStore()
  const { customer, materials, granted } = await loadCustomerAccess(store.id, data.user.email)

  if (!customer || customer.blockedAt) {
    await supabase.auth.signOut()
    redirect('/entrar')
  }

  const vitrine = buildVitrine(materials, granted)

  return (
    <div className="min-h-dvh">
      <header className="border-b border-junta bg-papel/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {store.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-8 w-auto" />
            )}
            <span className="text-lg font-bold [font-stretch:80%]">{store.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-grafite sm:inline">{customer.email}</span>
            <form action="/sair" method="post">
              <button type="submit" className="text-sm font-medium text-grafite hover:text-tinta">Sair</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        <section aria-labelledby="seus-materiais">
          <h2 id="seus-materiais" className="mb-6 text-[2rem] leading-none font-extrabold [font-stretch:72%] sm:text-[2.6rem]">
            Seus materiais
          </h2>
          {vitrine.unlocked.length === 0 ? (
            <p className="max-w-prose text-grafite">Seus materiais aparecem aqui assim que o pagamento for confirmado.</p>
          ) : (
            <ul className={grid}>
              {vitrine.unlocked.map((item) =>
                item.unlocked ? (
                  <li key={item.id} className="flex flex-col gap-3">
                    <Cover title={item.title} coverUrl={item.coverUrl} />
                    <h3 className="text-[0.95rem] leading-snug font-semibold">{item.title}</h3>
                    <a
                      href={item.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto rounded-md bg-tinta px-3 py-2.5 text-center text-sm font-semibold text-papel hover:bg-tinta-suave"
                    >
                      Baixar
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>

        {vitrine.locked.length > 0 && (
          <section aria-labelledby="desbloqueie" className="mt-16 border-t border-junta pt-10">
            <h2 id="desbloqueie" className="mb-2 text-[1.6rem] leading-none font-extrabold [font-stretch:72%] sm:text-[2rem]">
              Desbloqueie mais
            </h2>
            <p className="mb-6 max-w-prose text-grafite">Toque em um material para ver o que ele traz.</p>
            <ul className={grid}>
              {vitrine.locked.map((item) =>
                item.unlocked ? null : (
                  <li key={item.id} className="flex">
                    <LockedCard item={item} />
                  </li>
                ),
              )}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
