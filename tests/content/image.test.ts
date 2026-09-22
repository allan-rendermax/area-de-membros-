import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'
import { isOptimizableImage } from '@/lib/content/image'

describe('política de otimização de imagens de conteúdo', () => {
  it.each([
    '/covers/a.png',
    '/a/b/c.jpeg',
    '/covers/a.webp',
    '/covers/a.avif',
    'https://project.supabase.co/storage/v1/object/public/covers/a.jpg',
    'https://another-project.supabase.co/storage/v1/object/public/covers/folder/a.AVIF',
  ])('otimiza raster permitido: %s', (src) => {
    expect(isOptimizableImage(src)).toBe(true)
  })

  it.each([
    '//example.com/a.png',
    '/covers/a.jpg?version=1',
    '/covers/a.jpg#preview',
    '/covers\\a.jpg',
    '/covers/a.gif',
    '/covers/a.svg',
    '/covers/a.JPG',
    '/covers/a.AVIF',
    'http://project.supabase.co/storage/v1/object/public/covers/a.jpg',
    'https://project.supabase.co/storage/v1/object/sign/covers/a.jpg?token=x',
    'https://project.supabase.co/storage/v1/object/public/other/a.jpg',
    'https://project.supabase.co/storage/v1/object/public/covers/a.jpg?version=1',
    'https://project.supabase.co/storage/v1/object/public/covers/a.jpg#preview',
    'https://user:secret@project.supabase.co/storage/v1/object/public/covers/a.jpg',
    'https://project.supabase.co:443/storage/v1/object/public/covers/a.jpg',
    'https://project.supabase.co:8443/storage/v1/object/public/covers/a.jpg',
    'https://supabase.co/storage/v1/object/public/covers/a.jpg',
    'https://example.com/a.jpg',
    'data:image/png;base64,abc',
  ])('mantém fonte original fora da política: %s', (src) => {
    expect(isOptimizableImage(src)).toBe(false)
  })

  it('configura o otimizador com a mesma fronteira HTTPS do bucket público de capas', () => {
    expect(nextConfig.images?.remotePatterns).toEqual([
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/covers/**',
        search: '',
      },
    ])
  })
})
