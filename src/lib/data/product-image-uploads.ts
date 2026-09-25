import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { PRODUCT_IMAGE_SLOTS, validateProductImage, type ProductImageSlot, type ProductImageTicket } from '@/lib/admin/product-image-upload'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'

type ImageContext = { storeId: string; productId: string | null; slot: ProductImageSlot }
type Receipt = ImageContext & { path: string; size: number; mime: string; expires: number }
const invalid = () => new Error('Envio de imagem inválido ou expirado. Envie a imagem novamente.')
const sign = (payload: string) => createHmac('sha256', env.supabaseSecretKey).update(`product-image:${payload}`).digest('base64url')
const prefix = ({ storeId, productId, slot }: ImageContext) => `product-drafts/${storeId}/${productId ?? 'new'}/${slot}-`
const publicUrl = (path: string) => `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/covers/${path}`

export async function createProductImageUpload(context: ImageContext, size: number, mime: string): Promise<ProductImageTicket> {
  const error = validateProductImage(size, mime)
  if (error) throw new Error(error)
  if (!PRODUCT_IMAGE_SLOTS.includes(context.slot)) throw invalid()
  const extension = mime === 'image/jpeg' ? 'jpg' : mime.slice(6)
  const path = `${prefix(context)}${randomUUID()}.${extension}`
  const { data, error: storageError } = await createAdminClient().storage.from('covers').createSignedUploadUrl(path, { upsert: false })
  if (storageError || !data?.token) throw new Error('Não foi possível preparar o envio da imagem. Tente novamente.')
  const payload = Buffer.from(JSON.stringify({ ...context, path, size, mime, expires: Date.now() + 24 * 60 * 60 * 1000 } satisfies Receipt)).toString('base64url')
  return { bucket: 'covers', path, token: data.token, publicUrl: publicUrl(path), receipt: `${payload}.${sign(payload)}`, supabaseUrl: env.supabaseUrl, publishableKey: env.supabasePublishableKey }
}

export async function validateProductImageReference(context: ImageContext, url: string, receipt: string): Promise<void> {
  let parsed: Receipt
  try {
    const [payload, signature, extra] = receipt.split('.')
    if (!payload || !signature || extra) throw invalid()
    const expected = Buffer.from(sign(payload)), supplied = Buffer.from(signature)
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw invalid()
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Receipt
    if (parsed.storeId !== context.storeId || parsed.productId !== context.productId || parsed.slot !== context.slot ||
      !Number.isFinite(parsed.expires) || parsed.expires < Date.now() || !parsed.path.startsWith(prefix(context)) || url !== publicUrl(parsed.path)) throw invalid()
  } catch { throw invalid() }
  const { data, error } = await createAdminClient().storage.from('covers').info(parsed.path)
  if (error || !data || data.size !== parsed.size || data.contentType !== parsed.mime || validateProductImage(data.size, data.contentType)) {
    throw new Error('A imagem ainda não terminou de enviar ou está inválida. Envie novamente antes de salvar.')
  }
}
