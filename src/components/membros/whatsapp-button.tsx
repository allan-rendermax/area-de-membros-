import { WhatsAppIcon } from './icons'

export function WhatsAppFloating({ href }: { href: string | null }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com o suporte"
      className="fixed right-5 bottom-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-whatsapp text-texto shadow-lg hover:brightness-110"
    >
      <WhatsAppIcon />
    </a>
  )
}
