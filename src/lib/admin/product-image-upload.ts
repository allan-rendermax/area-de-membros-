export const PRODUCT_IMAGE_SLOTS = ['cover', 'banner', 'purchase', 'upgrade'] as const
export type ProductImageSlot = typeof PRODUCT_IMAGE_SLOTS[number]
export type ProductImageTicket = {
  bucket: 'covers'; path: string; token: string; publicUrl: string; receipt: string
  supabaseUrl: string; publishableKey: string
}
export const IMAGE_FIELDS = { cover: 'cover_url', banner: 'banner_url', purchase: 'purchase_image_url', upgrade: 'upgrade_image_url' } as const
export function validateProductImage(size: number, mime: string): string | null {
  if (!Number.isInteger(size) || size <= 0 || size > 2 * 1024 * 1024) return 'Envie uma imagem de até 2 MB.'
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(mime)) return 'Use uma imagem JPG, PNG, WebP, AVIF ou GIF.'
  return null
}
