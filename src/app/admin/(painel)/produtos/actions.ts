'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { errorText, withMessage } from '@/lib/admin/action-helpers'
import { assertAdminStoreContext, getAdminStore } from '@/lib/admin/current-store'
import { FormError, parseItemForm, parseModuleForm, parseProductForm } from '@/lib/admin/forms'
import { productFormError, type ProductFormState } from '@/lib/admin/product-form-state'
import { IMAGE_FIELDS, PRODUCT_IMAGE_SLOTS, type ProductImageSlot, type ProductImageTicket } from '@/lib/admin/product-image-upload'
import { createProductImageUpload, validateProductImageReference } from '@/lib/data/product-image-uploads'
import { assertProductPublicationReady } from '@/lib/admin/product-publication'
import { validateItemUpload, type ItemUploadTicket } from '@/lib/admin/item-upload'
import { requireAdmin } from '@/lib/auth/require-admin'
import { isUuid } from '@/lib/content/url'
import { getProductById } from '@/lib/data/products'
import { deleteProduct } from '@/lib/data/product-deletion'
import { createItemUpload, deleteItem, deleteModule, moveItem, moveModule, saveItem, saveModule, saveProduct } from '@/lib/data/products-admin'

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? '')
}

function direction(form: FormData): 'up' | 'down' {
  return field(form, 'direcao') === 'up' ? 'up' : 'down'
}

export type DeleteProductState = { error: string | null }

export async function excluirProduto(_previous: DeleteProductState, formData: FormData): Promise<DeleteProductState> {
  await requireAdmin()
  const store = await getAdminStore()
  try {
    assertAdminStoreContext(formData, store.id)
    const id = formData.get('id')
    const confirmation = formData.get('confirmation')
    if (typeof id !== 'string' || !isUuid(id)) return { error: 'Produto inválido. Recarregue a página.' }
    if (typeof confirmation !== 'string' || !confirmation.trim()) return { error: 'Digite o nome do produto para confirmar a exclusão.' }
    await deleteProduct({ id, storeId: store.id, confirmation: confirmation.trim() })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível excluir o produto. Tente novamente.' }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath(`/${store.slug}`, 'layout')
  redirect(withMessage('/admin/produtos', 'Produto excluído.'))
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

export async function prepararUploadImagem(storeId: string, productId: string | null, slot: ProductImageSlot, size: number, mime: string): Promise<{ data: ProductImageTicket; error?: never } | { error: string; data?: never }> {
  await requireAdmin()
  const store = await getAdminStore()
  try {
    if (storeId !== store.id) throw new Error('A loja foi alterada. Recarregue a página antes de enviar imagens.')
    if (productId) {
      const product = isUuid(productId) ? await getProductById(productId) : null
      if (!product || product.storeId !== store.id) throw new Error('Produto inválido nesta loja.')
    }
    return { data: await createProductImageUpload({ storeId: store.id, productId, slot }, size, mime) }
  } catch (error) { return { error: errorText(error) } }
}

export async function salvarProdutoComEstado(_previous: ProductFormState, formData: FormData): Promise<ProductFormState> {
  return salvarProduto(formData)
}

export async function salvarProduto(formData: FormData): Promise<ProductFormState> {
  await requireAdmin()
  const store = await getAdminStore()
  let productId: string
  try {
    assertAdminStoreContext(formData, store.id)
    for (const value of formData.values()) {
      if (value instanceof File && value.size > 0) throw new Error('Aguarde o envio individual de cada imagem antes de salvar.')
    }
    const currentId = field(formData, 'id')
    const existing = currentId && isUuid(currentId) ? await getProductById(currentId) : null
    if (currentId && (!existing || existing.storeId !== store.id)) throw new Error('Produto inválido nesta loja. Recarregue a página.')
    // An uploaded replacement wins over a simultaneously checked removal.
    for (const slot of PRODUCT_IMAGE_SLOTS) {
      if (field(formData, `${slot}_image_receipt`) && field(formData, IMAGE_FIELDS[slot])) formData.delete(`remove_${slot}_image`)
    }
    const input = parseProductForm(formData, store.id)
    const properties = { cover: 'coverUrl', banner: 'bannerUrl', purchase: 'purchaseImageUrl', upgrade: 'upgradeImageUrl' } as const
    for (const slot of PRODUCT_IMAGE_SLOTS) {
      const value = input[properties[slot]]
      if (!value || value === existing?.[properties[slot]]) continue
      try {
        await validateProductImageReference({ storeId: store.id, productId: existing?.id ?? null, slot }, value, field(formData, `${slot}_image_receipt`))
      } catch (error) { throw new FormError(errorText(error), IMAGE_FIELDS[slot]) }
    }
    await assertProductPublicationReady({ productId: existing?.id, storeId: store.id, isPublished: input.isPublished, mode: input.contentMode })
    productId = await saveProduct(input)
  } catch (error) {
    return productFormError(error)
  }
  revalidatePath('/admin/produtos')
  if (field(formData, 'id')) {
    revalidatePath(`/admin/produtos/${productId}`)
    revalidatePath(`/${store.slug}`, 'layout')
    return { status: 'saved', fieldErrors: {}, message: 'Produto salvo.' }
  }
  done(store.slug, productId, 'geral', 'Produto salvo.')
}

export async function salvarModulo(formData: FormData): Promise<ProductFormState> {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  try { await saveModule(parseModuleForm(formData)) } catch (error) { return productFormError(error) }
  revalidatePath(`/admin/produtos/${product.id}`)
  revalidatePath(`/${store.slug}`, 'layout')
  return { status: 'saved', fieldErrors: {}, message: 'Módulo salvo.' }
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

export async function salvarItem(formData: FormData): Promise<ProductFormState> {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  try { await saveItem(parseItemForm(formData), product.id) } catch (error) { return productFormError(error) }
  revalidatePath(`/admin/produtos/${product.id}`)
  revalidatePath(`/${store.slug}`, 'layout')
  return { status: 'saved', fieldErrors: {}, message: 'Item salvo.' }
}

export async function excluirItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => deleteItem(field(formData, 'id'), product.id), 'Item excluído.')
  done(store.slug, product.id, 'conteudo', message)
}

export async function moverItem(formData: FormData) {
  const { store, product } = await requireOwnProduct(field(formData, 'product_id'))
  const message = await attempt(() => moveItem(field(formData, 'id'), field(formData, 'module_id'), product.id, direction(formData)), 'Ordem atualizada.')
  done(store.slug, product.id, 'conteudo', message)
}
