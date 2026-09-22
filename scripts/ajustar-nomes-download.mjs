// Deixa o nome do arquivo baixado igual ao título do item (o cliente recebe "Bônus 1 — Checklist....pdf").
// Uso: node scripts/ajustar-nomes-download.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

const { data: itens, error } = await db.from('items').select('id, title, url, kind').eq('kind', 'arquivo')
if (error) throw error

for (const item of itens) {
  const [base] = item.url.split('?')
  const ext = base.split('.').pop().toLowerCase()
  const nome = `${item.title.replace(/[\\/:*?"<>|]/g, '-')}.${ext}`
  const novaUrl = `${base}?download=${encodeURIComponent(nome)}`
  if (novaUrl === item.url) continue
  const { error: erroUpdate } = await db.from('items').update({ url: novaUrl }).eq('id', item.id)
  if (erroUpdate) throw erroUpdate
  console.log(`${item.title} -> ${nome}`)
}
console.log('pronto.')
