import { grantedMaterialIds, grantedProductIds } from '@/lib/access/access'
import type { CustomerRow, Material, Product } from '@/lib/domain/types'
import { getOfferLinks, listMaterials } from './catalog'
import { findCustomerByEmail } from './customers'
import { listAllOrderRefsByEmail, listOrderRefsByEmail } from './orders'
import { getProductLinks, listProducts } from './products'

export async function loadCustomerAccess(
  storeId: string,
  email: string,
): Promise<{ customer: CustomerRow | null; materials: Material[]; granted: Set<string> }> {
  const [customer, materials, links, orders] = await Promise.all([
    findCustomerByEmail(email),
    listMaterials(storeId),
    getOfferLinks(storeId),
    listOrderRefsByEmail(storeId, email),
  ])
  const granted = grantedMaterialIds(orders, links, !customer || customer.blockedAt !== null)
  return { customer, materials, granted }
}

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
