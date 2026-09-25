export type ProductFormState = {
  status: 'idle' | 'error' | 'saved'
  fieldErrors: Record<string, string>
  message: string | null
}
export const initialProductFormState: ProductFormState = { status: 'idle', fieldErrors: {}, message: null }

export function productFormError(error: unknown): ProductFormState {
  const message = error instanceof Error && error.message ? error.message : 'Não foi possível salvar. Confira sua conexão e tente novamente.'
  const explicit = error instanceof Error && 'field' in error && typeof error.field === 'string' ? error.field : null
  const field = explicit ?? (/endere[çc]o|slug/i.test(message) ? 'slug' : /título do produto/i.test(message) ? 'title' : null)
  return { status: 'error', fieldErrors: field ? { [field]: message } : {}, message }
}
