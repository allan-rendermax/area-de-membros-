import { describe, expect, it } from 'vitest'
import { normalizeCheckoutUrl, normalizeUpsellCode } from '@/lib/payt/checkout'
import { parsePaytPostback } from '@/lib/payt/parse'

describe('authenticated Payt identifier normalization',()=>{
 it.each([
  ['https://PAYT.site/AbC/?utm=x#hash','https://payt.site/AbC'],
  [' https://checkout.payt.com.br/AbCd/ ','https://checkout.payt.com.br/AbCd'],
  ['https://payt.site/abc','https://payt.site/abc'],
  ['http://payt.site/AbC',null], ['https://evil.test/AbC',null],
  ['https://payt.site.evil.test/AbC',null], ['https://payt.site@evil.test/AbC',null],
  ['https://user@payt.site/AbC',null], ['https://payt.site:443/AbC',null],
  ['https://payt.site/',null], ['https://payt.site/a/../b',null],
  ['https://payt.site/%41',null], ['https://payt.site/a b',null], ['https://payt.site/a\\b',null],
 ])('normalizes %s to %s',(input,expected)=>{ expect(normalizeCheckoutUrl(input)).toBe(expected) })
 it('preserves upsell case and rejects whitespace inside code',()=>{
  expect(normalizeUpsellCode(' Up-A ')).toBe('Up-A'); expect(normalizeUpsellCode('UP A')).toBeNull()
 })
 it('keeps invalid identifiers observable without dropping a refund event',()=>{
  const result=parsePaytPostback({transaction_id:'TX',status:'refunded',customer:{email:'a@example.test'},product:{code:'SHARED'},link:{url:'https://evil.test/X'}})
  expect(result.ok && result.value.products[0]).toMatchObject({code:'SHARED',identifierInvalid:true})
 })
})
