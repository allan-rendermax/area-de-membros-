export async function verifyTurnstile(token: string, ip: string, secret: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== 'desconhecido') body.set('remoteip', ip)
    const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    if (!response.ok) return false
    const data = (await response.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
