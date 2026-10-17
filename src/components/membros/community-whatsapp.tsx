import { getCommunityWhatsappUrl } from '@/lib/community/whatsapp'
import { WhatsAppIcon } from './icons'
import styles from './community-whatsapp.module.css'

export function CommunityWhatsapp({ url }: { url?: string | null }) {
  const href = getCommunityWhatsappUrl(url)
  if (!href) return null
  return (
    <div className={styles.container}>
      <a className={styles.pill} href={href} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon className={styles.icon} />
        <span>Entrar no grupo do WhatsApp</span>
      </a>
    </div>
  )
}
