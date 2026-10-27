// Run with the synthetic contextual fixture already listening on loopback.
// AGENT_BROWSER_BIN points to the Vercel agent-browser executable (0.38.1).
// Start its named session once from a shell before this runner on Windows.
import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const executable = process.env.AGENT_BROWSER_BIN
if (!executable) throw new Error('Set AGENT_BROWSER_BIN to the installed Vercel agent-browser executable.')
const session = 'compra-ui-final-20261026'
const output = resolve('docs/qa/acesso-compra-20261026')
await mkdir(output, { recursive: true })
const report = []
function browser(...args) {
  const result = spawnSync(executable, ['--session', session, '--json', ...args], { encoding: 'utf8', timeout: 40000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  const parsed = JSON.parse(result.stdout)
  if (!parsed.success) throw new Error(parsed.error)
  return parsed.data
}
const evaluate = js => browser('eval', '-b', Buffer.from(js).toString('base64')).result
const navSelector = 'nav[aria-label="Materiais adquiridos nesta compra"]'
async function scenario(name, level = 'complete') {
  const response = await fetch(`http://127.0.0.1:54329/state?scenario=${name}&level=${level}&relationsError=false`)
  assert.equal(response.status, 200)
}
function open(path, expectedLinks = 2) {
  browser('open', 'http://127.0.0.1:3180' + path)
  browser('wait', '--load', 'load')
  const expectedTitle = path === '/arquitetura' ? 'menos tempo' : path.includes('paisagismo') ? 'atlas visual' : 'guia da planta'
  browser('wait', '--fn', `document.querySelector('main h1')?.textContent.toLowerCase().includes('${expectedTitle}') && document.fonts.status === 'loaded' && Array.from(document.querySelectorAll('${navSelector} a')).filter(a=>a.getClientRects().length).length === ${expectedLinks}`)
  browser('snapshot', '-i')
}
function inspect() {
  return evaluate(`({title:document.querySelector('h1')?.textContent, nav:Array.from(document.querySelectorAll('${navSelector} a')).filter(a=>a.getClientRects().length).map(a=>({title:a.textContent,href:a.getAttribute('href'),current:a.getAttribute('aria-current')})), overflow:document.documentElement.scrollWidth>innerWidth+1, pdf:/\\bPDFs?\\b/i.test(document.querySelector('main').innerText), back:Array.from(document.querySelectorAll('main a')).filter(a=>a.textContent.includes('Voltar')).map(a=>({title:a.textContent,href:a.getAttribute('href')}))})`)
}
function check(name, fn) {
  const value = fn()
  report.push({ name, passed: true, value })
  console.log('PASS ' + name)
  return value
}
function capture(name) { browser('screenshot', resolve(output, name + '.png'), '--full') }
try {
  await scenario('one')
  browser('open', 'http://127.0.0.1:54329/login')
  browser('set', 'viewport', '1440', '1000')

  open('/arquitetura/produto/paisagismo')
  check('principal + acquired guide only', () => {
    const v = inspect(); assert.equal(v.nav.length, 2); assert(v.nav[0].title.includes('Paisagismo')); assert(v.nav[1].title.includes('Planta Certa')); assert.equal(v.nav[0].current, 'page'); assert(!v.pdf && !v.overflow); return v
  })
  browser('wait', '--fn', 'Array.from(document.images).every(i=>i.complete)')
  capture('atlas-desktop')
  const guide = inspect().nav.find(p => p.title.includes('Planta Certa'))
  const references = browser('snapshot', '-i').refs
  const guideRef = Object.entries(references).find(([,ref]) => ref.role === 'link' && ref.name.startsWith('Complemento Guia da Planta Certa'))?.[0]
  assert(guideRef, 'Expected a visible acquired-guide link')
  browser('click', '@' + guideRef)
  browser('wait', '--url', '**/produto/planta-certa')
  browser('wait', '--fn', `document.querySelector('h1')?.textContent.includes('Guia da Planta Certa') && Array.from(document.querySelectorAll('${navSelector} a')).some(a=>a.getAttribute('href')==='${guide.href}' && a.getAttribute('aria-current')==='page')`)
  browser('snapshot', '-i')
  check('guide active and named return', () => { const v = inspect(); assert.equal(v.nav.find(p=>p.current==='page')?.href,guide.href); assert(v.back.some(p=>p.title.includes('Atlas Visual de Paisagismo Tropical'))); assert(!v.pdf); return v })
  capture('guia-desktop')
  for (const width of [390, 320]) {
    browser('set', 'viewport', String(width), '844')
    check('mobile '+width, () => {
      const v = inspect(); assert(!v.overflow); assert.equal(v.nav.length,2)
      const order = evaluate(`({title:document.querySelector('h1').getBoundingClientRect().top,nav:Array.from(document.querySelectorAll('${navSelector}')).find(e=>e.getClientRects().length).getBoundingClientRect().top})`)
      assert(order.title < order.nav); return {...v, order}
    })
    capture('guia-mobile-'+width)
  }
  browser('set', 'viewport', '1440', '1000')
  const backRefs = browser('snapshot', '-i').refs
  const backRef = Object.entries(backRefs).find(([,ref]) => ref.role === 'link' && ref.name === 'Voltar para Atlas Visual de Paisagismo Tropical')?.[0]
  assert(backRef)
  browser('click', '@' + backRef)
  browser('wait', '--fn', `document.querySelector('h1')?.textContent.toLowerCase().includes('atlas visual') && location.pathname.endsWith('/produto/paisagismo')`)
  check('named return opens principal', () => { const v=inspect(); assert.equal(v.nav.find(p=>p.current==='page')?.href,'/arquitetura/produto/paisagismo'); return v })
  const materialRefs = browser('snapshot', '-i').refs
  const materialRef = Object.entries(materialRefs).find(([,ref]) => ref.role === 'link' && ref.name.startsWith('Acesse seu conteúdo:'))?.[0]
  assert(materialRef)
  const appTab = browser('tab','list').tabs.find(t=>t.active).tabId
  browser('click', '@' + materialRef)
  browser('wait', '--fn', `document.querySelector('h1')?.textContent === 'Homologação local'`)
  check('material opens simulated destination in separate tab', () => { const url=browser('get','url').url; assert.equal(url,'http://127.0.0.1:54329/material'); return {url,snapshot:browser('snapshot').snapshot} })
  browser('tab',appTab)
  open('/arquitetura/item/00000000-0000-4000-8000-000000000504')
  check('direct guide route', () => { const v=inspect(); assert.equal(v.nav.length,2); assert(v.title.includes('Guia')); return v })
  for (const name of ['zero','refund-complement']) {
    await scenario(name); open('/arquitetura/produto/paisagismo', 0)
    check(name, () => { const v=inspect(); assert.equal(v.nav.length,0); return v })
  }
  for (const name of ['solo','refund-parent','draft-parent','removed']) {
    await scenario(name); open('/arquitetura/produto/planta-certa', 0)
    check(name+' preserves guide standalone', () => { const v=inspect(); assert.equal(v.nav.length,0); assert(v.title.includes('Guia')); assert(!v.back.some(p=>p.href.includes('/produto/paisagismo'))); return v })
  }
  await scenario('all'); browser('set','viewport','320','844'); open('/arquitetura/produto/planta-certa', 4)
  check('multiple complements at 320', () => { const v=inspect(); assert.equal(v.nav.length,4); assert(!v.overflow); return v })
  capture('varios-complementos-320')
  await scenario('one'); open('/arquitetura/produto/planta-certa?previa=1&simular=complete&complementos=all', 4)
  check('preview preserves simulation parameters', () => { const v=inspect(); assert.equal(v.nav.length,4); for(const p of v.nav){assert(p.href.includes('simular=complete'));assert(p.href.includes('complementos=all'))} return v })
  open('/arquitetura/produto/paisagismo?previa=1&simular=complete&complementos=one')
  check('preview one chooses configured first complement', () => { const v=inspect(); assert.equal(v.nav.length,2); assert(v.nav[1].title.includes('Orçamento')); assert(v.nav.every(p=>p.href.includes('complementos=one'))); return v })
  await scenario('one','basic'); browser('set','viewport','1440','1000'); open('/arquitetura', 0)
  browser('wait','--fn','Array.from(document.images).every(i=>i.complete)')
  const home = evaluate(`({text:document.querySelector('main').innerText,links:Array.from(document.querySelectorAll('main a')).map(a=>({text:a.textContent,href:a.getAttribute('href')})),boxes:Array.from(document.querySelectorAll('main h1,main h2,main section')).map(e=>({text:e.getAttribute('aria-label')||e.textContent?.slice(0,100),rect:[e.getBoundingClientRect().x,e.getBoundingClientRect().y,e.getBoundingClientRect().width,e.getBoundingClientRect().height],font:getComputedStyle(e).fontFamily}))})`)
  let baseline = await readFile(resolve(output,'home-before.json'),'utf8')
  while(typeof baseline === 'string') baseline=JSON.parse(baseline)
  check('homepage identical text links geometry fonts', () => { assert.deepEqual(home, baseline); return {sections:home.boxes.length,links:home.links.length} })
  await writeFile(resolve(output,'home-after.json'),JSON.stringify(home,null,2))
  capture('home-after')
  check('JavaScript errors', () => { const errors=browser('errors').errors; assert.deepEqual(errors,[]); return errors })
  await scenario('one'); open('/arquitetura/produto/paisagismo')
} catch (error) {
  report.push({ name: 'runner failure', passed: false, error: String(error) })
  throw error
} finally {
  await writeFile(resolve(output,'browser-validation.json'),JSON.stringify(report,null,2))
}
