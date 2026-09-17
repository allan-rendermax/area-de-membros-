export function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Não foi possível salvar.'
}

export async function uploadIfPresent(
  value: FormDataEntryValue | null,
  current: string | null,
  upload: (file: File) => Promise<string>,
): Promise<string | null> {
  return value instanceof File && value.size > 0 ? upload(value) : current
}

export function withMessage(path: string, message: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}msg=${encodeURIComponent(message)}`
}
