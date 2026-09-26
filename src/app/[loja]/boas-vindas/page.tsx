import { redirect } from 'next/navigation'
import { WelcomeTerms } from '@/components/membros/welcome-terms'
import { hasAcceptedMemberTerms, requiresMemberTerms } from '@/lib/data/member-terms'
import { requireStoreIdentity } from '@/lib/membros/session'
import { requireStorePreview } from '@/lib/membros/preview'

export const dynamic = 'force-dynamic'

export default async function WelcomePage({ params, searchParams }: PageProps<'/[loja]/boas-vindas'>) {
  const [{ loja }, query] = await Promise.all([params, searchParams])
  if (query.previa === '1') {
    const { store } = await requireStorePreview(loja)
    if (!requiresMemberTerms(store.slug)) redirect(`/${store.slug}?previa=1`)
    return <WelcomeTerms storeSlug={store.slug} preview />
  }
  const { store, customer } = await requireStoreIdentity(loja)
  if (!requiresMemberTerms(store.slug) || await hasAcceptedMemberTerms(customer.id, store.id)) redirect(`/${store.slug}`)
  return <WelcomeTerms storeSlug={store.slug} />
}
