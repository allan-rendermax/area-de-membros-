// Local-only coupon/support QA, using the real application against fictional data.
import { createFixture, id } from './qa-members-browser-fixture.mjs'

const port = Number(process.env.QA_PROVIDER_PORT || 3332)
const { server, tables } = createFixture(port)
const checkout = `http://127.0.0.1:${port}/reference?coupon=ALUNO10&utm_source=members#payment`
tables.products.forEach((product) => { product.student_checkout_url = null })
tables.products[2].student_checkout_url = checkout
tables.products.push(
  { ...tables.products[2], id: id(13), slug: 'oferta-sem-link', title: 'Oferta sem checkout', student_checkout_url: null, sort_order: 3 },
  { ...tables.products[2], id: id(14), slug: 'oferta-normal', title: 'Oferta com checkout normal', student_checkout_url: null, checkout_url: `http://127.0.0.1:${port}/reference?regular=1`, sort_order: 4 },
)
const handle = server.listeners('request')[0]
server.removeAllListeners('request')
server.on('request', (request, response) => {
  if (request.method === 'POST' && request.url === '/__qa/whatsapp') {
    // Synthetic number is for local link inspection only. Never send a message.
    tables.stores[0].support_whatsapp = tables.stores[0].support_whatsapp ? null : '5511999999999'
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ configured: Boolean(tables.stores[0].support_whatsapp) }))
    return
  }
  handle(request, response)
})
server.listen(port, '127.0.0.1', () => console.log(`Coupon/support fixture at http://127.0.0.1:${port}`))
