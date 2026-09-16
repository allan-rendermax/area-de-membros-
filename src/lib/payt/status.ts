import { STATUS_RANK, type OrderStatus } from '@/lib/domain/types'

const PAYT_STATUS: Record<string, OrderStatus> = {
  waiting_payment: 'pendente',
  paid: 'pago',
  canceled: 'cancelado',
  refunded: 'reembolsado',
  chargeback: 'chargeback',
}

export function mapPaytStatus(raw: string): OrderStatus | null {
  return PAYT_STATUS[raw.trim().toLowerCase()] ?? null
}

export function canTransition(current: OrderStatus | null, next: OrderStatus): boolean {
  if (current === null) return true
  return STATUS_RANK[next] > STATUS_RANK[current]
}
