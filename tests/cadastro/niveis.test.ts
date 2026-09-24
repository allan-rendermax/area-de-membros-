import { describe, expect, it } from 'vitest'
import { lerFicha, montarPlano } from '../../scripts/lib/cadastro-plano.mjs'
import { validarLote } from '../../scripts/lib/cadastro-executor.mjs'

const tiered = 'nome: Kit\nid_basico: BASIC01\nid_completo: FULL01\nid_upgrade: UPG01\ntag: front\nloja: arquitetura\ncheckout_upgrade: https://example.com/upgrade'
const file = (relativePath: string) => ({ relativePath, absolutePath: `C:/produto/${relativePath}`, size: 3 })

describe('cadastro por níveis', () => {
  it('lê três ofertas distintas e checkout de upgrade', () => {
    const ficha = lerFicha(tiered)
    expect(ficha).toMatchObject({ checkoutUpgrade: 'https://example.com/upgrade' })
    expect(ficha).not.toHaveProperty('id')
    expect('ofertas' in ficha ? ficha.ofertas : undefined).toEqual([
      { codigo: 'BASIC01', nivel: 'basic', nome: 'Kit — Básico' },
      { codigo: 'FULL01', nivel: 'complete', nome: 'Kit — Completo' },
      { codigo: 'UPG01', nivel: 'complete', nome: 'Kit — Upgrade' },
    ])
  })
  it.each([
    [tiered + '\nid: OLD', /id|legado/i],
    ['nome: Kit\nid_basico: A\ntag: front\nloja: arquitetura\ncheckout_upgrade: https://example.com', /completo|upgrade/i],
    [tiered.replace('FULL01', 'BASIC01'), /repetid|distint/i],
    [tiered.replace('checkout_upgrade: https://example.com/upgrade', ''), /checkout_upgrade/i],
    [tiered.replace('https://example.com/upgrade', 'javascript:alert(1)'), /checkout_upgrade|URL/i],
  ])('rejeita ficha tiered inválida', (text, error) => expect(() => lerFicha(text)).toThrow(error))
  it('classifica módulos, arquivos e links por nível sem misturar títulos', () => {
    const plano = montarPlano({ ficha: lerFicha(tiered), arquivos: [
      file('capa.png'), file('entregaveis/basico/01 Principal/Guia.pdf'),
      file('entregaveis/basico/Solto.pdf'), file('entregaveis/completo/02 Extras/Modelo.zip'),
      file('entregaveis/completo/Outro.pdf'), file('entregaveis/Legado/Resumo.pdf'),
    ], linksTexto: 'Início | https://example.com/a\nExtra | https://example.com/b | completo' })
    const parsed = lerFicha(tiered)
    expect(plano.ofertas).toEqual('ofertas' in parsed ? parsed.ofertas : undefined)
    expect(plano.modulos.map((m: {title: string; requiredLevel: string}) => [m.title, m.requiredLevel])).toEqual([
      ['Principal', 'basic'], ['Extras', 'complete'], ['Extras do Completo', 'complete'],
      ['Legado', 'basic'], ['Material básico', 'basic'],
      ['Conteúdo online', 'basic'], ['Conteúdo online — Completo', 'complete'],
    ])
    expect(plano.arquivos.find((f: {relativePath: string}) => f.relativePath === 'capa.png')?.bucket).toBe('arquivos')
    expect(plano.arquivos.filter((f: {relativePath: string}) => f.relativePath.startsWith('entregaveis/')).every((f: {bucket: string}) => f.bucket === 'arquivos-restritos')).toBe(true)
  })
  it('recusa título de módulo repetido entre níveis e códigos repetidos em todo o lote', () => {
    const ficha = lerFicha(tiered)
    expect(() => montarPlano({ ficha, arquivos: [file('entregaveis/basico/01 Guia/a.pdf'), file('entregaveis/completo/02 Guia/b.pdf')] })).toThrow(/módulo|colis/i)
    expect(() => montarPlano({ ficha, arquivos: [file('entregaveis/basico/Guia/a.pdf'), file('entregaveis/completo/Guia/b.pdf')] })).toThrow(/módulo|colis/i)
    const plano = montarPlano({ ficha, arquivos: [] })
    const other = montarPlano({ ficha: lerFicha(tiered.replace('nome: Kit', 'nome: Outro').replace('BASIC01', 'BASIC02').replace('FULL01', 'FULL02')), arquivos: [] })
    expect(() => validarLote([plano, other])).toThrow(/Payt.*repetid|repetid.*Payt/i)
  })
})
