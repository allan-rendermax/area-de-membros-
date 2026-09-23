'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, uploadIfPresent, withMessage } from '@/lib/admin/action-helpers'
import { assertAdminStoreContext, getAdminStore } from '@/lib/admin/current-store'
import { parseItemForm, parseModuleForm, parseProductForm } from '@/lib/admin/forms'
import { validateItemUpload, type ItemUploadTicket } from '@/lib/admin/item-upload'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getProductById } from '@/lib/data/products'
import { createItemUpload, deleteItem, deleteModule, moveItem, moveModule, saveItem, saveModule, saveProduct, uploadImage } from '@/lib/data/products-admin'

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? '')
}

function direction(form: FormData): 'up' | 'down' {
  return field(form, 'direcao') === 'up' ? 'up' : 'down'
}

async function requireOwnProduct(productId: string) {
  await requireAdmin()
  const store = await getAdminStore()
  const product = isUuid(productId) ? await getProductById(productId) : null
  if (!product || product.storeId !== store.id) redirect('/admin/produtos')
  return { store, product }
}

export async function prepararUploadArquivo(
  productId: string,
  name: string,
  size: number,
): Promise<{ data: ItemUploadTicket; error?: never } | { error: string; data?: never }> {
  await requireOwnProduct(productId)
  const validationError = validateItemUpload(name, size)
  if (validationError) return { error: validationError }
  try {
    return { data: await createItemUpload(name, size) }
  } catch {
    return { error: 'Não foi possível preparar o envio do arquivo. Tente novamente.' }
  }
}

function done(storeSlug: string, productId: string, aba: 'geral' | 'conteudo', message: string): never {
  revalidatePath(`/admin/produtos/${productId}`)
  revalidatePath(`/${storeSlug}`, 'layout')
  redirect(withMessage(`/admin/produtos/${productId}?aba=${aba}`, message))
}

async function attempt(action: () => Promise<unknown>, success: string): Promise<string> {
  try {
    await action()
    return success
  } catch (e) {
    return errorText(e)
  }
}

export async function salvarProduto(formData: FormData) {
  await requireAdmin()
  const store = await getAdminStore()
  const currentId = field(formData, 'id') || 'novo'
  try {
    assertAdminStoreContext(formData, store.id)
  } catch (e) {
    redirect(withMessage(currentId === 'novo' ? '/admin/produtos/novo' : '/admin/produtos', errorText(e)))
  }
  if (currentId !== 'novo') await requireOwnProduct(currentId)

  let productId: string
  try {
    const input = parseProductForm(formData, store.id)
    input.coverUrl = await uploadIfPresent(formData.get('cover'), input.coverUrl, uploadImage)
    input.bannerUrl = await uploadIfPresent(formData.get('banner'), input.bannerUrl, uploadImage)
    productId = await saveProduct(input)
  } catch (e) {
    redirect(withMessage(`/admin/produtos/${currentId}`, errorText(e)))
  }
  revalidatePath('/admin/produtos')
  done(store.slug, productId, 'geral', 'Produto salvo.')
}

export async function salvarModulo(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => saveModule(parseModuleForm(formData)), 'Módulo salvo.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function excluirModulo(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => deleteModule(field(formData, 'id'), product.id), 'Módulo excluído.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function moverModulo(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => moveModule(field(formData, 'id'), product.id, direction(formData)), 'Ordem atualizada.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function salvarItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => saveItem(parseItemForm(formData)), 'Item salvo.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function excluirItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => deleteItem(field(formData, 'id')), 'Item excluído.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function moverItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => moveItem(field(formData, 'id'), field(formData, 'module_id'), direction(formData)), 'Ordem atualizada.')
  done(store.slug, product.id, 'conteudo', message)
}
