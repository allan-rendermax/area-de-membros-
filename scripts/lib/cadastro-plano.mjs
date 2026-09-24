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
const MAX_ORDER = 2147483647

function validOrder(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_ORDER) {
    throw new Error(`${name}: ordem fora do limite inteiro PostgreSQL.`)
  }
  return value
}

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
  const allowed = new Set(['nome', 'id', 'id_basico', 'id_completo', 'id_upgrade', 'tag', 'loja', 'slug', 'trilha', 'checkout', 'checkout_upgrade', 'destaque', 'ordem', 'descricao'])
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    if (!line || line.startsWith('#')) continue
    const match = /^([\p{L}_]+):\s*(.*)$/u.exec(line)
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
  for (const field of ['nome', 'tag']) if (!fields[field]) throw new Error(`produto.txt: campo ${field} obrigatório.`)
  const modoNiveis = Object.keys(fields).some(key => ['id_basico', 'id_completo', 'id_upgrade', 'checkout_upgrade'].includes(key))
  if (modoNiveis) {
    if (fields.id) throw new Error('produto.txt: id legado não pode ser usado com id_basico/id_completo/id_upgrade.')
    if (!fields.id_basico || !(fields.id_completo || fields.id_upgrade)) throw new Error('produto.txt: id_basico e ao menos id_completo ou id_upgrade são obrigatórios.')
    if (!fields.checkout_upgrade) throw new Error('produto.txt: checkout_upgrade obrigatório.')
  } else if (!fields.id) throw new Error('produto.txt: campo id obrigatório.')
  const codes = modoNiveis ? [fields.id_basico, fields.id_completo, fields.id_upgrade].filter(Boolean) : [fields.id]
  if (codes.some(code => /\s/.test(code))) throw new Error('produto.txt: id/código Payt não pode conter espaços.')
  if (new Set(codes).size !== codes.length) throw new Error('produto.txt: códigos Payt repetidos.')
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
  const base = { nome: fields.nome, tag: fields.tag, loja, slug, trilha: fields.trilha || '', checkout, destaque, ordem, descricao: fields.descricao || '' }
  if (!modoNiveis) return { ...base, id: fields.id }
  const ofertas = [
    { codigo: fields.id_basico, nivel: 'basic', nome: `${fields.nome} — Básico` },
    fields.id_completo && { codigo: fields.id_completo, nivel: 'complete', nome: `${fields.nome} — Completo` },
    fields.id_upgrade && { codigo: fields.id_upgrade, nivel: 'complete', nome: `${fields.nome} — Upgrade` },
  ].filter(Boolean)
  return { ...base, modoNiveis: true, checkoutUpgrade: httpUrl(fields.checkout_upgrade, 'checkout_upgrade'), ofertas }
}

function titled(name) {
  const match = /^(\d+)\s+(.+)$/.exec(name)
  const title = (match ? match[2] : name).trim()
  if (!title) throw new Error(`Título vazio em ${name}.`)
  return { title, number: match ? validOrder(Number(match[1]), `Prefixo de ${name}`) : null, original: name }
}

function compareNames(a, b) {
  if (a.number !== null && b.number === null) return -1
  if (a.number === null && b.number !== null) return 1
  if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number
  return collator.compare(a.title, b.title) || a.original.localeCompare(b.original)
}

function assignOrders(entries) {
  let next = entries.reduce((highest, entry) => Math.max(highest, entry.number ?? 0), 0)
  return entries.map((entry) => entry.number ?? validOrder(++next, 'Ordem derivada'))
}

