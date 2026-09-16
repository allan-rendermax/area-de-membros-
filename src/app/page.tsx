import { redirect } from 'next/navigation'
import { buildVitrine } from '@/lib/access/access'
import { loadCustomerAccess } from '@/lib/data/access'
import { getDefaultStore } from '@/lib/data/stores'
import { createClient } from '@/lib/supabase/server'
import { LockedCard } from './vitrine/locked-card'

export const dynamic = 'force-dynamic'

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
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {store.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-8 w-auto" />
            )}
            <span className="font-semibold">{store.name}</span>
          </div>
          <form action="/sair" method="post">
            <button type="submit" className="text-sm text-zinc-600">Sair</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section>
          <h2 className="mb-4 text-lg font-bold">Seus materiais</h2>
          {vitrine.unlocked.length === 0 ? (
            <p className="text-zinc-600">Seus materiais aparecem aqui assim que o pagamento for confirmado.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {vitrine.unlocked.map((item) =>
                item.unlocked ? (
                  <li key={item.id} className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
                    <div className="aspect-[3/4] bg-zinc-100">
                      {item.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-3">
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm font-semibold text-white"
                      >
                        Baixar
                      </a>
                    </div>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>

        {vitrine.locked.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-bold">Desbloqueie mais</h2>
            <ul className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
