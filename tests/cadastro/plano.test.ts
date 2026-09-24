import { describe, expect, it } from 'vitest'
import { gerarSlug, lerFicha, montarPlano } from '../../scripts/lib/cadastro-plano.mjs'

const fichaBase = 'nome: Kit de Inspeção\nid: ABC123\ntag: front\nloja: arquitetura'
const arquivo = (relativePath: string) => ({ relativePath, absolutePath: `C:/produto/${relativePath}`, size: 42 })

describe('ficha do produto', () => {
  it('gera slug sem acentos nem pontuação', () => {
    expect(gerarSlug('Inspeção & Construção')).toBe('inspecao-construcao')
  })

  it('lê campos e descrição multilinha, BOM, CRLF e comentários', () => {
    const ficha = lerFicha('\uFEFF# Modelo\r\nnome: Kit de Inspeção\r\nid: ABC123\r\ntag: front\r\nloja: arquitetura\r\nordem: -2\r\ndestaque: não\r\ndescricao: Primeira linha\r\n# isto integra a descrição\r\nÚltima linha')
    expect(ficha).toEqual({ nome: 'Kit de Inspeção', id: 'ABC123', tag: 'front', loja: 'arquitetura', slug: 'kit-de-inspecao', trilha: '', checkout: null, destaque: false, ordem: -2, descricao: 'Primeira linha\n# isto integra a descrição\nÚltima linha' })
  })

  it('usa loja padrão e lê checkout válido', () => {
    expect(lerFicha('nome: Kit\nid: K1\ntag: upsell\ncheckout: https://payt.example/a', { defaultStoreSlug: 'arquitetura' })).toMatchObject({ loja: 'arquitetura', checkout: 'https://payt.example/a' })
  })

  it.each([
    ['nome ausente', 'id: A\ntag: front\nloja: arquitetura', /nome/i],
    ['id com espaço', 'nome: Kit\nid: A B\ntag: front\nloja: arquitetura', /id/i],
    ['tag inválida', 'nome: Kit\nid: A\ntag: bonus\nloja: arquitetura', /tag/i],
    ['checkout ausente', 'nome: Kit\nid: ABC\ntag: upsell', /checkout/i],
    ['checkout inseguro', `${fichaBase}\ncheckout: javascript:alert(1)`, /checkout/i],
    ['ordem fracionária', `${fichaBase}\nordem: 1.5`, /ordem/i],
    ['ordem fora do PostgreSQL', `${fichaBase}\nordem: 2147483648`, /ordem/i],
    ['slug inválido', `${fichaBase}\nslug: Pasta Com Espaços`, /slug/i],
  ])('rejeita %s', (_name, text, error) => {
    expect(() => lerFicha(text, { defaultStoreSlug: 'arquitetura' })).toThrow(error)
  })

  it('não inventa uma loja quando não há padrão', () => {
    expect(() => lerFicha('nome: Kit\nid: A\ntag: front')).toThrow(/loja/i)
  })
})

