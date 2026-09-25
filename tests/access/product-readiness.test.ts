import { describe, expect, it } from 'vitest'
import { assessProductReadiness } from '@/lib/access/product-readiness'
import type { AccessLevel, ContentMode } from '@/lib/domain/types'

const material = { kind: 'arquivo' as const, url: 'https://example.com/guia.pdf', isPublished: true }
const moduleFor = (requiredLevel: AccessLevel) => ({ requiredLevel, isPublished: true, items: [material] })

describe('prontidão de produtos para os níveis comercializados', () => {
  it.each<{ mode: ContentMode; levels: AccessLevel[]; offered: AccessLevel[]; empty: AccessLevel[] }>([
    { mode: 'versions', levels: ['basic'], offered: ['complete'], empty: ['complete'] },
    { mode: 'sections', levels: ['basic'], offered: ['complete'], empty: [] },
    { mode: 'versions', levels: ['complete'], offered: ['complete'], empty: [] },
    { mode: 'versions', levels: ['complete'], offered: ['basic', 'complete'], empty: ['basic'] },
    { mode: 'sections', levels: ['complete'], offered: ['basic', 'complete'], empty: ['basic'] },
    { mode: 'versions', levels: ['basic', 'complete'], offered: ['basic', 'complete'], empty: [] },
    { mode: 'versions', levels: [], offered: ['basic', 'complete', 'complete'], empty: ['basic', 'complete'] },
    { mode: 'versions', levels: [], offered: [], empty: [] },
  ])('respeita $mode com materiais $levels e venda $offered', ({ mode, levels, offered, empty }) => {
    expect(assessProductReadiness({ mode, modules: levels.map(moduleFor), offeredLevels: offered }).emptyLevels).toEqual(empty)
  })

  it('ignora módulos e materiais não publicados ou URLs inválidas', () => {
    const modules = [
      { ...moduleFor('basic'), isPublished: false },
      { ...moduleFor('basic'), items: [{ ...material, isPublished: false }] },
      ...['', 'javascript:alert(1)', 'not-a-url', 'https://user:password@example.com/file'].map(url => ({
        ...moduleFor('basic'), items: [{ ...material, url }],
      })),
    ]
    expect(assessProductReadiness({ mode: 'versions', modules, offeredLevels: ['basic'] }).emptyLevels).toEqual(['basic'])
  })

  it.each([
    ['arquivo', 'https://example.com/file.pdf'],
    ['link', 'https://drive.google.com/file/d/123/view'],
    ['video', 'https://youtu.be/dQw4w9WgXcQ'],
    ['video', 'https://vimeo.com/123456'],
    ['video', 'https://player-vz.pandavideo.com.br/embed/?v=12345678-1234-1234-1234-123456789012'],
  ] as const)('considera %s utilizável com URL suportada', (kind, url) => {
    expect(assessProductReadiness({ mode: 'versions', modules: [{ ...moduleFor('complete'), items: [{ ...material, kind, url }] }], offeredLevels: ['complete'] }).emptyLevels).toEqual([])
  })

  it.each(['https://youtube.com/watch?v=x', 'https://example.com/video'])('não conta vídeo que o player não pode abrir', url => {
    expect(assessProductReadiness({ mode: 'versions', modules: [{ ...moduleFor('complete'), items: [{ ...material, kind: 'video', url }] }], offeredLevels: ['complete'] }).emptyLevels).toEqual(['complete'])
  })

  it('informa contagens utilizáveis por acesso, sem contar rascunhos', () => {
    expect(assessProductReadiness({ mode: 'sections', modules: [moduleFor('basic'), moduleFor('complete')], offeredLevels: ['complete'] }).itemCounts).toEqual({ basic: 1, complete: 2 })
    expect(assessProductReadiness({ mode: 'versions', modules: [moduleFor('basic'), moduleFor('complete')], offeredLevels: ['complete'] }).itemCounts).toEqual({ basic: 1, complete: 1 })
  })
})
