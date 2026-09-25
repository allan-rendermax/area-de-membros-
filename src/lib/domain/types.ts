export type OrderStatus = 'pendente' | 'pago' | 'cancelado' | 'reembolsado' | 'chargeback'

export const STATUS_RANK: Record<OrderStatus, number> = {
  pendente: 0,
  pago: 1,
  cancelado: 2,
  reembolsado: 2,
  chargeback: 2,
}

export type Store = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  supportUrl: string | null
  supportWhatsapp: string | null
  loginImageUrl: string | null
}

export type StoreRef = Pick<Store, 'id' | 'slug' | 'name'>

export type CustomerRow = {
  id: string
  email: string
  name: string
  blockedAt: string | null
}

export type OrderRef = { productCode: string; status: OrderStatus }

export type ItemKind = 'arquivo' | 'video' | 'link'
export type ContentMode = 'versions' | 'sections'

export type ProductRole = 'front' | 'orderbump' | 'upsell'
export type AccessLevel = 'basic' | 'complete'

export type Product = {
  id: string
  storeId: string
  slug: string
  title: string
  track: string
  description: string
  coverUrl: string | null
  bannerUrl: string | null
  checkoutUrl: string | null
  upgradeCheckoutUrl?: string | null
  contentMode?: ContentMode
  upgradeImageUrl?: string | null
  upgradeButtonText?: string | null
  purchaseTitle?: string | null
  purchaseDescription?: string | null
  purchaseImageUrl?: string | null
  purchaseButtonText?: string | null
  role: ProductRole
  studentCheckoutUrl?: string | null
  isFeatured: boolean
  sortOrder: number
  isPublished: boolean
}

export type Module = {
  id: string
  productId: string
  title: string
  sortOrder: number
  isPublished: boolean
  requiredLevel?: AccessLevel
}

export type Item = {
  id: string
  moduleId: string
  title: string
  kind: ItemKind
  url: string
  coverUrl: string | null
  sortOrder: number
  isPublished: boolean
}

export type ModuleWithItems = Module & { items: Item[] }

export type ProductLink = { productCode: string; productId: string; grantLevel?: AccessLevel }

export type EmailKind = 'acesso_novo' | 'produto_novo' | 'reenvio'

export type AccessNotice = {
  customerId: string
  to: string
  customerName: string
  store: StoreRef
  products: { id: string; title: string }[]
  kind: EmailKind
}

export type NoticeResult = { ok: true } | { ok: false; error: string }
