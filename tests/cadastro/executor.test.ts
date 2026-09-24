/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { lerFicha, montarPlano } from '../../scripts/lib/cadastro-plano.mjs'
import { executarPlanos } from '../../scripts/lib/cadastro-executor.mjs'
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
    ficha: { nome: 'Kit', id: 'PAYT1', tag: 'front', loja: 'loja', slug: 'kit', trilha: 'Técnica', checkout: null, destaque: true, ordem: 2, descricao: 'Descrição', ...overrides },
    arquivos: [file], imagens: { capa: null, banner: null },
    ofertas: undefined as undefined | { codigo: string; nivel: string; nome: string }[],
    modulos: [{ title: 'Material', sortOrder: 1, requiredLevel: 'basic', itens: [{ title: 'Guia', kind: 'arquivo', sortOrder: 1, url: null, arquivo: file }] }],
  }
}

describe('executor do cadastro', () => {
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
