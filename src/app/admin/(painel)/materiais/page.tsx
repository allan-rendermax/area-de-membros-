import Link from 'next/link'
import { listMaterials } from '@/lib/data/catalog'
import { getDefaultStore } from '@/lib/data/stores'
import { requireAdmin } from '@/lib/auth/require-admin'

export default async function MateriaisPage() {
  await requireAdmin()
  const store = await getDefaultStore()
  const materials = await listMaterials(store.id)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Materiais</h1>
        <Link href="/admin/materiais/novo" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white">Novo material</Link>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {materials.map((m) => (
          <li key={m.id}>
            <Link href={`/admin/materiais/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3">
              <span>{m.sortOrder}. {m.title}</span>
              <span className={m.isPublished ? 'text-sm text-green-700' : 'text-sm text-zinc-400'}>
                {m.isPublished ? 'Publicado' : 'Oculto'}
              </span>
            </Link>
          </li>
        ))}
        {materials.length === 0 && <li className="px-4 py-3 text-zinc-500">Nenhum material cadastrado.</li>}
      </ul>
    </div>
  )
}
