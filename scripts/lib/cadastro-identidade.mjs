// Matches src/lib/payt/checkout.ts and the SQL canonicalization; no URL requests.
export function normalizarOferta(offer) {
  const matchType = offer.matchType ?? 'product'
  if (!['product', 'checkout', 'upsell'].includes(matchType)) throw new Error('Modo de identificação inválido.')
  const raw = offer.matchValues ?? []
  if (!Array.isArray(raw) || (matchType === 'product' ? raw.length : !raw.length)) throw new Error('Aliases ausentes ou incompatíveis com o modo do plano.')
  const matchValues = raw.map(value => {
    if (typeof value !== 'string') throw new Error('Alias inválido.')
    const input = value.trim()
    if (matchType === 'upsell') {
      if (!input || /\s/.test(input)) throw new Error('Identificador upsell inválido.')
      return input
    }
    const match = /^https:\/\/(payt\.site|checkout\.payt\.com\.br)(\/[^?#]*)?(?:[?#].*)?$/i.exec(input)
    const path = (match?.[2] ?? '').replace(/\/+$/, '')
    if (!match || /[\\\s%]/.test(match[2] ?? '') || !path || path.split('/').some(part => part === '.' || part === '..')) throw new Error('Link de checkout inválido; use HTTPS da Payt.')
    return `https://${match[1].toLowerCase()}${path}`
  })
  if (offer.checkoutCode != null && (typeof offer.checkoutCode !== 'string' || /\s/.test(offer.checkoutCode.trim()))) throw new Error('Código de referência do checkout inválido.')
  return { ...offer, matchType, checkoutCode: offer.checkoutCode?.trim() || null, matchValues: [...new Set(matchValues)] }
}

export function validarOfertas(offers) {
  const normalized = offers.map(normalizarOferta)
  for (const [index, offer] of normalized.entries()) {
    for (const other of normalized.slice(index + 1)) {
      if (offer.codigo !== other.codigo) continue
      if (offer.matchType === 'product' || other.matchType === 'product' ||
          (offer.matchType === other.matchType && offer.matchValues.some(value => other.matchValues.includes(value)))) {
        throw new Error(`Código Payt repetido com aliases ou identificação sobreposta: ${offer.codigo}.`)
      }
    }
  }
  return normalized
}
