import { describe, expect, it } from 'vitest'
import { resourceDownloadName } from '@/lib/content/download-name'

const source = (title: string, file = 'material-4-eae7793ddf4619bb.pdf') => ({ title, url: `https://project.supabase.co/storage/v1/object/authenticated/arquivos-restritos/${file}` })

describe('nome do arquivo entregue ao aluno', () => {
  it('usa produto e título do material em vez do identificador do Storage', () => {
    expect(resourceDownloadName(source('Checklist de Vistoria de Entrega'), 'Orçamento de Jardins na Prática')).toBe('Orçamento de Jardins na Prática - Checklist de Vistoria de Entrega.pdf')
    expect(resourceDownloadName(source('8 Erros Fatais de Implantação'), 'Orçamento de Jardins na Prática')).toBe('Orçamento de Jardins na Prática - 8 Erros Fatais de Implantação.pdf')
  })

  it('usa o nome do produto para rótulos genéricos sem duplicar o nome', () => {
    expect(resourceDownloadName(source('Clique Aqui para acessar seu Atlas - Completo'), 'Atlas Visual das Patologias na Construção Civil')).toBe('Atlas Visual das Patologias na Construção Civil.pdf')
    expect(resourceDownloadName(source('Atlas Visual de Urbanismo', '01.pdf'), 'Atlas Visual de Urbanismo')).toBe('Atlas Visual de Urbanismo.pdf')
    expect(resourceDownloadName(source('Material principal'), 'Meu produto')).toBe('Meu produto.pdf')
  })

  it.each([
    ['Baixar arquivo editável — Planilha de Orçamento (Excel)', 'material-1.xlsx', 'Orçamento de Jardins - Planilha de Orçamento.xlsx'],
    ['Baixar arquivo editável — Contrato (Word)', 'material-5.docx', 'Orçamento de Jardins - Contrato.docx'],
    ['Calculadora — baixe o ZIP, extraia e abra index.html', 'calculadora-92426039507f19af.zip', 'Calculadora de Áreas Hospitalares.zip'],
  ])('retira instruções de botão e preserva o formato real: %s', (title, file, expected) => {
    expect(resourceDownloadName(source(title, file), title.startsWith('Calculadora') ? 'Calculadora de Áreas Hospitalares' : 'Orçamento de Jardins')).toBe(expected)
  })

  it('não duplica a extensão e mantém Unicode normalizado', () => {
    expect(resourceDownloadName(source('Revisa\u0303o.PDF'))).toBe('Revisão.pdf')
    expect(resourceDownloadName(source('日本語の資料'))).toBe('日本語の資料.pdf')
    expect(resourceDownloadName(source('Guia.pdf'), 'Guia.pdf')).toBe('Guia.pdf')
    expect(resourceDownloadName(source('Material principal'), 'Guia.pdf')).toBe('Guia.pdf')
  })

  it('retira separadores de caminho, caracteres de controle e nomes reservados', () => {
    const name = resourceDownloadName(source('../Relatório: "obra"\r\n / campo\u202e'))
    expect(name).not.toMatch(/[\\/:*?"<>|\r\n\u202e]/)
    expect(name).not.toMatch(/^\./)
    expect(resourceDownloadName(source('CON'))).toBe('Material - CON.pdf')
    expect(resourceDownloadName(source('CON.txt'))).toBe('Material - CON.txt.pdf')
    expect(resourceDownloadName(source('COM¹'))).toBe('Material - COM¹.pdf')
    expect(resourceDownloadName(source('   '), 'Meu produto')).toBe('Meu produto.pdf')
  })

  it('limita o nome em bytes sem cortar a extensão nem caracteres Unicode', () => {
    const name = resourceDownloadName(source('Árvore '.repeat(100), 'planilha.XLSX'))
    expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(180)
    expect(name.endsWith('.xlsx')).toBe(true)
    expect(name).not.toContain('\ufffd')
  })
})
