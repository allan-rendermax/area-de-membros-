import { grantedProductIds } from '@/lib/access/access'
import type { CustomerRow, Product } from '@/lib/domain/types'
import { findCustomerByEmail } from './customers'
import { listAllOrderRefsByEmail } from './orders'
import { getProductLinks, listProducts } from './products'

export async function loadStoreAccess(
  storeId: string,
  customerOrEmail: CustomerRow | string,
): Promise<{ customer: CustomerRow | null; products: Product[]; granted: Set<string> }> {
  const email = typeof customerOrEmail === 'string' ? customerOrEmail : customerOrEmail.email
  const [customer, products, links, orders] = await Promise.all([
    typeof customerOrEmail === 'string' ? findCustomerByEmail(email) : customerOrEmail,
    listProducts(storeId),
    getProductLinks(storeId),
    listAllOrderRefsByEmail(email),
  ])
  const granted = grantedProductIds(orders, links, !customer || customer.blockedAt !== null)
  return { customer, products, granted }
}

export async function loadGrantedProductIds(storeId: string, customer: CustomerRow): Promise<Set<string>> {
  if (customer.blockedAt !== null) return new Set()
  const [links, orders] = await Promise.all([
    getProductLinks(storeId),
    listAllOrderRefsByEmail(customer.email),
  ])
  return grantedProductIds(orders, links, false)
}
