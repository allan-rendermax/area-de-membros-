import { readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'
import { lerPastaProduto } from './lib/cadastro-pasta.mjs'
import { executarPlanos, validarLote } from './lib/cadastro-executor.mjs'

function usage() { return 'Uso: node scripts/cadastrar-produto.mjs "<pasta>" [--todos] [--simular]' }

function options(args) {
  const flags = new Set()
  let folder = null
  for (const arg of args) {
    if (arg === '--todos' || arg === '--simular') {
      if (flags.has(arg)) throw new Error(`Flag repetida: ${arg}. ${usage()}`)
      flags.add(arg)
    } else if (arg.startsWith('-')) throw new Error(`Flag desconhecida: ${arg}. ${usage()}`)
    else if (folder) throw new Error(`Informe uma única pasta. ${usage()}`)
    else folder = arg
  }
  if (!folder) throw new Error(usage())
  return { folder: resolve(folder), todos: flags.has('--todos'), simular: flags.has('--simular') }
}

async function env() {
  let local = {}
  try { local = parseEnv(await readFile(resolve('.env.local'), 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Falha ao ler .env.local.') }
  return { ...local, ...process.env }
}

function printPlan(plano) {
  const { ficha } = plano
  console.log(`${ficha.nome} — ${ficha.loja}/${ficha.slug} (${ficha.tag})`)
  console.log(`  Payt: ${ficha.id}; link: /${ficha.loja}/${ficha.slug}`)
  for (const modulo of plano.modulos) {
    console.log(`  Módulo ${modulo.sortOrder}: ${modulo.title}`)
    for (const item of modulo.itens) console.log(`    ${item.sortOrder}. ${item.title} — ${item.arquivo ? `${item.arquivo.size} B` : item.url}`)
  }
  console.log(`  Arquivos: ${plano.arquivos.length}; total: ${plano.arquivos.reduce((sum, file) => sum + file.size, 0)} B`)
}

export async function main(args = process.argv.slice(2)) {
  const opts = options(args)
  const config = await env()
  let folders = [opts.folder]
  if (opts.todos) {
    const entries = await readdir(opts.folder, { withFileTypes: true })
    folders = []
    for (const entry of entries) {
      if (!entry.isDirectory()) { console.log(`Ignorada: ${entry.name}`); continue }
      const folder = join(opts.folder, entry.name)
      const contents = await readdir(folder)
      if (contents.includes('produto.txt')) folders.push(folder)
      else console.log(`Ignorada: ${entry.name} (sem produto.txt)`)
    }
    if (!folders.length) throw new Error('Nenhuma pasta com produto.txt encontrada.')
  }
  const planos = []
  for (const folder of folders) planos.push(await lerPastaProduto(folder, { defaultStoreSlug: config.DEFAULT_STORE_SLUG }))
  validarLote(planos)
  for (const plano of planos) printPlan(plano)
  if (opts.simular) { console.log(`Simulação concluída: ${planos.length} produto(s).`); return }
  const url = config.SUPABASE_URL || config.NEXT_PUBLIC_SUPABASE_URL
  const key = config.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Configure SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SECRET_KEY em .env.local.')
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const result = await executarPlanos(db, planos)
  console.log(`Cadastro concluído: ${result.length} produto(s).`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Falha desconhecida no cadastro.'); process.exitCode = 1 })
}
