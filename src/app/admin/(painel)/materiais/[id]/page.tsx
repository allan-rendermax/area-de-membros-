import { notFound } from 'next/navigation'
import { getMaterial } from '@/lib/data/catalog'
import { MaterialForm } from '../material-form'

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const material = id === 'novo' ? null : await getMaterial(id)
  if (id !== 'novo' && !material) notFound()

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{material ? 'Editar material' : 'Novo material'}</h1>
      <MaterialForm material={material} />
    </div>
  )
}
