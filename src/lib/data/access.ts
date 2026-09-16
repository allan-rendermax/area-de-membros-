import { grantedMaterialIds } from '@/lib/access/access'
import type { CustomerRow, Material } from '@/lib/domain/types'
import { getOfferLinks, listMaterials } from './catalog'
import { findCustomerByEmail } from './customers'
import { listOrderRefsByEmail } from './orders'

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
