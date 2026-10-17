import { describe, expect, it } from 'vitest'
import { getCommunityWhatsappUrl } from '@/lib/community/whatsapp'
const invite = 'https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t'
describe('community invitation', () => {
  it('preserves invitation and query', () => expect(getCommunityWhatsappUrl(` ${invite} `)).toBe(invite))
  it.each([null, undefined, '', 123, 'javascript:alert(1)', 'https:chat.whatsapp.com/Example', 'https:/chat.whatsapp.com/Example', 'http://chat.whatsapp.com/abc', 'https://chat.whatsapp.com.evil.test/abc', 'https://user@chat.whatsapp.com/abc', 'https://chat.whatsapp.com:444/abc', 'https://chat.whatsapp.com/', 'https://chat.whatsapp.com/a/b', 'https://chat.whatsapp.com/abc#x', 'https://chat.whatsapp.com/abc#', 'https://chat.whatsapp.com/a\\b', 'https://chat.whatsapp.com/a\nb'])('rejects %s', value => expect(getCommunityWhatsappUrl(value)).toBeNull())
  it('preserves a case-insensitive HTTPS scheme', () => expect(getCommunityWhatsappUrl('HTTPS://chat.whatsapp.com/Example?mode=gi_t')).toBe('HTTPS://chat.whatsapp.com/Example?mode=gi_t'))
  it('allows a trailing slash and another store invitation', () => expect(getCommunityWhatsappUrl('https://chat.whatsapp.com/Other_123-/')).toBe('https://chat.whatsapp.com/Other_123-/'))
})
