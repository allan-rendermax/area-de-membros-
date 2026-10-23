import { randomUUID } from 'node:crypto'
import { validarOfertas } from './cadastro-identidade.mjs'

// In-memory synthetic backend for the existing localhost-only admin OTP fixture.
export function createCheckoutPlansFixture(store) {
  const productId = '00000000-0000-4000-8000-000000000101'
  const groupId = '00000000-0000-4000-8000-000000000201'
  const product = { id: productId, store_id: store.id, slug: 'kit-teste', title: 'Kit de teste', description: 'Produto fictício para QA', track: 'Teste', role: 'front', content_mode: 'versions', sort_order: 0, is_published: true, is_featured: false, cover_url: null, banner_url: null, checkout_url: null, upgrade_checkout_url: null }
  const group = { id: groupId, store_id: store.id, name: 'Oferta de teste por checkout', version: 1, offers: ['basic', 'complete'].map((level, index) => ({
    id: `00000000-0000-4000-8000-00000000030${index + 1}`, group_id: groupId, store_id: store.id,
    name: index ? 'Completo' : 'Básico', payt_product_code: 'QA-SHARED', match_type: 'checkout', checkout_code: index ? 'QA-FULL' : 'QA-BASIC', match_values: [`https://payt.site/QA${index ? 'Full' : 'Basic'}`],
    offer_products: [{ product_id: productId, grant_level: level }],
  })) }
  const groups = [group]
  const modules = ['basic', 'complete'].map((level, index) => ({ id: `module-${index}`, product_id: productId, title: index ? 'Material completo' : 'Material básico', required_level: level, sort_order: index, is_published: true,
    items: [{ id: `item-${index}`, module_id: `module-${index}`, title: 'Link fictício', kind: 'link', url: 'https://example.test/material', sort_order: 0, is_published: true, cover_url: null }],
  }))
  const orders = [{ id: '00000000-0000-4000-8000-000000000401', store_id: store.id, created_at: new Date().toISOString(), customer_email: 'aluno@example.test', payt_product_code: 'QA-SHARED', payt_product_name: 'Kit de teste', status: 'pago', source: 'payt', is_test: false, amount_cents: 100, offer_id: null, identification_warning: 'identificador_desconhecido', checkout_url: 'https://payt.site/QAUnknown', upsell_code: null, note: '', created_by: '' }]
  const events = [{ id: '00000000-0000-4000-8000-000000000501', received_at: new Date().toISOString(), processed_at: new Date().toISOString(), customer_email: 'aluno@example.test', product_codes: ['QA-SHARED'], payt_status: 'paid', key_valid: true, outcome: 'sem_mudanca', error: 'QA-SHARED: identificador_desconhecido', payload: { product: { code: 'QA-SHARED' }, link: { url: 'https://payt.site/QAUnknown' } } }]
  return (request, response, url, input, send) => {
    const path = url.pathname
    if (path === '/rest/v1/rpc/save_offer_group_atomic') {
      const current = groups.find(entry => entry.id === input.p_id)
      if (input.p_id && (!current || current.version !== input.p_version)) { send(response, 400, { code: 'P0001', message: 'Esta oferta foi alterada. Recarregue a página.' }); return true }
      try {
        validarOfertas(input.p_plans.map(plan => ({ codigo: plan.payt_product_code, matchType: plan.match_type, checkoutCode: plan.checkout_code, matchValues: plan.match_values })))
        for (const plan of input.p_plans) {
          const old = current?.offers.find(offer => offer.id === plan.id)
          if (old && (old.match_type !== plan.match_type || old.checkout_code !== plan.checkout_code || old.payt_product_code !== plan.payt_product_code || old.match_values.some(value => !plan.match_values.includes(value)))) throw new Error('Preserve a identidade e os aliases existentes.')
        }
      } catch (error) { send(response, 400, { code: 'P0001', message: error.message }); return true }
      const saved = { id: current?.id ?? randomUUID(), store_id: store.id, name: input.p_name, version: (current?.version ?? 0) + 1 }
      saved.offers = input.p_plans.map(plan => ({ ...plan, id: plan.id ?? randomUUID(), store_id: store.id, group_id: saved.id, offer_products: plan.grants }))
      if (current) groups.splice(groups.indexOf(current), 1, saved)
      else groups.push(saved)
      send(response, 200, saved.id); return true
    }
    const tables = { products: [product], modules, offer_groups: groups, offers: groups.flatMap(entry => entry.offers), orders, payt_events: events }
    const table = path.replace('/rest/v1/', '')
    if (!Object.hasOwn(tables, table)) return false
    if (request.method !== 'GET') { send(response, 405, { message: 'Fixture is read-only except save_offer_group_atomic' }); return true }
    let rows = tables[table]
    for (const [key, value] of url.searchParams) {
      if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3))
    }
    const object = request.headers.accept?.includes('application/vnd.pgrst.object+json')
    send(response, object && !rows.length ? 406 : 200, object ? rows[0] ?? { code: 'PGRST116', message: 'No rows' } : rows, { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` })
    return true
  }
}