function storageComponent(name) {
  const ext = extname(name).toLowerCase()
  const stem = name.slice(0, name.length - ext.length)
  const normalized = (stem + ext).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|#%\x00-\x1f]/g, '-').trim()
  if (!normalized || normalized === '.' || normalized === '..') throw new Error(`Nome de arquivo inválido: ${name}.`)
  return normalized
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
    const levelFolder = ficha.modoNiveis && ['basico', 'completo'].includes(parts[1])
    if (!rootImage && (parts[0] !== 'entregaveis' || parts.length < 2 || parts.length > (levelFolder ? 4 : 3) || (levelFolder && parts.length < 3))) {
      throw new Error(`Subpasta profunda ou arquivo fora de entregaveis: ${relativePath}.`)
    }
    const storagePath = `${ficha.slug}/${parts.map(storageComponent).join('/')}`
    const collisionKey = storagePath.toLocaleLowerCase('pt-BR')
    if (seenStorage.has(collisionKey)) throw new Error(`Colisão de destino no storage: ${storagePath}.`)
    seenStorage.add(collisionKey)
    const extension = extname(parts.at(-1)).toLowerCase()
    const itemTitle = titled(parts.at(-1).slice(0, -extension.length || undefined))
    const upload = { relativePath, absolutePath: file.absolutePath, size: file.size, storagePath, contentType: MIME[extension.slice(1)] || 'application/octet-stream', downloadName: downloadName(itemTitle.title, extension), bucket: ficha.modoNiveis && !rootImage ? 'arquivos-restritos' : 'arquivos' }
    uploads.push(upload)
    if (rootImage) {
      const role = rootImage[1].toLowerCase()
      if (images[role]) throw new Error(`Mais de uma imagem para ${role}.`)
      images[role] = upload
      continue
    }
    const moduleName = levelFolder ? parts.length === 3 ? (parts[1] === 'basico' ? 'Material básico' : 'Extras do Completo') : parts[2] : parts.length === 2 ? 'Material' : parts[1]
    const groupKey = `${levelFolder ? parts[1] : 'direto'}/${moduleName}`
    if (!groups.has(groupKey)) groups.set(groupKey, { name: moduleName, requiredLevel: levelFolder && parts[1] === 'completo' ? 'complete' : 'basic', items: [] })
    groups.get(groupKey).items.push({ ...itemTitle, upload })
  }
  const modules = [...groups.values()].map(group => ({ ...titled(group.name), ...group }))
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
    return { title: group.title, sortOrder: moduleOrders[index], requiredLevel: group.requiredLevel, itens }
  })
  const online = { basic: [], complete: [] }
  const onlineTitles = { basic: new Set(), complete: new Set() }
  if (typeof linksTexto !== 'string') throw new Error('links.txt deve ser texto.')
  for (const [index, raw] of linksTexto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const columns = line.split('|').map(value => value.trim())
    if (columns.length < 2 || columns.length > 3) throw new Error(`links.txt linha ${index + 1}: use Título | URL | basico/completo.`)
    const [title, url, nivel = 'basico'] = columns
    if (!title || !url) throw new Error(`links.txt linha ${index + 1}: título ou URL vazia.`)
    if (!['basico', 'completo'].includes(nivel) || (!ficha.modoNiveis && nivel === 'completo')) throw new Error(`links.txt linha ${index + 1}: nível inválido.`)
    const requiredLevel = nivel === 'completo' ? 'complete' : 'basic'
    const key = titleKey(title)
    if (onlineTitles[requiredLevel].has(key)) throw new Error(`Colisão de título de item em Conteúdo online: ${title}.`)
    onlineTitles[requiredLevel].add(key)
    httpUrl(url, `links.txt linha ${index + 1}`)
    const host = new URL(url).hostname.toLowerCase()
    const video = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)
    online[requiredLevel].push({ title, kind: video ? 'video' : 'link', sortOrder: online[requiredLevel].length + 1, url, arquivo: null })
  }
  for (const [index, requiredLevel] of ['basic', 'complete'].entries()) {
    if (!online[requiredLevel].length) continue
    const title = requiredLevel === 'basic' ? 'Conteúdo online' : 'Conteúdo online — Completo'
    if (titles.has(titleKey(title))) throw new Error(`Colisão de título de módulo: ${title}.`)
    result.push({ title, requiredLevel, sortOrder: validOrder(Math.max(0, ...moduleOrders) + index + 1, title), itens: online[requiredLevel] })
  }
  return { ficha, ofertas: ficha.ofertas, imagens: images, modulos: result, arquivos: uploads }
}
