import type { Store } from '@/lib/domain/types'

export type SupportContext = 'nao_encontrado' | 'geral'

export function normalizeWhatsapp(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

export function supportMessage(context: SupportContext, storeName: string, email?: string | null): string {
  if (context === 'nao_encontrado') {
    return email
      ? `Olá! Comprei um produto da ${storeName} com o e-mail ${email} e não estou conseguindo acessar.`
      : `Olá! Comprei um produto da ${storeName} e não estou conseguindo acessar.`
  }
  return email
    ? `Olá! Preciso de ajuda com a área de membros da ${storeName}. Meu e-mail é ${email}.`
    : `Olá! Preciso de ajuda com a área de membros da ${storeName}.`
}

export function supportHref(
  store: Pick<Store, 'name' | 'supportWhatsapp' | 'supportUrl'>,
  context: SupportContext,
  email?: string | null,
): string | null {
  const phone = store.supportWhatsapp ? normalizeWhatsapp(store.supportWhatsapp) : null
  if (phone) return `https://wa.me/${phone}?text=${encodeURIComponent(supportMessage(context, store.name, email))}`
  return store.supportUrl ?? null
}
