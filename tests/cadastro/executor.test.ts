/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { lerFicha, montarPlano } from '../../scripts/lib/cadastro-plano.mjs'
import { executarPlanos, simularPlanos } from '../../scripts/lib/cadastro-executor.mjs'
import { privateFilePath } from '../../src/lib/content/private-files'

type Row = Record<string, any>
class FakeDb {
  supabaseUrl = 'https://supabase.example'
  rows: Record<string, Row[]> = { stores: [{ id: 'store-1', slug: 'loja' }, { id: 'store-2', slug: 'outra' }], products: [], offers: [], offer_products: [], modules: [], items: [] }
  uploads: { bucket: string; path: string; options: Row; bytes: number }[] = []
  writes = 0
  failTable = ''
  failColumn = ''
  from(table: string) {
    const filters: [string, unknown][] = []
    let operation: 'select' | 'insert' | 'update' = 'select'
    let values: Row = {}
    let page: [number, number] = [0, 999]
    let columns = '*'
    const query: any = {
      select(value = '*') { columns = value; return query },
      eq(field: string, value: unknown) { filters.push([field, value]); return query },
      order() { return query },
      range(start: number, end: number) { page = [start, end]; return query },
      insert(value: Row) { operation = 'insert'; values = value; return query },
      update(value: Row) { operation = 'update'; values = value; return query },
      single() { return run(true) },
      maybeSingle() { return run(true) },
      then(resolve: (value: any) => void, reject?: (reason: any) => void) { return Promise.resolve(run(false)).then(resolve, reject) },
    }
    const run = (one: boolean) => {
      if ((this.failTable === table || (this.failColumn && columns.split(',').includes(this.failColumn))) && operation === 'select') return { data: null, error: { message: 'sensitive-secret' } }
      const matches = this.rows[table].filter(row => filters.every(([field, value]) => row[field] === value))
      if (operation === 'select') return { data: one ? matches[0] ?? null : matches.slice(page[0], Math.min(page[1] + 1, page[0] + 500)).map(row => ({ ...row })), error: null }
      this.writes++
      if (operation === 'insert') {
        const row = { ...values, id: values.id ?? `${table}-${this.rows[table].length + 1}` }
        this.rows[table].push(row)
        return { data: one ? { ...row } : null, error: null }
      }
      for (const row of matches) Object.assign(row, values)
      return { data: one ? { ...matches[0] } : null, error: null }
    }
    return query
  }
  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, bytes: Uint8Array, options: Row) => { this.writes++; this.uploads.push({ bucket, path, bytes: bytes.length, options }); return { error: null } },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://files.example/${encodeURI(path)}` } }),
    }),
  }
}

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function plan(overrides: Row = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cadastro-exec-'))
  dirs.push(dir)
  const absolutePath = join(dir, 'Guia.pdf')
  await writeFile(absolutePath, 'pdf')
  const file = { absolutePath, relativePath: 'entregaveis/Guia.pdf', size: 3, storagePath: `${overrides.slug ?? 'kit'}/entregaveis/Guia.pdf`, contentType: 'application/pdf', downloadName: 'Guia.pdf', bucket: 'arquivos' }
  return {
    ficha: { nome: 'Kit', id: 'PAYT1', tag: 'front', organizacao: 'sections', loja: 'loja', slug: 'kit', trilha: 'Técnica', checkout: null, destaque: true, ordem: 2, descricao: 'Descrição', ...overrides },
    arquivos: [file], imagens: { capa: null, banner: null },
    ofertas: undefined as undefined | { codigo: string; nivel: string; nome: string }[],
    modulos: [{ title: 'Material', sortOrder: 1, requiredLevel: 'basic', itens: [{ title: 'Guia', kind: 'arquivo', sortOrder: 1, url: null, arquivo: file }] }],
  }
}