describe('plano do produto', () => {
  const ficha = lerFicha(fichaBase)

  it('organiza arquivos soltos e módulos por prefixo e depois nome', () => {
    const plano = montarPlano({ ficha, arquivos: [
      arquivo('entregaveis/Zeta.pdf'), arquivo('entregaveis/02 Zíper.zip'),
      arquivo('entregaveis/10 Extras/B.pdf'), arquivo('entregaveis/01 Básico/02 Segundo.pdf'),
      arquivo('entregaveis/01 Básico/01 Primeiro.pdf'), arquivo('entregaveis/01 Básico/Álbum.webp'),
    ] })
    expect(plano.modulos.map((m: {title: string}) => m.title)).toEqual(['Básico', 'Extras', 'Material'])
    expect(plano.modulos.map((m: {sortOrder: number}) => m.sortOrder)).toEqual([1, 10, 11])
    expect(plano.modulos[0].itens.map((i: {title: string; sortOrder: number}) => [i.title, i.sortOrder])).toEqual([['Primeiro', 1], ['Segundo', 2], ['Álbum', 3]])
    expect(plano.modulos[2].itens.map((i: {title: string; sortOrder: number}) => [i.title, i.sortOrder])).toEqual([['Zíper', 2], ['Zeta', 3]])
    expect(plano.modulos[0].itens[0]).toMatchObject({ kind: 'arquivo', url: null, arquivo: expect.objectContaining({ storagePath: 'kit-de-inspecao/entregaveis/01 Basico/01 Primeiro.pdf', contentType: 'application/pdf', downloadName: 'Primeiro.pdf' }) })
  })

  it('classifica links de YouTube e Vimeo por hostname', () => {
    const plano = montarPlano({ ficha, arquivos: [], linksTexto: 'Aula | https://www.youtube.com/watch?v=x\nOutro | https://vimeo.com/123\nSite | https://youtube.com.evil.test/video' })
    expect(plano.modulos[0].title).toBe('Conteúdo online')
    expect(plano.modulos[0].itens.map((i: {kind: string}) => i.kind)).toEqual(['video', 'video', 'link'])
    expect(plano.modulos[0].itens[0]).toMatchObject({ url: 'https://www.youtube.com/watch?v=x', arquivo: null })
  })

  it('atribui imagens e MIME sem transformar capa em entregável', () => {
    const plano = montarPlano({ ficha, arquivos: [arquivo('capa.png'), arquivo('banner.webp'), arquivo('entregaveis/Manual.docx'), arquivo('entregaveis/Outro.foo')] })
    expect(plano.imagens.capa).toMatchObject({ storagePath: 'kit-de-inspecao/capa.png', contentType: 'image/png' })
    expect(plano.imagens.banner).toMatchObject({ contentType: 'image/webp' })
    expect(plano.arquivos).toHaveLength(4)
    expect(plano.modulos[0].itens.map((i: {title: string}) => i.title)).toEqual(['Manual', 'Outro'])
    expect(plano.arquivos.find((a: {relativePath: string}) => a.relativePath.endsWith('.foo'))?.contentType).toBe('application/octet-stream')
  })

  it('normaliza delimitadores de URL no storage sem mudar título ou download', () => {
    const plano = montarPlano({ ficha, arquivos: [arquivo('entregaveis/A#B%.pdf')] })
    expect(plano.arquivos[0].storagePath).toBe('kit-de-inspecao/entregaveis/A-B-.pdf')
    expect(plano.arquivos[0].downloadName).toBe('A#B%.pdf')
    expect(plano.modulos[0].itens[0].title).toBe('A#B%')
  })

  it('rejeita colisão de storage criada pela normalização de #', () => {
    expect(() => montarPlano({ ficha, arquivos: [arquivo('entregaveis/A#B.pdf'), arquivo('entregaveis/A-B.pdf')] })).toThrow(/storage|destino|colis/i)
  })

  it.each([
    ['títulos de módulos', [arquivo('entregaveis/01 Guia/A.pdf'), arquivo('entregaveis/02 Guia/B.pdf')], /módulo|colis/i],
    ['títulos normalizados de módulos', [arquivo('entregaveis/01 Guia/A.pdf'), arquivo('entregaveis/02 Guía/B.pdf')], /módulo|colis/i],
    ['títulos de itens', [arquivo('entregaveis/01 M/01 Guia.pdf'), arquivo('entregaveis/01 M/02 Guia.zip')], /item|colis/i],
    ['títulos normalizados de itens', [arquivo('entregaveis/01 M/01 Guia.pdf'), arquivo('entregaveis/01 M/02 Guía.zip')], /item|colis/i],
    ['destinos de storage', [arquivo('entregaveis/01 Guia.pdf'), arquivo('entregaveis/01 Guía.pdf')], /storage|destino|colis/i],
    ['imagens ambíguas', [arquivo('capa.jpg'), arquivo('capa.png')], /capa/i],
    ['pastas profundas', [arquivo('entregaveis/M/Extra/A.pdf')], /subpasta|profund/i],
  ])('rejeita colisão ou estrutura inválida: %s', (_name, arquivos, error) => {
    expect(() => montarPlano({ ficha, arquivos })).toThrow(error)
  })

  it('rejeita links malformados e perigosos', () => {
    expect(() => montarPlano({ ficha, arquivos: [], linksTexto: 'Título | file:///segredo' })).toThrow(/url|link/i)
    expect(() => montarPlano({ ficha, arquivos: [], linksTexto: 'Título sem separador' })).toThrow(/link/i)
  })

  it('rejeita módulo Conteúdo online existente ao adicionar links', () => {
    expect(() => montarPlano({ ficha, arquivos: [arquivo('entregaveis/Conteúdo online/Guia.pdf')], linksTexto: 'Aula | https://example.com/aula' })).toThrow(/colisão.*módulo/i)
  })

  it('aceita o maior prefixo inteiro PostgreSQL quando não precisa derivar ordem', () => {
    const plano = montarPlano({ ficha, arquivos: [arquivo('entregaveis/2147483647 Último/Guia.pdf')] })
    expect(plano.modulos[0].sortOrder).toBe(2147483647)
  })

  it.each([
    ['prefixo acima do limite', [arquivo('entregaveis/2147483648 Extra/Guia.pdf')], ''],
    ['prefixo gigantesco', [arquivo(`entregaveis/${'9'.repeat(400)} Extra/Guia.pdf`)], ''],
    ['ordem derivada para módulo sem prefixo', [arquivo('entregaveis/2147483647 Último/Guia.pdf'), arquivo('entregaveis/Outro/Guia.pdf')], ''],
    ['ordem derivada para item sem prefixo', [arquivo('entregaveis/Material/2147483647 Último.pdf'), arquivo('entregaveis/Material/Outro.pdf')], ''],
    ['ordem derivada para conteúdo online', [arquivo('entregaveis/2147483647 Último/Guia.pdf')], 'Aula | https://example.com/aula'],
  ])('rejeita %s fora do inteiro PostgreSQL', (_name, arquivos, linksTexto) => {
    expect(() => montarPlano({ ficha, arquivos, linksTexto })).toThrow(/ordem|prefixo|inteiro/i)
  })
})
