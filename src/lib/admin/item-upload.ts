export type ItemUploadTicket = {
  bucket?: string
  path: string
  token: string
  publicUrl: string
  supabaseUrl: string
  publishableKey: string
}

const MAX_ITEM_UPLOAD_BYTES = 50 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'])

export function itemUploadFilename(name: string): string {
  const basename = name.split(/[\\/]/).pop() ?? ''
  const dot = basename.lastIndexOf('.')
  const stem = basename.slice(0, dot).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'arquivo'
  const extension = basename.slice(dot + 1)
  return `${stem}.${extension}`
}

export function validateItemUpload(name: unknown, size: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'Informe o nome do arquivo.'
  const basename = name.split(/[\\/]/).pop() ?? ''
  const dot = basename.lastIndexOf('.')
  const extension = basename.slice(dot + 1).toLowerCase()
  if (dot <= 0 || !basename.slice(0, dot).trim() || !ALLOWED_EXTENSIONS.has(extension)) {
    return 'Selecione um arquivo PDF, ZIP, DOC, DOCX, XLS, XLSX, PNG, JPG ou JPEG.'
  }
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1 || size > MAX_ITEM_UPLOAD_BYTES) {
    return 'O arquivo deve ter tamanho maior que zero e até 50 MB.'
  }
  return null
}
