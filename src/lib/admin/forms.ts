import { isValidSlug, isValidStoreSlug, slugify } from '@/lib/content/slug'
import { isHttpUrl, isUuid } from '@/lib/content/url'
import { toVideoEmbed } from '@/lib/content/video'
import type { AccessLevel, ItemKind, ProductRole } from '@/lib/domain/types'
import { normalizeWhatsapp } from '@/lib/support/whatsapp'

export class FormError extends Error {}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function checked(form: FormData, name: string): boolean {
  return form.get(name) === 'on'
}

function optionalUrl(form: FormData, name: string, label: string): string | null {
  const value = text(form, name)
  if (!value) return null
  if (!isHttpUrl(value)) throw new FormError(`Link inválido em "${label}". Use um endereço começando com https://.`)
  return value
}

function optionalId(form: FormData, name: string): string | null {
  const value = text(form, name)
  if (!value) return null
  if (!isUuid(value)) throw new FormError('Registro inválido.')
  return value
}

function requiredId(form: FormData, name: string): string {
  const value = optionalId(form, name)
  if (!value) throw new FormError('Registro inválido.')
  return value
}

export type StoreInput = {
  id: string | null
  slug: string
  name: string
  logoUrl: string | null
  supportWhatsapp: string | null
  supportUrl: string | null
  loginImageUrl: string | null
}

export function parseStoreForm(form: FormData): StoreInput {
  const name = text(form, 'name')
  if (!name) throw new FormError('Informe o nome da loja.')
  const slug = text(form, 'slug') || slugify(name)
  if (!isValidStoreSlug(slug)) {
    throw new FormError('Endereço inválido: use letras minúsculas, números e hífen, sem nomes reservados (admin, api, entrar, sair, icons).')
  }
  const whatsappRaw = text(form, 'support_whatsapp')
  const supportWhatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null
  if (whatsappRaw && !supportWhatsapp) throw new FormError('WhatsApp inválido: use DDI + DDD + número, por exemplo 5511999998888.')
  return {
    id: optionalId(form, 'id'),
    slug,
    name,
    logoUrl: optionalUrl(form, 'logo_url', 'Logo'),
    supportWhatsapp,
    supportUrl: optionalUrl(form, 'support_url', 'Link de suporte'),
    loginImageUrl: optionalUrl(form, 'login_image_url', 'Imagem do login'),
  }
}

export type ProductInput = {
  id: string | null
  storeId: string
  slug: string
  title: string
  track: string
  description: string
  coverUrl: string | null
  bannerUrl: string | null
  checkoutUrl: string | null
  upgradeCheckoutUrl?: string | null
  role: ProductRole
  studentCheckoutUrl: string | null
  isFeatured: boolean
  sortOrder: number
  isPublished: boolean
}

export function parseProductForm(form: FormData, storeId: string): ProductInput {
  const title = text(form, 'title')
  if (!title) throw new FormError('Informe o título do produto.')
  const slug = text(form, 'slug') || slugify(title)
  if (!isValidSlug(slug)) throw new FormError('Endereço do produto inválido: use letras minúsculas, números e hífen.')
  const sortOrder = Number(text(form, 'sort_order') || 0)
  const role = text(form, 'role') || 'front'
  if (role !== 'front' && role !== 'orderbump' && role !== 'upsell') throw new FormError('Papel do produto inválido.')
  const checkoutUrl = optionalUrl(form, 'checkout_url', 'Checkout')
  if (role !== 'front' && !checkoutUrl) throw new FormError('Informe o link do checkout para produto complementar.')
  return {
    id: optionalId(form, 'id'),
    storeId,
    slug,
    title,
    track: text(form, 'track'),
    description: text(form, 'description'),
    coverUrl: optionalUrl(form, 'cover_url', 'Capa'),
    bannerUrl: optionalUrl(form, 'banner_url', 'Banner'),
    checkoutUrl,
    upgradeCheckoutUrl: optionalUrl(form, 'upgrade_checkout_url', 'Checkout de upgrade'),
    role,
    studentCheckoutUrl: optionalUrl(form, 'student_checkout_url', 'Checkout de aluno'),
    isFeatured: checked(form, 'is_featured'),
    sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
    isPublished: checked(form, 'is_published'),
  }
}

export type ModuleInput = { id: string | null; productId: string; title: string; isPublished: boolean; requiredLevel?: AccessLevel }

export function parseModuleForm(form: FormData): ModuleInput {
  const title = text(form, 'title')
  if (!title) throw new FormError('Informe o nome do módulo.')
  const requiredLevel = text(form, 'required_level') || 'basic'
  if (requiredLevel !== 'basic' && requiredLevel !== 'complete') throw new FormError('Nível de acesso inválido.')
  return { id: optionalId(form, 'id'), productId: requiredId(form, 'product_id'), title, isPublished: checked(form, 'is_published'), requiredLevel }
}

const KINDS: readonly ItemKind[] = ['arquivo', 'video', 'link']

export type ItemInput = {
  id: string | null
  moduleId: string
  title: string
  kind: ItemKind
  url: string
  coverUrl: string | null
  isPublished: boolean
}

export function parseItemForm(form: FormData): ItemInput {
  const title = text(form, 'title')
  if (!title) throw new FormError('Informe o título do item.')
  const kind = text(form, 'kind') as ItemKind
  if (!KINDS.includes(kind)) throw new FormError('Tipo de item inválido.')
  const url = optionalUrl(form, 'url', 'Link do item')
  if (!url) throw new FormError('Informe o link do item.')
  if (kind === 'video' && !toVideoEmbed(url)) throw new FormError('Vídeo não reconhecido: use um link do YouTube, Vimeo ou Panda.')
  return {
    id: optionalId(form, 'id'),
    moduleId: requiredId(form, 'module_id'),
    title,
    kind,
    url,
    coverUrl: optionalUrl(form, 'cover_url', 'Capa do item'),
    isPublished: checked(form, 'is_published'),
  }
}

export type OfferInput = { id: string | null; storeId: string; name: string; paytProductCode: string; productIds: string[]; productLevels?: Record<string, AccessLevel> }

export function parseOfferForm(form: FormData, storeId: string): OfferInput {
  const name = text(form, 'name')
  if (!name) throw new FormError('Informe o nome da oferta.')
  const paytProductCode = text(form, 'payt_product_code')
  if (!paytProductCode || /\s/.test(paytProductCode)) throw new FormError('Informe o código do produto na Payt, sem espaços.')
  const productIds = form.getAll('product_ids').map(String)
  if (!productIds.every(isUuid)) throw new FormError('Produto inválido.')
  if (productIds.length === 0) throw new FormError('Selecione ao menos um produto para a oferta.')
  const productLevels: Record<string, AccessLevel> = {}
  for (const id of productIds) {
    const level = text(form, `grant_level_${id}`) || 'complete'
    if (level !== 'basic' && level !== 'complete') throw new FormError('Nível de acesso inválido na oferta.')
    productLevels[id] = level
  }
  return { id: optionalId(form, 'id'), storeId, name, paytProductCode, productIds, productLevels }
}
