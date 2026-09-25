export function materialTitle(title: string | undefined, productTitle: string): string {
  const value = title?.trim() ?? ''
  return !value || /^clique\s+aqui(?:\s+para\b.*)?[.!]?$/i.test(value) || /^material\s+principal$/i.test(value)
    ? productTitle
    : value
}
