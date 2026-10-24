import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,channel:'chrome'})
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',hasTouch:true})
const output='artifacts/complementos-contextuais-20261024/qa';await mkdir(output,{recursive:true})
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message))
const app='http://127.0.0.1:3180',fixture='http://127.0.0.1:54329'
const state=async(scenario,extra={})=>{await fetch(fixture+'/state?'+new URLSearchParams({scenario,level:'basic',relationsError:'false',...extra}))}
const go=async path=>{await page.goto(app+path,{waitUntil:'networkidle'})}
const has=async text=>assert.ok((await page.locator('body').innerText()).includes(text),text)
async function capture(name){
 await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})))})
 await page.screenshot({path:output+'/'+name+'.png',fullPage:true})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow')
}
try{
 await state('one');await page.goto(fixture+'/login',{waitUntil:'networkidle'});await has('Meus materiais');await has('Explore outros produtos')
 assert.equal(await page.getByRole('button',{name:/Conhecer.*Jardins/}).count(),0)
 await page.locator('summary').filter({hasText:'1 complemento adquirido'}).first().click()
 await has('Guia da Planta Certa para Jardins Tropicais');await capture('home-desktop');checks.push('Home grouped, acquired expansion, discovery preserved')
 await go('/arquitetura/produto/paisagismo');await has('Seus complementos');await has('Complemente seu material');await capture('paisagismo-desktop')
 const trigger=page.getByRole('button',{name:'Conhecer Orçamento de Jardins na Prática'});await trigger.click()
 const dialog=page.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.locator('img').getAttribute('src'),/1x1.webp/)
 const bounds=await dialog.locator('img').boundingBox();assert.ok(Math.abs(bounds.width-bounds.height)<2)
 await capture('oferta-desktop');await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.ok(await trigger.evaluate(el=>el===document.activeElement));checks.push('Square offer, Escape and focus restoration')
 await page.setViewportSize({width:390,height:844});await capture('paisagismo-mobile');await trigger.tap();await capture('oferta-mobile');await page.keyboard.press('Escape')
 await page.setViewportSize({width:320,height:800});await capture('paisagismo-320')
 await go('/arquitetura/item/00000000-0000-4000-8000-000000000500');await has('Complemente seu material');checks.push('First/direct item composition; mobile 390/320 without overflow')
 await state('all',{level:'complete'});await go('/arquitetura/produto/paisagismo');await has('Versão Completo');assert.equal(await page.getByRole('heading',{name:'Complemente seu material'}).count(),0);await capture('todos-completo');checks.push('All purchased removes offers; complete content')
 for(const scenario of ['solo','refund-parent','removed','draft-parent']){
 await state(scenario);await go('/arquitetura');await has('Guia da Planta Certa para Jardins Tropicais');await go('/arquitetura/produto/planta-certa');await has('Acesso liberado');assert.equal(await page.getByRole('heading',{name:'Complemente seu material'}).count(),0)
 }checks.push('Standalone, refunded/unpublished parent and removed relation retain access');await capture('avulso-mobile')
 await state('one',{relationsError:'true'});await go('/arquitetura');await has('Guia da Planta Certa para Jardins Tropicais');await go('/arquitetura/produto/paisagismo');assert.equal(await page.getByRole('heading',{name:'Complemente seu material'}).count(),0);checks.push('Relation failure preserves purchases without offers')
 await state('zero');await go('/arquitetura?comprar=orcamento-jardins');assert.match(page.url(),/produto\/paisagismo\?complemento=orcamento-jardins/);assert.equal(await page.getByRole('dialog').count(),1);checks.push('Old purchase URL resolves inside owned parent');await page.keyboard.press('Escape')
 await state('none');await go('/arquitetura?comprar=orcamento-jardins');assert.equal(await page.getByRole('dialog').count(),0);await capture('sem-compra')
 await go('/arquitetura/item/00000000-0000-4000-8000-000000000500');assert.match(page.url(),/arquitetura\?comprar=paisagismo/);checks.push('No purchase cannot open item; query alone does not grant')
 await state('blocked');await go('/arquitetura');assert.match(page.url(),/entrar/);checks.push('Blocked customer denied')
 await state('one');await page.setViewportSize({width:1440,height:1000});await go('/arquitetura?previa=1&simular=basic&complementos=one')
 assert.equal(await page.getByLabel('Simular compra de complementos').inputValue(),'one')
 await page.getByRole('link',{name:'Meus materiais',exact:true}).first().click();assert.match(page.url(),/complementos=one/)
 for(const scenario of ['one','all','solo']){
   await go('/arquitetura/item/00000000-0000-4000-8000-000000000506?previa=1&simular=complete&complementos='+scenario)
   await page.getByRole('link',{name:'Próximo conteúdo',exact:true}).click();await page.waitForURL('**/item/*507?**')
   assert.match(page.url(),/item\/00000000-0000-4000-8000-000000000507\?/)
   assert.equal(new URL(page.url()).searchParams.get('complementos'),scenario)
   await page.getByRole('link',{name:'Conteúdo anterior',exact:true}).click();await page.waitForURL('**/item/*506?**')
   assert.equal(new URL(page.url()).searchParams.get('complementos'),scenario)
   await page.locator('details.lesson-module').filter({hasText:'Caderno completo de consulta'}).locator('summary').click()
   await page.locator('.lesson-sidebar-link').filter({hasText:'Caderno completo de consulta'}).click();await page.waitForURL('**/item/*507?**')
   assert.match(page.url(),/item\/00000000-0000-4000-8000-000000000507\?/)
   assert.equal(new URL(page.url()).searchParams.get('complementos'),scenario)
 }
 checks.push('Preview one/all/solo survives next, previous and sidebar item transitions')
 await go('/admin/produtos/00000000-0000-4000-8000-000000000100');await capture('admin-contextual');checks.push('Admin preview scenario preserved; admin editor rendered')
 await state('one');await go('/arquitetura/produto/patologias');await has('Complemente seu material');await capture('patologias-desktop');await go('/arquitetura/produto/paisagismo')
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));await writeFile(output+'/browser.json',JSON.stringify({checks,errors},null,2))
}finally{await browser.close()}

