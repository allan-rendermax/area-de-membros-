import { describe, expect, it } from 'vitest'
import { grantedProductLevels } from '@/lib/access/access'
import { parsePaytPostback } from '@/lib/payt/parse'
import type { ProductLink } from '@/lib/domain/types'

const links = [
  { productCode: 'SHARED', offerId: 'basic', matchType: 'checkout', productId: 'atlas', grantLevel: 'basic' },
  { productCode: 'SHARED', offerId: 'full', matchType: 'checkout', productId: 'atlas', grantLevel: 'complete' },
] as ProductLink[]
const event = { transaction_id: 'TX', status: 'paid', customer: { email: 'a@example.test' }, product: { code: 'SHARED' } }

describe('checkout entitlements', () => {
  it('isolates a basic purchase from the complete plan sharing its code', () => {
    expect(grantedProductLevels([{ productCode: 'SHARED', offerId: 'basic', status: 'pago' }], links, false).get('atlas')).toBe('basic')
  })
  it('never grants an unresolved shared code or mismatched binding', () => {
    expect(grantedProductLevels([{ productCode: 'SHARED', status: 'pago' }], links, false).size).toBe(0)
    expect(grantedProductLevels([{ productCode: 'OTHER', offerId: 'full', status: 'pago' }], links, false).size).toBe(0)
  })
  it('keeps basic after a separate complete purchase is refunded', () => {
    expect(grantedProductLevels([
      { productCode: 'SHARED', offerId: 'basic', status: 'pago' },
      { productCode: 'SHARED', offerId: 'full', status: 'reembolsado' },
    ], links, false).get('atlas')).toBe('basic')
  })
  it('normalizes own identifiers without copying them into bumps', () => {
    const result = parsePaytPostback({ ...event, link: { url: 'https://PAYT.site/AbC/?utm_source=x#y' }, upsell_code: ' UP ',
      order_bumps: [{ code: 'B1' }, { code: 'B2', link: { url: 'https://checkout.payt.com.br/Def/?x=1' }, upsell_code: ' BUMP ' }] })
    expect(result.ok && result.value.products).toEqual([
      { code: 'SHARED', name: '', amountCents: null, checkoutUrl: 'https://payt.site/AbC', upsellCode: 'UP' },
      { code: 'B1', name: '', amountCents: null },
      { code: 'B2', name: '', amountCents: null, checkoutUrl: 'https://checkout.payt.com.br/Def', upsellCode: 'BUMP' },
    ])
  })
  it('rejects duplicate product lines carrying conflicting identifiers', () => {
    expect(parsePaytPostback({ ...event, link: { url: 'https://payt.site/Basic' }, order_bumps: [{ code: 'SHARED', link: { url: 'https://payt.site/Full' } }] }).ok).toBe(false)
  })
})
