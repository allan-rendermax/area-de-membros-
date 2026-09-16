import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return <main className="p-6">Logado como {data.user?.email}</main>
}
