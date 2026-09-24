import { extname } from 'node:path'

const MIME = {
  pdf: 'application/pdf', zip: 'application/zip', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv',
}
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const STORE_RESERVED = new Set(['admin', 'api', 'entrar', 'sair', '_next', 'favicon.ico', 'manifest.webmanifest', 'sw.js', 'icons'])
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: false })

export function gerarSlug(text) {
  return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '')
}

function httpUrl(value, name) {
  let url
  try { url = new URL(value) } catch { throw new Error(`${name}: URL inválida.`) }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error(`${name}: use uma URL HTTP(S) válida, sem credenciais.`)
  }
  return value
}

export function lerFicha(text, { defaultStoreSlug } = {}) {
  if (typeof text !== 'string') throw new Error('A ficha produto.txt deve ser texto.')
  const fields = {}
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const allowed = new Set(['nome', 'id', 'tag', 'loja', 'slug', 'trilha', 'checkout', 'destaque', 'ordem', 'descricao'])
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    if (!line || line.startsWith('#')) continue
    const match = /^([\p{L}]+):\s*(.*)$/u.exec(line)
    if (!match) throw new Error(`produto.txt linha ${index + 1}: use chave: valor.`)
    const key = match[1].toLowerCase()
    if (!allowed.has(key)) throw new Error(`produto.txt linha ${index + 1}: campo desconhecido ${key}.`)
    if (Object.hasOwn(fields, key)) throw new Error(`produto.txt linha ${index + 1}: campo ${key} repetido.`)
    if (key === 'descricao') {
      fields.descricao = [match[2], ...lines.slice(index + 1)].join('\n').trim()
      break
    }
    fields[key] = match[2].trim()
  }
  for (const field of ['nome', 'id', 'tag']) if (!fields[field]) throw new Error(`produto.txt: campo ${field} obrigatório.`)
  if (/\s/.test(fields.id)) throw new Error('produto.txt: id não pode conter espaços.')
  if (!['front', 'orderbump', 'upsell'].includes(fields.tag)) throw new Error('produto.txt: tag deve ser front, orderbump ou upsell.')
  const loja = fields.loja || defaultStoreSlug
  if (!loja) throw new Error('produto.txt: loja obrigatória ou configure DEFAULT_STORE_SLUG.')
  if (!SLUG.test(loja) || STORE_RESERVED.has(loja)) throw new Error('produto.txt: slug da loja inválido ou reservado.')
  const slug = fields.slug || gerarSlug(fields.nome)
  if (!SLUG.test(slug) || slug.length > 60) throw new Error('produto.txt: slug inválido.')
  const checkout = fields.checkout ? httpUrl(fields.checkout, 'checkout') : null
  if (fields.tag !== 'front' && !checkout) throw new Error('produto.txt: checkout obrigatório para orderbump/upsell.')
  const destaque = fields.destaque === undefined ? false : ({ sim: true, nao: false, 'não': false })[fields.destaque.toLowerCase()]
  if (typeof destaque !== 'boolean') throw new Error('produto.txt: destaque deve ser sim ou não.')
  const ordem = fields.ordem === undefined ? 0 : Number(fields.ordem)
  if (fields.ordem !== undefined && (!/^-?\d+$/.test(fields.ordem) || !Number.isInteger(ordem) || ordem < -2147483648 || ordem > 2147483647)) {
    throw new Error('produto.txt: ordem deve ser inteiro PostgreSQL válido.')
  }
  return { nome: fields.nome, id: fields.id, tag: fields.tag, loja, slug, trilha: fields.trilha || '', checkout, destaque, ordem, descricao: fields.descricao || '' }
}

function titled(name) {
  const match = /^(\d+)\s+(.+)$/.exec(name)
  const title = (match ? match[2] : name).trim()
  if (!title) throw new Error(`Título vazio em ${name}.`)
  return { title, number: match ? Number(match[1]) : null, original: name }
}

function compareNames(a, b) {
  if (a.number !== null && b.number === null) return -1
  if (a.number === null && b.number !== null) return 1
  if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number
  return collator.compare(a.title, b.title) || a.original.localeCompare(b.original)
}

function assignOrders(entries) {
  let next = Math.max(0, ...entries.map((entry) => entry.number ?? 0)) + 1
  return entries.map((entry) => entry.number ?? next++)
}

function storageComponent(name) {
  const ext = extname(name).toLowerCase()
  const stem = name.slice(0, name.length - ext.length)
  const normalized = stem.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').trim()
  if (!normalized || normalized === '.' || normalized === '..') throw new Error(`Nome de arquivo inválido: ${name}.`)
  return normalized + ext
}

