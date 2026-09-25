import { describe, expect, it } from 'vitest'
import { resourceLabel } from '@/lib/content/resource-label'

describe('resourceLabel', () => {
  it('usa a extensão reconhecida do caminho, sem confiar na query ou fragmento', () => {
    expect(resourceLabel({ kind: 'arquivo', url: 'https://example.test/guia.pdf?name=falso.zip#x' })).toEqual({ typeLabel: 'PDF', actionLabel: 'Acesse seu conteúdo' })
    expect(resourceLabel({ kind: 'arquivo', url: 'https://example.test/file?name=fake.pdf' })).toEqual({ typeLabel: 'Arquivo', actionLabel: 'Acesse seu conteúdo' })
  })

  it('reconhece extensões codificadas e formatos editáveis comuns', () => {
    expect(resourceLabel({ kind: 'arquivo', url: 'https://example.test/planta%2Edwg' })).toEqual({ typeLabel: 'DWG', actionLabel: 'Acesse seu conteúdo' })
    expect(resourceLabel({ kind: 'arquivo', url: 'https://example.test/modelo.skp' }).actionLabel).toBe('Acesse seu conteúdo')
    expect(resourceLabel({ kind: 'arquivo', url: 'https://example.test/planilha.xlsx' }).actionLabel).toBe('Acesse seu conteúdo')
  })

  it('trata URL malformada e tipo link sem alegar formato', () => {
    expect(resourceLabel({ kind: 'arquivo', url: 'https://example.test/%zz.pdf' })).toEqual({ typeLabel: 'Arquivo', actionLabel: 'Acesse seu conteúdo' })
    expect(resourceLabel({ kind: 'link', url: 'https://example.test/guia.pdf' })).toEqual({ typeLabel: 'Link externo', actionLabel: 'Acesse seu conteúdo' })
  })
})
