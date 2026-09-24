import { grantedProductLevels } from '@/lib/access/access'
import type { AccessLevel, CustomerRow, Product } from '@/lib/domain/types'
import { findCustomerByEmail } from './customers'
import { listAllOrderRefsByEmail } from './orders'
import { getProductLinks, listProducts } from './products'

export async function loadStoreAccess(
  storeId: string,
  customerOrEmail: CustomerRow | string,
): Promise<{ customer: CustomerRow | null; products: Product[]; granted: Set<string>; levels: Map<string, AccessLevel> }> {
  const email = typeof customerOrEmail === 'string' ? customerOrEmail : customerOrEmail.email
  const [customer, products, links, orders] = await Promise.all([
    typeof customerOrEmail === 'string' ? findCustomerByEmail(email) : customerOrEmail,
    listProducts(storeId),
    getProductLinks(storeId),
    listAllOrderRefsByEmail(email),
  ])
  const levels = grantedProductLevels(orders, links, !customer || customer.blockedAt !== null)
  return { customer, products, granted: new Set(levels.keys()), levels }
}

export async function loadGrantedProductIds(storeId: string, customer: CustomerRow): Promise<Set<string>> {
  return new Set((await loadGrantedProductLevels(storeId, customer)).keys())
}

export async function loadGrantedProductLevels(storeId: string, customer: CustomerRow): Promise<Map<string, AccessLevel>> {
  if (customer.blockedAt !== null) return new Map()
  const [links, orders] = await Promise.all([
    getProductLinks(storeId),
    listAllOrderRefsByEmail(customer.email),
  ])
  return grantedProductLevels(orders, links, false)
}