function downloadName(title, extension) {
  return `${title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').trim()}${extension}`
}

function titleKey(title) {
  return title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export function montarPlano({ ficha, arquivos, linksTexto = '' }) {
  if (!ficha?.slug || !Array.isArray(arquivos)) throw new Error('Ficha ou lista de arquivos inválida.')
  const uploads = []
  const seenStorage = new Set()
  const images = { capa: null, banner: null }
  const groups = new Map()
  for (const file of arquivos) {
    const relativePath = file?.relativePath
    if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\\') || relativePath.startsWith('/') || relativePath.split('/').some((part) => !part || part === '.' || part === '..') || !Number.isSafeInteger(file.size) || file.size < 0 || !file.absolutePath) {
      throw new Error('Arquivo com caminho, tamanho ou tipo inválido.')
    }
    const parts = relativePath.split('/')
    const rootImage = parts.length === 1 && /^(capa|banner)\.(jpe?g|png|webp)$/i.exec(parts[0])
    if (!rootImage && (parts[0] !== 'entregaveis' || parts.length < 2 || parts.length > 3)) {
      throw new Error(`Subpasta profunda ou arquivo fora de entregaveis: ${relativePath}.`)
    }
    const storagePath = `${ficha.slug}/${parts.map(storageComponent).join('/')}`
    const collisionKey = storagePath.toLocaleLowerCase('pt-BR')
    if (seenStorage.has(collisionKey)) throw new Error(`Colisão de destino no storage: ${storagePath}.`)
    seenStorage.add(collisionKey)
    const extension = extname(parts.at(-1)).toLowerCase()
    const itemTitle = titled(parts.at(-1).slice(0, -extension.length || undefined))
    const upload = { relativePath, absolutePath: file.absolutePath, size: file.size, storagePath, contentType: MIME[extension.slice(1)] || 'application/octet-stream', downloadName: downloadName(itemTitle.title, extension) }
    uploads.push(upload)
    if (rootImage) {
      const role = rootImage[1].toLowerCase()
      if (images[role]) throw new Error(`Mais de uma imagem para ${role}.`)
      images[role] = upload
      continue
    }
    const moduleName = parts.length === 2 ? 'Material' : parts[1]
    if (!groups.has(moduleName)) groups.set(moduleName, [])
    groups.get(moduleName).push({ ...itemTitle, upload })
  }
  const modules = [...groups].map(([name, items]) => ({ ...titled(name), items }))
  const titles = new Set()
  for (const group of modules) {
    const key = titleKey(group.title)
    if (titles.has(key)) throw new Error(`Colisão de título de módulo: ${group.title}.`)
    titles.add(key)
  }
  modules.sort(compareNames)
  const moduleOrders = assignOrders(modules)
  const result = modules.map((group, index) => {
    const itemTitles = new Set()
    group.items.sort(compareNames)
    const itemOrders = assignOrders(group.items)
    const itens = group.items.map((item, itemIndex) => {
      const key = titleKey(item.title)
      if (itemTitles.has(key)) throw new Error(`Colisão de título de item no módulo ${group.title}: ${item.title}.`)
      itemTitles.add(key)
      return { title: item.title, kind: 'arquivo', sortOrder: itemOrders[itemIndex], url: null, arquivo: item.upload }
    })
    return { title: group.title, sortOrder: moduleOrders[index], itens }
  })
  const online = []
  const onlineTitles = new Set()
  if (typeof linksTexto !== 'string') throw new Error('links.txt deve ser texto.')
  for (const [index, raw] of linksTexto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const bar = line.indexOf('|')
    if (bar < 1) throw new Error(`links.txt linha ${index + 1}: use Título | URL.`)
    const title = line.slice(0, bar).trim()
    const url = line.slice(bar + 1).trim()
    if (!title || !url) throw new Error(`links.txt linha ${index + 1}: título ou URL vazia.`)
    const key = titleKey(title)
    if (onlineTitles.has(key)) throw new Error(`Colisão de título de item em Conteúdo online: ${title}.`)
    onlineTitles.add(key)
    httpUrl(url, `links.txt linha ${index + 1}`)
    const host = new URL(url).hostname.toLowerCase()
    const video = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)
    online.push({ title, kind: video ? 'video' : 'link', sortOrder: online.length + 1, url, arquivo: null })
  }
  if (online.length) {
    if (titles.has('conteúdo online')) throw new Error('Colisão de título de módulo: Conteúdo online.')
    result.push({ title: 'Conteúdo online', sortOrder: Math.max(0, ...moduleOrders) + 1, itens: online })
  }
  return { ficha, imagens: images, modulos: result, arquivos: uploads }
}
