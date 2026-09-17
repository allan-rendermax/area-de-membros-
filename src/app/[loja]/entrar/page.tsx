import { getStore } from '@/lib/membros/session'
import { entrar } from './actions'
import { EntrarForm } from './form'

export const dynamic = 'force-dynamic'

export default async function EntrarPage({ params, searchParams }: PageProps<'/[loja]/entrar'>) {
  const [{ loja }, { email }] = await Promise.all([params, searchParams])
  const store = await getStore(loja)

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-borda bg-superficie p-6">
        <p className="text-sm text-texto-suave">{store.name}</p>
        <h1 className="text-2xl font-bold">Entrar</h1>
        <EntrarForm action={entrar.bind(null, store.slug)} initialEmail={typeof email === 'string' ? email : ''} />
      </div>
    </main>
  )
}
