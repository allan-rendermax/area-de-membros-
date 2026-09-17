import { describe, expect, it } from 'vitest'
import { toVideoEmbed } from '@/lib/content/video'

describe('toVideoEmbed', () => {
  it('YouTube em vários formatos', () => {
    const expected = { provider: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }
    expect(toVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toEqual(expected)
    expect(toVideoEmbed('https://youtu.be/dQw4w9WgXcQ')).toEqual(expected)
    expect(toVideoEmbed('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual(expected)
    expect(toVideoEmbed('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(expected)
    expect(toVideoEmbed('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual(expected)
  })

  it('Vimeo público e privado', () => {
    expect(toVideoEmbed('https://vimeo.com/123456789')).toEqual({ provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789' })
    expect(toVideoEmbed('https://vimeo.com/123456789/abcdef1234')).toEqual({
      provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789?h=abcdef1234',
    })
    expect(toVideoEmbed('https://player.vimeo.com/video/123456789?h=abc123')).toEqual({
      provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/123456789?h=abc123',
    })
  })

  it('Panda', () => {
    const url = 'https://player-vz-7b6cf9e4-8bf.tv.pandavideo.com.br/embed/?v=0b7c9f0e-2d7a-4a53-9a57-1f6f3c1a2b3c'
    expect(toVideoEmbed(url)).toEqual({ provider: 'panda', embedUrl: url })
  })

  it('recusa endereços que não são vídeo suportado', () => {
    expect(toVideoEmbed('https://drive.google.com/file/d/abc')).toBeNull()
    expect(toVideoEmbed('https://www.youtube.com/watch?v=curto')).toBeNull()
    expect(toVideoEmbed('javascript:alert(1)')).toBeNull()
    expect(toVideoEmbed('não é url')).toBeNull()
  })
})
