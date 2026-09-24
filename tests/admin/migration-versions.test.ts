import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('reserva uma versão única para cada migration', () => {
  const directory = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))
  const files = readdirSync(directory).filter((name) => /^\d{14}_.+\.sql$/.test(name))
  const versions = files.map((name) => name.slice(0, 14))
  expect(new Set(versions).size).toBe(versions.length)
})
