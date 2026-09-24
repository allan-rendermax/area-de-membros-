import { InstallAppButton } from '@/components/membros/install-app-button'
import { WhatsAppFloating } from '@/components/membros/whatsapp-button'
import { ContentImage } from '@/components/membros/content-image'
import { MaterialHelp } from '@/components/membros/material-help'
import { freshFormStamp } from '@/lib/auth/login-guard'
import { coverGradient } from '@/lib/content/cover'
import { env } from '@/lib/env'
import { getStore } from '@/lib/membros/session'
import { supportHref } from '@/lib/support/whatsapp'
import { entrar } from './actions'
import { EntrarForm } from './form'
import { ARCHITECTURE_HERO, getMemberTheme } from '@/lib/membros/theme'

export const dynamic = 'force-dynamic'

const BACKDROP_SIZES = '(min-width: 1280px) calc(100vw - 34rem), (min-width: 1024px) calc(100vw - 30rem), 100vw'

function Backdrop({ imageUrl, seed }: { imageUrl: string | null; seed: string }) {
  return imageUrl ? (
    <ContentImage src={imageUrl} sizes={BACKDROP_SIZES} eager className="absolute inset-0 h-full w-full object-cover" />
  ) : (
    <div className="absolute inset-0" style={{ backgroundImage: coverGradient(seed) }} />
  )
}

export default async function EntrarPage({ params, searchParams }: PageProps<'/[loja]/entrar'>) {
  const [{ loja }, { email }] = await Promise.all([params, searchParams])
  const store = await getStore(loja)
  const stamp = freshFormStamp(env.loginGuardSecret)
  const support = supportHref(store, 'geral')
  const architecture = getMemberTheme(store.slug) === 'arquitetura'
  const loginImage = store.loginImageUrl ?? (architecture ? ARCHITECTURE_HERO : null)

  return (
    <div className="relative flex min-h-dvh">
      <div className="absolute inset-0 overflow-hidden lg:hidden" aria-hidden>
        <Backdrop imageUrl={loginImage} seed={store.id} />
        <div className="absolute inset-0 bg-gradient-to-b from-fundo/60 via-fundo/85 to-fundo" />
      </div>

      <aside className="relative hidden flex-1 overflow-hidden lg:block">
        <Backdrop imageUrl={loginImage} seed={store.id} />
        <div className="absolute inset-0 bg-gradient-to-r from-fundo/40 via-fundo/50 to-fundo" aria-hidden />
        <div className="member-login-copy absolute inset-x-0 bottom-0 flex flex-col gap-4 p-12 xl:p-16">
          <span className="w-fit rounded-full border border-borda bg-superficie/70 px-3 py-1 text-xs text-texto-suave">Área de membros</span>
          <h2 className="max-w-xl text-4xl leading-tight font-bold xl:text-5xl">
            {architecture ? <>Suas ideias.<br /><span className="text-destaque">O próximo passo.</span></> : <>Seus materiais em <span className="text-destaque">um só lugar</span></>}
          </h2>
          <p className="max-w-lg text-sm text-texto-suave">Acesse tudo o que você comprou em {store.name}, no celular ou no computador.</p>
        </div>
      </aside>

      <div className="member-login-panel relative flex w-full flex-col justify-center px-4 py-10 sm:px-6 lg:w-[30rem] lg:shrink-0 lg:border-l lg:border-borda lg:bg-superficie lg:px-10 xl:w-[34rem]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-center justify-center gap-3 lg:justify-start">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt="" className="h-10 w-auto" />
            ) : (
              <span className="member-brand-mark grid h-10 w-10 place-items-center rounded-md bg-destaque text-lg font-bold text-texto">
                {store.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-lg font-semibold">{store.name}</span>
          </div>

          <div className="rounded-2xl border border-borda bg-superficie/90 p-5 shadow-2xl backdrop-blur lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
            <h1 className="text-lg font-semibold">Entrar</h1>
            <p className="mt-1 text-sm text-texto-suave">Use o e-mail da sua compra. Sem senha.</p>
            <EntrarForm
              action={entrar.bind(null, store.slug)}
              initialEmail={typeof email === 'string' ? email : ''}
              stamp={stamp}
              turnstileSiteKey={env.turnstileSiteKey && env.turnstileSecretKey ? env.turnstileSiteKey : null}
            />
            <div className="mt-5"><MaterialHelp href={support} context="login" /></div>
          </div>
          <div className="mt-6 flex justify-center lg:justify-start">
            <InstallAppButton />
          </div>
        </div>
      </div>

      <WhatsAppFloating href={support} />
    </div>
  )
}
