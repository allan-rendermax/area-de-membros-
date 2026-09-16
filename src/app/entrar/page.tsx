import { getDefaultStore } from '@/lib/data/stores'
import { EntrarForm } from './form'

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams
  const store = await getDefaultStore()

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-papel shadow-[0_1px_0_rgb(29_41_53/0.12),0_20px_40px_-24px_rgb(29_41_53/0.5)]">
        <div className="bg-tinta px-6 pt-7 pb-6 sm:px-8">
          <p className="text-sm font-medium text-junta">{store.name}</p>
          <h1 className="mt-1 text-[2.2rem] leading-[0.95] font-extrabold text-papel [font-stretch:72%]">
            Acesse seus materiais
          </h1>
          <span className="mt-4 block h-[3px] w-10 bg-sinal" aria-hidden />
        </div>
        <div className="p-6 sm:p-8">
          <EntrarForm initialEmail={email} supportUrl={store.supportUrl} />
        </div>
      </div>
    </main>
  )
}
