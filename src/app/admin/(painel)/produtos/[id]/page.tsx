import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ui } from '@/components/admin/ui'
import { getAdminStore } from '@/lib/admin/current-store'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getProductById, listModulesWithItems } from '@/lib/data/products'
import { ContentEditor } from '../content-editor'
import { ProductForm } from '../product-form'

export default async function ProdutoAdminPage({ params, searchParams }: PageProps<'/admin/produtos/[id]'>) {
  await requireAdmin()
  const [{ id }, { aba, msg }] = await Promise.all([params, searchParams])
  const store = await getAdminStore()
  const product = id !== 'novo' && isUuid(id) ? await getProductById(id) : null
  if (id !== 'novo' && (!product || product.storeId !== store.id)) notFound()

  const showContent = Boolean(product) && aba === 'conteudo'
  const modules = product && showContent ? await listModulesWithItems(product.id, { publishedOnly: false }) : []

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/produtos" className="text-sm text-texto-suave hover:text-texto">← Produtos</Link>
      <h1 className={ui.h1}>{product ? product.title : 'Novo produto'}</h1>
      {product && (
        <nav className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/produtos/${product.id}?aba=geral`} className={ui.chip(!showContent)}>Geral</Link>
          <Link href={`/admin/produtos/${product.id}?aba=conteudo`} className={ui.chip(showContent)}>Conteúdo</Link>
          <a href={`/${store.slug}/produto/${product.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-texto-suave hover:text-texto">
            Ver na loja ↗
          </a>
        </nav>
      )}
      {typeof msg === 'string' && <p role="status" className={ui.notice}>{msg}</p>}
      {product && showContent ? <ContentEditor productId={product.id} modules={modules} /> : <ProductForm product={product} />}
    </div>
  )
}
