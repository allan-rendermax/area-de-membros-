import { grantedProductIds } from '@/lib/access/access'
import type { CustomerRow, Product } from '@/lib/domain/types'
import { findCustomerByEmail } from './customers'
import { listAllOrderRefsByEmail } from './orders'
import { getProductLinks, listProducts } from './products'

export async function loadStoreAccess(
  storeId: string,
  email: string,
): Promise<{ customer: CustomerRow | null; products: Product[]; granted: Set<string> }> {
  const [customer, products, links, orders] = await Promise.all([
    findCustomerByEmail(email),
    listProducts(storeId),
    getProductLinks(storeId),
    listAllOrderRefsByEmail(email),
  ])
  const granted = grantedProductIds(orders, links, !customer || customer.blockedAt !== null)
  return { customer, products, granted }
}
