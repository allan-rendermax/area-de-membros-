import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveResourceDestination } from '@/lib/data/resource-download'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

const supabaseUrl = 'https://project.supabase.co'
const file = { kind: 'arquivo' as const, url: `${supabaseUrl}/storage/v1/object/authenticated/arquivos-restritos/pasta/modelo.pdf` }
const createSignedUrl = vi.fn()

describe('resolver destino privado autorizado', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    createSignedUrl.mockResolvedValue({ data: { signedUrl: `${supabaseUrl}/storage/v1/object/sign/arquivos-restritos/pasta/modelo.pdf?token=abc` }, error: null })
    vi.mocked(createAdminClient).mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } } as unknown as ReturnType<typeof createAdminClient>)
  })

  it('assina caminho canônico por 60 segundos para download', async () => {
    expect(await resolveResourceDestination(file, supabaseUrl)).toContain('token=abc')
    expect(createSignedUrl).toHaveBeenCalledWith('pasta/modelo.pdf', 60, { download: true })
  })

  it('falha fechado quando assinatura falha', async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: new Error('unavailable') })
    expect(await resolveResourceDestination(file, supabaseUrl)).toBeNull()
  })

  it('não assina referência privada decorada ou forjada', async () => {
    expect(await resolveResourceDestination({ ...file, url: `${file.url}?token=old` }, supabaseUrl)).toBeNull()
    expect(await resolveResourceDestination({ ...file, url: `${file.url}#fragment` }, supabaseUrl)).toBeNull()
    expect(await resolveResourceDestination({ ...file, url: 'https://project.supabase.co.evil.test/storage/v1/object/authenticated/arquivos-restritos/pasta/modelo.pdf' }, supabaseUrl)).toBe('https://project.supabase.co.evil.test/storage/v1/object/authenticated/arquivos-restritos/pasta/modelo.pdf')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
