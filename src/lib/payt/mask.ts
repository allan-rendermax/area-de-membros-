const SECRET_KEYS = new Set(['integration_key'])

export function maskPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPayload)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, SECRET_KEYS.has(key) ? '••••' : maskPayload(v)]))
  }
  return value
}
