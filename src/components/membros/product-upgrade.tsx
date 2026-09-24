import { isHttpUrl } from '@/lib/content/url'
import type { AccessLevel } from '@/lib/domain/types'

export function ProductUpgrade({ level, lockedCount, checkoutUrl, refreshHref }: {
  level: AccessLevel
  lockedCount: number
  checkoutUrl?: string | null
  refreshHref: string
}) {
  if (level !== 'basic' || lockedCount === 0) return null
  return <div className="mt-8 rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
    <h2 className="text-xl font-bold">Conteúdos da versão completa</h2>
    <p className="mt-2 text-sm text-texto-suave">{lockedCount} {lockedCount === 1 ? 'módulo exclusivo' : 'módulos exclusivos'} aguardando desbloqueio.</p>
    {checkoutUrl && isHttpUrl(checkoutUrl)
      ? <a href={checkoutUrl} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-destaque px-5 py-2.5 text-sm font-bold text-white hover:bg-destaque/80">Desbloquear versão completa</a>
      : <p className="mt-3 text-sm text-texto-suave">Para liberar os extras, entre em contato com o suporte.</p>}
    <p className="mt-3"><a href={refreshHref} className="text-sm font-semibold text-destaque underline underline-offset-4">Já paguei, atualizar acesso</a></p>
  </div>
}
