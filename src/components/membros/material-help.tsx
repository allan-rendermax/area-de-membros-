import { isHttpUrl } from '@/lib/content/url'
import { SUPPORT_EMAIL } from '@/lib/support/contact'

export function MaterialHelp({ href, context = 'material' }: { href: string | null; context?: 'login' | 'material' }): React.JSX.Element {
  const contact = href && isHttpUrl(href) ? href : null
  const isWhatsapp = contact ? ['wa.me', 'api.whatsapp.com', 'www.whatsapp.com'].includes(new URL(contact).hostname) : false
  return (
    <details className="group rounded-xl border border-borda bg-superficie p-4 text-sm text-texto-suave">
      <summary className="cursor-pointer font-semibold text-texto marker:text-destaque">Precisa de ajuda?</summary>
      <div className="mt-3 space-y-2 leading-relaxed">
        {context === 'login' ? (
          <>
            <p>Entre com o e-mail da compra. Confira também a caixa de spam e confirme o endereço no comprovante.</p>
            <p>Se ainda não conseguir acessar, use um dos contatos de suporte abaixo.</p>
          </>
        ) : (
          <>
            <p>Depois de baixar, procure o arquivo na pasta Downloads do seu dispositivo.</p>
            <p>Alguns formatos precisam de um aplicativo compatível para abrir. Se o arquivo não abrir, confira se o aplicativo aceita esse formato.</p>
            <p>Se o acesso ou download falhar, use um dos contatos de suporte abaixo.</p>
          </>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {contact && (
            <a href={contact} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-destaque underline underline-offset-4">
              {isWhatsapp ? 'Falar pelo WhatsApp' : 'Falar com o suporte'}
            </a>
          )}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center font-semibold text-destaque underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </details>
  )
}
