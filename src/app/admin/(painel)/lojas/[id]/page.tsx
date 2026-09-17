import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getStoreById } from '@/lib/data/stores'
import { StoreForm } from '../store-form'

export default async function LojaPage({ params, searchParams }: PageProps<'/admin/lojas/[id]'>) {
  await requireAdmin()
  const [{ id }, { msg }] = await Promise.all([params, searchParams])
  const store = id !== 'nova' && isUuid(id) ? await getStoreById(id) : null
  if (id !== 'nova' && !store) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/lojas" className="text-sm text-texto-suave hover:text-texto">← Lojas</Link>
      <h1 className={ui.h1}>{store ? `Editar ${store.name}` : 'Nova loja'}</h1>
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      <StoreForm store={store} />
    </div>
  )
}
