// @vitest-environment happy-dom
import { act, createElement, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordItemVisit } from '@/components/membros/record-item-visit'
import { recordVisit } from '@/app/[loja]/historico/actions'

vi.mock('@/app/[loja]/historico/actions', () => ({ recordVisit: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
const props = { storeSlug: 'loja-a', itemId: 'item-a' }
async function render(itemId = props.itemId) {
  await act(async () => root.render(createElement(StrictMode, null, createElement(RecordItemVisit, { ...props, itemId }))))
}

describe('visita de vídeo montada no navegador', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(recordVisit).mockResolvedValue({ ok: true })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove() })

  it('não registra renderização no servidor ou prefetch', () => {
    expect(renderToStaticMarkup(createElement(RecordItemVisit, props))).toBe('')
    expect(recordVisit).not.toHaveBeenCalled()
  })
  it('registra uma vez na montagem e não duplica por StrictMode ou refresh de progresso', async () => {
    await render()
    await render()
    expect(recordVisit).toHaveBeenCalledExactlyOnceWith('loja-a', 'item-a')
    expect(container.innerHTML).toBe('')
  })
  it('registra nova navegação para outro material e retorno', async () => {
    await render()
    await render('item-b')
    await render()
    expect(vi.mocked(recordVisit).mock.calls).toEqual([['loja-a', 'item-a'], ['loja-a', 'item-b'], ['loja-a', 'item-a']])
  })
  it('registra uma nova visita quando o aluno sai e volta à página', async () => {
    await render()
    await act(async () => root.render(null))
    await render()
    expect(recordVisit).toHaveBeenCalledTimes(2)
  })
  it('captura falha da chamada sem rejeição não tratada nem repetição por render', async () => {
    vi.mocked(recordVisit).mockRejectedValue(new Error('connection unavailable'))
    await render()
    await render()
    expect(recordVisit).toHaveBeenCalledOnce()
  })
})
