'use client'

import Link from 'next/link'

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold">Não foi possível carregar esta página</h1>
      <p className="text-texto-suave">Tente novamente em instantes. Seu acesso continua salvo.</p>
      <button type="button" onClick={() => retry()} className="rounded-md bg-destaque px-5 py-3 font-semibold text-texto hover:bg-destaque-hover">
        Tentar novamente
      </button>
      <Link href="/" className="text-texto-suave underline hover:text-texto">Ir para o início</Link>
    </main>
  )
}