describe('executor do cadastro', () => {
  it('preflight de leitura informa modo preservado e bloqueio sem mutações', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'versions', is_published: true })
    const result = await simularPlanos(db, [await plan({ organizacao: undefined })])
    expect(result[0]).toMatchObject({ mode: 'versions', preservedMode: true, emptyLevels: ['complete'], itemCounts: { basic: 1, complete: 0 } })
    expect(result[0].error).toMatch(/Completo/i)
    expect(db.writes).toBe(0)
    expect(db.uploads).toHaveLength(0)
  })
  it.each(['auto', undefined])('novo front usa versions com organização %s e bloqueia Completo vazio antes de upload', async organizacao => {
    const db = new FakeDb()
    await expect(executarPlanos(db, [await plan({ organizacao })], { log: () => {} })).rejects.toThrow(/Completo.*material|material.*Completo/i)
    expect(db.writes).toBe(0)
  })
  it('grava versions explicitamente quando novo front possui o nível vendido', async () => {
    const db = new FakeDb()
    const p = await plan({ organizacao: undefined })
    p.modulos[0].requiredLevel = 'complete'
    p.arquivos[0].bucket = 'arquivos-restritos'
    await executarPlanos(db, [p], { log: () => {} })
    expect(db.rows.products[0].content_mode).toBe('versions')
  })
  it.each(['orderbump', 'upsell'])('novo %s automático usa sections e entrega Básico ao Completo', async tag => {
    const db = new FakeDb()
    await executarPlanos(db, [await plan({ tag, organizacao: undefined, checkout: 'https://example.com/checkout' })], { log: () => {} })
    expect(db.rows.products[0].content_mode).toBe('sections')
  })
  it('preserva sections salvo na reimportação sem campo e informa escolha', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'sections', is_published: true })
    const logs: string[] = []
    await executarPlanos(db, [await plan({ organizacao: undefined })], { log: value => logs.push(value) })
    expect(db.rows.products[0].content_mode).toBe('sections')
    expect(logs.join(' ')).toMatch(/sections.*preservad|preservad.*sections/i)
  })
  it('bloqueia mudar sections para versions quando oferta existente perderia seus materiais', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'sections', is_published: true })
    db.rows.offers.push({ id: 'offer-1', store_id: 'store-1', payt_product_code: 'PAYT1' })
    db.rows.offer_products.push({ offer_id: 'offer-1', product_id: 'product-1', grant_level: 'complete' })
    await expect(executarPlanos(db, [await plan({ organizacao: 'versions' })], { log: () => {} })).rejects.toThrow(/Completo/i)
    expect(db.writes).toBe(0)
  })
  it('avisa legado publicado vazio sem alterar concessão existente ou modo', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'versions', is_published: true })
    db.rows.offers.push({ id: 'offer-1', store_id: 'store-1', payt_product_code: 'PAYT1' })
    db.rows.offer_products.push({ offer_id: 'offer-1', product_id: 'product-1', grant_level: 'complete' })
    const logs: string[] = []
    await executarPlanos(db, [await plan({ organizacao: undefined })], { log: value => logs.push(value) })
    expect(logs.join(' ')).toMatch(/aviso.*Completo.*material/i)
    expect(db.rows.products[0].content_mode).toBe('versions')
    expect(db.rows.offer_products[0].grant_level).toBe('complete')
  })
  it('considera materiais extras preservados e publicados no preflight', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'versions', is_published: true })
    db.rows.modules.push({ id: 'extra', product_id: 'product-1', title: 'Completo', required_level: 'complete', is_published: true })
    db.rows.items.push({ id: 'video', module_id: 'extra', title: 'Aula', kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', is_published: true })
    await executarPlanos(db, [await plan({ organizacao: undefined })], { log: () => {} })
    expect(db.rows.offer_products[0].grant_level).toBe('complete')
  })
  it('recusa nova venda quando só há vídeo inválido ou material rascunho no nível', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'versions', is_published: true })
    db.rows.modules.push({ id: 'extra', product_id: 'product-1', title: 'Completo', required_level: 'complete', is_published: true })
    db.rows.items.push({ id: 'video', module_id: 'extra', title: 'Aula', kind: 'video', url: 'https://youtube.com/watch?v=x', is_published: true },
      { id: 'draft', module_id: 'extra', title: 'Rascunho', kind: 'link', url: 'https://example.com/guide', is_published: false })
    await expect(executarPlanos(db, [await plan({ organizacao: undefined })], { log: () => {} })).rejects.toThrow(/Completo/i)
    expect(db.writes).toBe(0)
  })
  it('recusa republicar versão vazia mesmo com oferta legada', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'versions', is_published: false })
    db.rows.offers.push({ id: 'offer-1', store_id: 'store-1', payt_product_code: 'PAYT1' })
    db.rows.offer_products.push({ offer_id: 'offer-1', product_id: 'product-1', grant_level: 'complete' })
    await expect(executarPlanos(db, [await plan({ organizacao: undefined })], { log: () => {} })).rejects.toThrow(/Completo/i)
    expect(db.writes).toBe(0)
  })
  it('não exige o nível antigo ao alterar a única oferta para Básico', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'versions', is_published: true })
    db.rows.offers.push({ id: 'offer-1', store_id: 'store-1', payt_product_code: 'PAYT1' })
    db.rows.offer_products.push({ offer_id: 'offer-1', product_id: 'product-1', grant_level: 'complete' })
    const p = await plan({ organizacao: undefined })
    p.ofertas = [{ codigo: 'PAYT1', nivel: 'basic', nome: 'Básico' }]
    const logs: string[] = []
    await executarPlanos(db, [p], { log: value => logs.push(value) })
    expect(db.rows.offer_products[0].grant_level).toBe('basic')
    expect(logs.some(value => /aviso.*Completo/i.test(value))).toBe(false)
  })
  it('considera também ofertas já salvas que não estão no arquivo importado', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit', content_mode: 'sections', is_published: true })
    db.rows.offers.push({ id: 'extra-offer', store_id: 'store-1', payt_product_code: 'EXTRA' })
    db.rows.offer_products.push({ offer_id: 'extra-offer', product_id: 'product-1', grant_level: 'complete' })
    const p = await plan({ organizacao: 'versions' })
    p.ofertas = [{ codigo: 'PAYT1', nivel: 'basic', nome: 'Básico' }]
    await expect(executarPlanos(db, [p], { log: () => {} })).rejects.toThrow(/Completo/i)
    expect(db.writes).toBe(0)
  })
  it('recusa promoção a Completo quando item público extra seria preservado', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit' })
    db.rows.modules.push({ id: 'module-1', product_id: 'product-1', title: 'Material', required_level: 'basic' })
    db.rows.items.push({ id: 'old-1', module_id: 'module-1', title: 'Antigo', kind: 'arquivo', url: 'https://supabase.example/storage/v1/object/public/arquivos/kit/Antigo.pdf?download=1#arquivo' })
    const p = await plan()
    p.modulos[0].requiredLevel = 'complete'
    p.arquivos[0].bucket = 'arquivos-restritos'
    await expect(executarPlanos(db, [p])).rejects.toThrow(/Antigo|público|privado/i)
    expect(db.writes).toBe(0)
    expect(db.uploads).toHaveLength(0)
  })
  it('recusa link público próprio recebido em módulo Completo', async () => {
    const db = new FakeDb()
    const p = await plan()
    p.modulos[0].requiredLevel = 'complete'
    p.arquivos[0].bucket = 'arquivos-restritos'
    ;(p.modulos[0].itens as Row[]).push({ title: 'Público', kind: 'link', sortOrder: 2, url: 'https://supabase.example/storage/v1/object/public/arquivos/kit/Publico.pdf?download=1#x', arquivo: null })
    await expect(executarPlanos(db, [p])).rejects.toThrow(/Público|privado/i)
    expect(db.writes).toBe(0)
    expect(db.uploads).toHaveLength(0)
  })
  it('trata upload sem bucket como público em módulo Completo', async () => {
    const db = new FakeDb()
    const p = await plan()
    p.modulos[0].requiredLevel = 'complete'
    delete (p.arquivos[0] as Row).bucket
    await expect(executarPlanos(db, [p])).rejects.toThrow(/público|privado/i)
    expect(db.writes).toBe(0)
  })
  it('permite substituir arquivo público existente por upload privado no mesmo item', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'product-1', store_id: 'store-1', slug: 'kit' })
    db.rows.modules.push({ id: 'module-1', product_id: 'product-1', title: 'Material', required_level: 'basic' })
    db.rows.items.push({ id: 'old-1', module_id: 'module-1', title: 'Guia', kind: 'arquivo', url: 'https://supabase.example/storage/v1/object/public/arquivos/kit/Guia.pdf?download=Guia.pdf' })
    const p = await plan()
    p.modulos[0].requiredLevel = 'complete'
    p.arquivos[0].bucket = 'arquivos-restritos'
    await executarPlanos(db, [p], { log: () => {} })
    expect(db.rows.modules[0].required_level).toBe('complete')
    expect(db.rows.items[0].url).toContain('/object/authenticated/arquivos-restritos/')
    expect(db.uploads).toHaveLength(1)
    expect(db.uploads[0].bucket).toBe('arquivos-restritos')
  })
  it('grava três vínculos de um produto por nível e reexecuta sem duplicar', async () => {
    const db = new FakeDb()
    const p = await plan({ id: undefined, checkoutUpgrade: 'https://example.com/upgrade', modoNiveis: true })
    p.ofertas = [
      { codigo: 'BASIC', nivel: 'basic', nome: 'Kit — Básico' },
      { codigo: 'FULL', nivel: 'complete', nome: 'Kit — Completo' },
      { codigo: 'UPGRADE', nivel: 'complete', nome: 'Kit — Upgrade' },
    ]
    p.modulos[0].requiredLevel = 'complete'
    p.arquivos[0].bucket = 'arquivos-restritos'
    p.arquivos[0].storagePath = 'kit/entregaveis/completo/01 Extras/Meu Guia.pdf'
    p.arquivos[0].downloadName = 'Meu Guia.pdf'
    p.modulos.push({ title: 'Básico', sortOrder: 2, requiredLevel: 'basic', itens: [{ title: 'Guia básico', kind: 'link', sortOrder: 1, url: 'https://example.com/basic', arquivo: null }] } as any)
    await executarPlanos(db, [p], { log: () => {} })
    await executarPlanos(db, [p], { log: () => {} })
    expect(db.rows.products).toHaveLength(1)
    expect(db.rows.products[0].upgrade_checkout_url).toBe('https://example.com/upgrade')
    expect(db.rows.modules[0].required_level).toBe('complete')
    expect(db.rows.offers).toHaveLength(3)
    expect(db.rows.offer_products.map(row => row.grant_level)).toEqual(['basic', 'complete', 'complete'])
    expect(db.rows.items[0].url).toBe('https://supabase.example/storage/v1/object/authenticated/arquivos-restritos/kit/entregaveis/completo/01%20Extras/Meu%20Guia.pdf')
    expect(new URL(db.rows.items[0].url).search).toBe('')
    expect(privateFilePath(db.rows.items[0].url, db.supabaseUrl)).toBe('kit/entregaveis/completo/01 Extras/Meu Guia.pdf')
    expect(db.uploads.every(upload => upload.bucket === 'arquivos-restritos')).toBe(true)
  })
  it('bloqueia o lote inteiro quando o terceiro código conflita', async () => {
    const db = new FakeDb()
    db.rows.offers.push({ id: 'old', store_id: 'store-2', payt_product_code: 'UPGRADE' })
    const p = await plan({ id: undefined, checkoutUpgrade: 'https://example.com/upgrade', modoNiveis: true })
    p.ofertas = [{ codigo: 'BASIC', nivel: 'basic', nome: 'Básico' }, { codigo: 'UPGRADE', nivel: 'complete', nome: 'Upgrade' }]
    p.arquivos[0].bucket = 'arquivos-restritos'
    await expect(executarPlanos(db, [p])).rejects.toThrow(/UPGRADE|Payt|loja/i)
    expect(db.writes).toBe(0)
  })
  it('detecta schema de níveis ausente antes de enviar qualquer arquivo', async () => {
    const db = new FakeDb()
    db.failColumn = 'grant_level'
    await expect(executarPlanos(db, [await plan()])).rejects.toThrow(/esquema|consulta/i)
    expect(db.writes).toBe(0)
  })
  it('usa o SDK instalado para upload e link público sem fragmento nem rede', async () => {
    const requested: string[] = []
    const fetchStub: typeof fetch = async input => {
      requested.push(input instanceof Request ? input.url : String(input))
      return new Response(JSON.stringify({ Key: 'arquivos/kit/entregaveis/A-B.pdf' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const db = createClient('https://supabase.example', 'public-test-key', { global: { fetch: fetchStub }, auth: { persistSession: false } })
    const ficha = lerFicha('nome: Kit\nid: TEST\ntag: front\nloja: loja')
    const file = montarPlano({ ficha, arquivos: [{ relativePath: 'entregaveis/A#B.pdf', absolutePath: 'C:/example/A#B.pdf', size: 1 }] }).arquivos[0]
    const uploaded = await db.storage.from('arquivos').upload(file.storagePath, Buffer.from('x'), { upsert: true, contentType: file.contentType })
    expect(uploaded.error).toBeNull()
    expect(requested).toHaveLength(1)
    expect(new URL(requested[0]).hash).toBe('')
    expect(new URL(requested[0]).pathname).toMatch(/\/A-B\.pdf$/)
    const publicUrl = db.storage.from('arquivos').getPublicUrl(file.storagePath).data.publicUrl
    expect(new URL(publicUrl).hash).toBe('')
    expect(new URL(publicUrl).pathname).toMatch(/\/A-B\.pdf$/)
  })
  it('preserva caminho completo no URL público do SDK para módulo pontuado', async () => {
    const requested: string[] = []
    const fetchStub: typeof fetch = async input => {
      requested.push(input instanceof Request ? input.url : String(input))
      return new Response(JSON.stringify({ Key: 'arquivos/kit/entregaveis/01 Bonus.v2-final-/Guia.pd-f-' }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const db = createClient('https://supabase.example', 'public-test-key', { global: { fetch: fetchStub }, auth: { persistSession: false } })
    const ficha = lerFicha('nome: Kit\nid: TEST\ntag: front\nloja: loja')
    const file = montarPlano({ ficha, arquivos: [{ relativePath: 'entregaveis/01 Bonus.v2#final%/Guia.pd#f%', absolutePath: 'C:/example/Guia.pd#f%', size: 1 }] }).arquivos[0]
    const uploaded = await db.storage.from('arquivos').upload(file.storagePath, Buffer.from('x'), { upsert: true, contentType: file.contentType })
    expect(uploaded.error).toBeNull()
    expect(requested).toHaveLength(1)
    expect(new URL(requested[0]).hash).toBe('')
    expect(new URL(requested[0]).pathname).toContain('/01%20Bonus.v2-final-/Guia.pd-f-')
    const publicUrl = db.storage.from('arquivos').getPublicUrl(file.storagePath).data.publicUrl
    expect(new URL(publicUrl).hash).toBe('')
    expect(new URL(publicUrl).pathname).toContain('/01%20Bonus.v2-final-/Guia.pd-f-')
  })
  it('reexecuta sem duplicar e atualiza publicação, ordem e URL enquanto preserva extras', async () => {
    const db = new FakeDb()
    const p = await plan()
    const logs: string[] = []
    await executarPlanos(db, [p], { log: value => logs.push(value) })
    db.rows.modules.push({ id: 'extra-module', product_id: 'products-1', title: 'Extra' })
    db.rows.items.push({ id: 'extra-item', module_id: 'modules-1', title: 'Antigo' })
    db.rows.items.push({ id: 'extra-child', module_id: 'extra-module', title: 'Conteúdo oculto' })
    p.modulos[0].sortOrder = 8
    p.modulos[0].itens[0].sortOrder = 7
    await executarPlanos(db, [p], { log: value => logs.push(value) })
    expect(db.rows.products).toHaveLength(1)
    expect(db.rows.products[0]).toMatchObject({ role: 'front', is_published: true, sort_order: 2 })
    expect(db.rows.modules).toHaveLength(2)
    expect(db.rows.modules[0]).toMatchObject({ sort_order: 8, is_published: true })
    expect(db.rows.items).toHaveLength(3)
    expect(db.rows.items[0]).toMatchObject({ sort_order: 7, is_published: true, url: 'https://files.example/kit/entregaveis/Guia.pdf?download=Guia.pdf' })
    expect(db.rows.offers).toHaveLength(1)
    expect(db.rows.offer_products).toHaveLength(1)
    expect(db.uploads).toHaveLength(2)
    expect(db.uploads[0]).toMatchObject({ path: 'kit/entregaveis/Guia.pdf', bytes: 3, options: { upsert: true, contentType: 'application/pdf' } })
    expect(logs.join(' ')).toMatch(/Extra|Antigo/)
    expect(logs.join(' ')).toContain('Conteúdo oculto')
    expect(logs.join(' ')).toContain('/loja/produto/kit')
  })

  it('rejeita conflito de código Payt com produto existente antes de qualquer escrita', async () => {
    const db = new FakeDb()
    db.rows.offers.push({ id: 'offer-1', store_id: 'store-1', payt_product_code: 'PAYT1', name: 'Antiga' })
    db.rows.offer_products.push({ offer_id: 'offer-1', product_id: 'other-product' })
    await expect(executarPlanos(db, [await plan()])).rejects.toThrow(/Payt|oferta|vínculo/i)
    expect(db.writes).toBe(0)
  })

  it('rejeita slug de outra loja antes de upload', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'other-product', store_id: 'store-2', slug: 'kit' })
    await expect(executarPlanos(db, [await plan()])).rejects.toThrow(/slug|loja|storage/i)
    expect(db.writes).toBe(0)
  })

  it('rejeita títulos duplicados no banco antes de upload', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'products-1', store_id: 'store-1', slug: 'kit', role: 'front' })
    db.rows.modules.push({ id: 'a', product_id: 'products-1', title: 'Material' }, { id: 'b', product_id: 'products-1', title: 'Material' })
    await expect(executarPlanos(db, [await plan()])).rejects.toThrow(/duplicad|módulo/i)
    expect(db.writes).toBe(0)
  })

  it('detecta título duplicado além da primeira página da consulta', async () => {
    const db = new FakeDb()
    db.rows.products.push({ id: 'products-1', store_id: 'store-1', slug: 'kit', role: 'front' })
    for (let index = 0; index < 1000; index++) db.rows.modules.push({ id: `module-${index}`, product_id: 'products-1', title: `Outro ${index}` })
    db.rows.modules.push({ id: 'duplicate-a', product_id: 'products-1', title: 'Material' }, { id: 'duplicate-b', product_id: 'products-1', title: 'Material' })
    await expect(executarPlanos(db, [await plan()], { log: () => {} })).rejects.toThrow(/duplicado/i)
    expect(db.writes).toBe(0)
  })

  it('erro de consulta não vira insert e não expõe mensagem bruta', async () => {
    const db = new FakeDb()
    db.failTable = 'offers'
    let message = ''
    try { await executarPlanos(db, [await plan()]) }
    catch (error) { if (error instanceof Error) message = error.message }
    expect(message).toMatch(/consulta|offers|oferta/i)
    expect(message).not.toContain('sensitive-secret')
    expect(db.writes).toBe(0)
  })

  it('valida todos os planos e todos os bytes antes de qualquer escrita', async () => {
    const db = new FakeDb()
    const first = await plan()
    const second = await plan({ id: 'PAYT2', slug: 'outro', nome: 'Outro' })
    await rm(second.arquivos[0].absolutePath)
    await expect(executarPlanos(db, [first, second])).rejects.toThrow(/arquivo|leitura/i)
    expect(db.writes).toBe(0)
  })

  it('conflito no segundo produto bloqueia também o primeiro', async () => {
    const db = new FakeDb()
    db.rows.offers.push({ id: 'offer-2', store_id: 'store-2', payt_product_code: 'PAYT2' })
    const first = await plan()
    const second = await plan({ id: 'PAYT2', slug: 'outro', nome: 'Outro' })
    await expect(executarPlanos(db, [first, second])).rejects.toThrow(/Payt|loja/i)
    expect(db.writes).toBe(0)
    expect(db.uploads).toHaveLength(0)
  })
})
