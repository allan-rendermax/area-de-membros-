import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const script = resolve('scripts/cadastrar-produto.mjs')
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
async function root() { const dir = await mkdtemp(join(tmpdir(), 'cadastro-cli-')); dirs.push(dir); return dir }
async function product(dir: string, name: string, body = 'nome: Kit\nid: P1\ntag: front\nloja: loja\n') {
  const folder = join(dir, name)
  await mkdir(folder)
  await writeFile(join(folder, 'produto.txt'), body)
  await mkdir(join(folder, 'entregaveis'))
  await writeFile(join(folder, 'entregaveis', 'Guia.txt'), 'abc')
  return folder
}
function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { cwd: resolve('.'), encoding: 'utf8', env: { ...process.env, SUPABASE_URL: '', SUPABASE_SECRET_KEY: '', NEXT_PUBLIC_SUPABASE_URL: '' } })
}
describe('CLI de cadastro', () => {
  it('simula a pasta exemplo com três ofertas e módulos por nível sem credenciais', () => {
    const result = run('docs/exemplo-pasta-produto-niveis', '--simular')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('KITBASIC01 (basic')
    expect(result.stdout).toContain('KITFULL01 (complete')
    expect(result.stdout).toContain('KITUP01 (complete')
    expect(result.stdout).toContain('Extras (complete)')
    expect(result.stdout).toContain('Checkout upgrade: https://example.com/upgrade')
  })
  it('simula sem credenciais e mostra resumo, tamanho, Payt e link', async () => {
    const dir = await root()
    const folder = await product(dir, 'kit')
    const result = run(folder, '--simular')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('/loja/produto/kit')
    expect(result.stdout).toMatch(/Kit[\s\S]*Material[\s\S]*Guia[\s\S]*3 B/)
    expect(result.stdout).toMatch(/1 produto\(s\).*1 módulo\(s\).*1 item\(ns\)/)
    expect(result.stdout).toMatch(/novo.*versions/i)
    expect(result.stdout).toMatch(/reimporta.*preserva.*modo salvo/i)
    expect(result.stdout).toMatch(/Completo.*sem material/i)
  })
  it('expõe na simulação offline organização explícita e prontidão de seções', async () => {
    const dir = await root()
    const folder = await product(dir, 'kit', 'nome: Kit\nid: P1\ntag: front\nloja: loja\norganizacao: sections\n')
    const result = run(folder, '--simular')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/Organização: sections/)
    expect(result.stdout).toMatch(/Básico 1, Completo 1/)
    expect(result.stdout).not.toMatch(/Completo.*sem material/)
  })
  it('lote com segunda pasta inválida falha sem pedir credenciais', async () => {
    const dir = await root()
    await product(dir, 'primeiro')
    await product(dir, 'segundo', 'nome: Inválido\nid: P2\ntag: desconhecida\nloja: loja\n')
    const result = run(dir, '--todos', '--simular')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/tag|inválid/i)
  })
  it('simulação rejeita código Payt repetido no lote', async () => {
    const dir = await root()
    await product(dir, 'primeiro')
    await product(dir, 'segundo', 'nome: Outro Kit\nid: P1\ntag: front\nloja: loja\n')
    const result = run(dir, '--todos', '--simular')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/Payt.*repetido|repetido.*Payt/i)
  })
  it('rejeita flag desconhecida e pasta ausente', async () => {
    const dir = await root()
    const folder = await product(dir, 'kit')
    expect(run(folder, '--inexistente').status).not.toBe(0)
    expect(run(join(dir, 'ausente'), '--simular').status).not.toBe(0)
  })
  it('explica em português falhas nativas ao listar a pasta --todos', async () => {
    const dir = await root()
    const file = join(dir, 'arquivo.txt')
    await writeFile(file, 'não é uma pasta')
    for (const path of [join(dir, 'ausente'), file]) {
      const result = run(path, '--todos', '--simular')
      expect(result.status).not.toBe(0)
      expect(result.stderr).toMatch(/não foi possível.*listar.*pasta/i)
      expect(result.stderr).not.toMatch(/ENOENT|ENOTDIR|scandir|no such file|not a directory/i)
    }
  })
})
