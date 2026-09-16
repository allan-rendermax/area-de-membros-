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
  primaryColor: string
  supportUrl: string | null
}

export type CustomerRow = {
  id: string
  email: string
  name: string
  blockedAt: string | null
}

export type Material = {
  id: string
  title: string
  description: string
  coverUrl: string | null
  downloadUrl: string
  checkoutUrl: string | null
  sortOrder: number
  isPublished: boolean
}

export type OfferLink = { productCode: string; materialId: string }

export type OrderRef = { productCode: string; status: OrderStatus }
