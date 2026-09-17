import { redirect } from 'next/navigation'
import { env } from '@/lib/env'

export default async function EntrarLegado({ searchParams }: PageProps<'/entrar'>) {
  const { email } = await searchParams
  const query = typeof email === 'string' && email ? `?email=${encodeURIComponent(email)}` : ''
  redirect(`/${env.defaultStoreSlug}/entrar${query}`)
}
