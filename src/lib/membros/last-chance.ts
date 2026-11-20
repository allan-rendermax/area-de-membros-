import { createHmac, timingSafeEqual } from 'node:crypto'

// Última oportunidade no primeiro acesso: o link do e-mail de acesso passa por /[loja]/acesso.
// Quem comprou um produto elegível e ainda não tem o Arq Black vê a oferta uma vez;
// os outros (e quem já viu, marcado por cookie) seguem direto para o login, como antes.

export type LastChanceRule = {
  /** Página da oferta. Recebe ?next=<login> e sempre mostra o botão de acesso. */
  offerUrl: string
  /** Códigos Payt que fazem a pessoa ver a oferta. */
  eligibleCodes: readonly string[]
  /** Códigos Payt de quem já tem o que a oferta vende: pula a oferta. */
  skipCodes: readonly string[]
}

export const LAST_CHANCE_COOKIE = 'ap_ultima_oportunidade'
export const LAST_CHANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180

// Arq Black de todas as linhas (plano "Acesso total"): quem tem qualquer um já tem tudo.
const ARQ_BLACK_CODES = ['45E268', '4Z3KBP', 'LG5QNN', 'LX365X', '4Z3GZM', 'RV372G'] as const

export const LAST_CHANCE_RULES: Readonly<Record<string, LastChanceRule>> = {
  arquitetura: {
    offerUrl: 'https://patologias.casadoconhecimento.online/ultima-oportunidade',
    // Atlas Patologias Completo (LGADK6) e Básico (45WX6J).
    eligibleCodes: ['LGADK6', '45WX6J'],
    skipCodes: ARQ_BLACK_CODES,
  },
}

// Assinatura do link: sem ela, a rota não consulta compras (evita descobrir o que um e-mail comprou).
export function accessSignature(secret: string, storeSlug: string, email: string): string {
  return createHmac('sha256', secret).update(`ultima-oportunidade|${storeSlug}|${email}`).digest('hex').slice(0, 32)
}

export function isValidAccessSignature(secret: string, storeSlug: string, email: string, signature: string): boolean {
  const expected = Buffer.from(accessSignature(secret, storeSlug, email))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export function accessUrlFor(appUrl: string, storeSlug: string, email: string, secret: string): string {
  const sig = accessSignature(secret, storeSlug, email)
  return `${appUrl.replace(/\/$/, '')}/${storeSlug}/acesso?email=${encodeURIComponent(email)}&sig=${sig}`
}

/** Quem vai ver a oferta no 1º clique (mesma regra da rota /acesso). */
export function isLastChanceEligible(rule: LastChanceRule | undefined, paidCodes: readonly string[]): boolean {
  return lastChanceTarget(rule, paidCodes, '') !== null
}

/** Para onde mandar no clique do e-mail. null = login direto. */
export function lastChanceTarget(
  rule: LastChanceRule | undefined,
  paidCodes: readonly string[],
  loginUrl: string,
): string | null {
  if (!rule) return null
  const codes = new Set(paidCodes)
  if (rule.skipCodes.some((code) => codes.has(code))) return null
  if (!rule.eligibleCodes.some((code) => codes.has(code))) return null
  return `${rule.offerUrl}?next=${encodeURIComponent(loginUrl)}`
}
