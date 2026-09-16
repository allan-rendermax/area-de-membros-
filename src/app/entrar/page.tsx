import { getDefaultStore } from '@/lib/data/stores'
import { EntrarForm } from './form'

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams
  const store = await getDefaultStore()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm text-zinc-500">{store.name}</p>
        <h1 className="mb-6 mt-1 text-2xl font-bold">Acesse seus materiais</h1>
        <EntrarForm initialEmail={email} supportUrl={store.supportUrl} />
      </div>
    </main>
  )
}
