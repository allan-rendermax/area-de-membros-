import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import WelcomePage from '@/app/[loja]/boas-vindas/page'
import { requireStoreIdentity } from '@/lib/membros/session'
import { requireStorePreview } from '@/lib/membros/preview'
import { hasAcceptedMemberTerms } from '@/lib/data/member-terms'

vi.mock('@/lib/membros/session', () => ({ requireStoreIdentity: vi.fn() }))
vi.mock('@/lib/membros/preview', () => ({ requireStorePreview: vi.fn() }))
vi.mock('@/app/[loja]/boas-vindas/actions', () => ({ acceptTerms: vi.fn() }))
vi.mock('@/lib/data/member-terms', () => ({ hasAcceptedMemberTerms: vi.fn(), requiresMemberTerms: (slug: string) => slug === 'arquitetura' }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
const session = { store: { id: 'store-id', slug: 'arquitetura' }, customer: { id: 'student-id' } }
const props = { params: Promise.resolve({ loja: 'arquitetura' }), searchParams: Promise.resolve({}) }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireStoreIdentity).mockResolvedValue(session as never)
  vi.mocked(requireStorePreview).mockResolvedValue({ store: session.store, customer: null } as never)
  vi.mocked(hasAcceptedMemberTerms).mockResolvedValue(false)
})
it('exibe somente boas-vindas antes dos materiais, sem o aviso removido', async () => {
  const html = renderToStaticMarkup(await WelcomePage(props))
  expect(html).toContain('role="dialog"')
  expect(html).toContain('Aceito os termos')
  expect(html).toContain('Termos de uso')
  expect(html).not.toContain('Uma única vez')
  expect(html).not.toContain('Materiais disponíveis')
  expect(html).not.toContain('PILOTO')
})
it('redireciona quem já aceitou mesmo por acesso direto à página', async () => {
  vi.mocked(hasAcceptedMemberTerms).mockResolvedValue(true)
  await expect(WelcomePage(props)).rejects.toThrow('REDIRECT:/arquitetura')
})
it('prévia exige administrador e nunca consulta ou grava aceite de aluno', async () => {
  const html = renderToStaticMarkup(await WelcomePage({ ...props, searchParams: Promise.resolve({ previa: '1' }) }))
  expect(requireStorePreview).toHaveBeenCalledWith('arquitetura')
  expect(requireStoreIdentity).not.toHaveBeenCalled()
  expect(hasAcceptedMemberTerms).not.toHaveBeenCalled()
  expect(html).toContain('nenhum aceite é registrado')
  expect(html).not.toContain('type="submit"')
  vi.mocked(requireStorePreview).mockRejectedValueOnce(new Error('ADMIN_REQUIRED'))
  await expect(WelcomePage({ ...props, searchParams: Promise.resolve({ previa: '1' }) })).rejects.toThrow('ADMIN_REQUIRED')
})
