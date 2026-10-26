import { describe, expect, it } from 'vitest'
import { memberResourceLabel } from '@/lib/content/member-resource-label'

describe('memberResourceLabel', () => {
  it.each([
    ['Atlas Tropical', undefined, 'Atlas', 'Abrir Atlas'],
    ['Guia de Plantio', 'Atlas Tropical', 'Guia', 'Abrir Guia'],
    ['Guias práticos', undefined, 'Guia', 'Abrir Guia'],
    ['Material', 'Atlas Tropical', 'Atlas', 'Abrir Atlas'],
    ['Material', 'Guia Tropical', 'Guia', 'Abrir Guia'],
    ['Material', 'Paisagismo', 'Material digital', 'Abrir material'],
    ['Atlasfera e guiar', undefined, 'Material digital', 'Abrir material'],
  ])('names PDF %s using item before product', (title, productTitle, typeLabel, actionLabel) => {
    expect(memberResourceLabel({ kind: 'arquivo', title, url: 'https://example.test/guia%2EPDF' }, productTitle)).toEqual({ typeLabel, actionLabel })
  })
  it.each([
    ['https://example.test/file?name=a.pdf', 'Arquivo'],
    ['https://example.test/%zz.pdf', 'Arquivo'],
    ['invalid.pdf', 'Arquivo'],
    ['https://example.test/file.dwg', 'DWG'],
    ['https://example.test/file.skp', 'SKP'],
    ['https://example.test/file.xlsx', 'XLSX'],
  ])('preserves existing format detection for %s', (url, typeLabel) => {
    expect(memberResourceLabel({ kind: 'arquivo', title: 'Atlas', url })).toEqual({ typeLabel, actionLabel: 'Acesse seu conteúdo' })
  })
  it('preserves external link and video actions', () => {
    expect(memberResourceLabel({ kind: 'link', title: 'Atlas', url: 'https://example.test/a.pdf' })).toEqual({ typeLabel: 'Link externo', actionLabel: 'Acesse seu conteúdo' })
    expect(memberResourceLabel({ kind: 'video', title: 'Guia', url: 'https://example.test/a.pdf' })).toEqual({ typeLabel: 'Conteúdo', actionLabel: 'Acesse seu conteúdo' })
  })
})
