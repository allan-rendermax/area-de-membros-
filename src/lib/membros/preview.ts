import { requireAdmin } from '@/lib/auth/require-admin'
import { getStore } from './session'

// Only read-only views use this guard. Student actions keep requireStoreSession.
export async function requireStorePreview(slug: string) {
  await requireAdmin()
  return { store: await getStore(slug), customer: null }
}
