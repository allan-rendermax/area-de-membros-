import { lstat, readdir, readFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve, join } from 'node:path'
import { lerFicha, montarPlano } from './cadastro-plano.mjs'

async function regularFile(path, label) {
  let stat
  try { stat = await lstat(path) } catch { throw new Error(`${label}: arquivo não encontrado ou inacessível.`) }
  if (stat.isSymbolicLink()) throw new Error(`${label}: link simbólico não permitido.`)
  if (!stat.isFile()) throw new Error(`${label}: deve ser arquivo regular.`)
  try { await access(path, constants.R_OK) } catch { throw new Error(`${label}: arquivo sem permissão de leitura.`) }
  return stat
}

async function list(directory, prefix, depth, files) {
  const entries = await readdir(directory, { withFileTypes: true })
  if (depth > 0 && entries.length === 0) throw new Error(`Módulo vazio: ${prefix.join('/')}.`)
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name)
    const relativePath = [...prefix, entry.name].join('/')
    const stat = await lstat(absolutePath)
    if (stat.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${relativePath}.`)
    if (stat.isDirectory()) {
      if (depth >= 1) throw new Error(`Subpasta profunda não permitida: ${relativePath}.`)
      await list(absolutePath, [...prefix, entry.name], depth + 1, files)
    } else if (stat.isFile()) {
      await access(absolutePath, constants.R_OK)
      await readFile(absolutePath)
      files.push({ relativePath, absolutePath, size: stat.size })
    } else {
      throw new Error(`Entrada não regular em entregaveis: ${relativePath}.`)
    }
  }
}

export async function lerPastaProduto(directory, { defaultStoreSlug } = {}) {
  const folder = resolve(directory)
  let root
  try { root = await lstat(folder) } catch { throw new Error(`Pasta do produto não encontrada: ${folder}.`) }
  if (root.isSymbolicLink() || !root.isDirectory()) throw new Error(`Pasta do produto inválida ou link simbólico: ${folder}.`)
  await regularFile(join(folder, 'produto.txt'), 'produto.txt')
  const ficha = lerFicha(await readFile(join(folder, 'produto.txt'), 'utf8'), { defaultStoreSlug })
  const files = []
  let linksTexto = ''
  const entries = await readdir(folder, { withFileTypes: true })
  for (const entry of entries) {
    const name = entry.name
    const path = join(folder, name)
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${name}.`)
    if (name === 'produto.txt') continue
    if (name === 'links.txt') {
      await regularFile(path, name)
      linksTexto = await readFile(path, 'utf8')
    } else if (name === 'entregaveis') {
      if (!stat.isDirectory()) throw new Error('entregaveis deve ser uma pasta.')
      await list(path, ['entregaveis'], 0, files)
    } else if (/^(capa|banner)\.(jpe?g|png|webp)$/i.test(name)) {
      await regularFile(path, name)
      await readFile(path)
      files.push({ relativePath: name, absolutePath: path, size: stat.size })
    } else {
      throw new Error(`Entrada não reconhecida na pasta do produto: ${name}.`)
    }
  }
  return { folder, ...montarPlano({ ficha, arquivos: files, linksTexto }) }
}
