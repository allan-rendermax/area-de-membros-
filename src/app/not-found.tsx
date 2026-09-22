import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <p className="text-sm text-texto-suave">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-texto-suave">Confira o endereço ou volte ao início para acessar seus produtos.</p>
      <Link href="/" className="rounded-md bg-destaque px-5 py-3 font-semibold text-texto hover:bg-destaque-hover">Ir para o início</Link>
    </main>
  )
}
