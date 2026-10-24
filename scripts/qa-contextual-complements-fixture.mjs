// Loopback-only synthetic HTTP fixture. Never connects to Supabase/Payt/Resend.
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve,sep } from 'node:path'
import { spawn } from 'node:child_process'
const backend='http://127.0.0.1:54329', app='http://127.0.0.1:3180', secret='contextual-local-fixture-only'
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const storeId=uid(1),customerId=uid(2),sessionId=uid(3)
const base=resolve('artifacts/complementos-contextuais-20261024/capas/finais')
let state={scenario:'one',level:'basic',relationsError:false}
const defs=[
 ['paisagismo','Atlas Visual de Paisagismo Tropical',backend+'/assets/paisagismo-principal.webp'],
 ['patologias','Atlas Visual das Patologias na Construção Civil','/themes/arquitetura/atlas.webp'],
 ['planta-certa','Guia da Planta Certa para Jardins Tropicais'],
 ['orcamento-jardins','Orçamento de Jardins na Prática'],
 ['mestres-paisagismo','Biblioteca Visual dos Mestres do Paisagismo'],
 ['gestao-obras','Kit Gestão de Obras'],
 ['orcamento-obras','Orçamento de Obras na Prática'],
 ['captacao-clientes','Kit Captação e Atendimento de Clientes'],
 ['outro-atlas','Atlas Visual de Projetos','/themes/arquitetura/atlas.webp'],
]
const products=defs.map(([slug,title,cover],i)=>({id:uid(100+i),store_id:storeId,slug,title,track:i<2?'Atlas Visuais':i<8?'Prática Profissional':'Atlas Visuais',
description:i<2?'Seu acervo visual para consultar, planejar e aplicar em seus projetos.':'Um material complementar para aprofundar sua prática.',
cover_url:cover||backend+'/assets/'+slug+'-2x3.webp',banner_url:null,checkout_url:backend+'/checkout',upgrade_checkout_url:backend+'/checkout',
purchase_image_url:i>=2&&i<8?backend+'/assets/'+slug+'-1x1.webp':null,student_checkout_url:null,role:i>=2&&i<8?'orderbump':'front',
content_mode:i<2?'versions':'sections',complementary_product_id:null,is_featured:i===0,is_published:true,sort_order:i,catalog_visibility:i>=2&&i<8?'contextual':'catalog',editorial_revision:0}))
const relations=[2,3,4,5,6,7].map((i)=>({store_id:storeId,parent_product_id:products[i<5?0:1].id,complement_product_id:products[i].id,sort_order:i%3}))
const modules=products.flatMap((p,i)=>['basic','complete'].map((level,j)=>({id:uid(300+i*2+j),product_id:p.id,title:level==='basic'?'Seu material':'Material completo',required_level:level,sort_order:j,is_published:true})))
const items=modules.map((m,i)=>({id:uid(500+i),module_id:m.id,title:i%2?'Caderno completo de consulta':'Guia de consulta',kind:'link',url:backend+'/material',cover_url:null,sort_order:0,is_published:true}))
const offers=products.map(p=>({id:uid(700+products.indexOf(p)),store_id:storeId,payt_product_code:'fixture-'+p.slug,match_type:'product',offer_products:[{product_id:p.id,grant_level:products.indexOf(p)<2?state.level:'complete'}]}))
function own(){return state.scenario==='all'?[0,1,2,3,4,5,6,7]:state.scenario==='solo'||state.scenario==='refund-parent'?[2]:state.scenario==='none'?[]:state.scenario==='zero'||state.scenario==='refund-complement'?[0,1]:[0,1,2,5]}
const user={id:customerId,email:'fixture@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}
function jwt(){const body=[{alg:'HS256',typ:'JWT'},{sub:customerId,email:user.email,aud:'authenticated',role:'authenticated',session_id:sessionId,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url')}
function cookie(name,value){return name+'='+value+'; Path=/; HttpOnly; SameSite=Lax'}
const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,backend),p=url.pathname
 const json=(body,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))}
 if(p==='/state'){state={...state,...Object.fromEntries(url.searchParams)};state.relationsError=state.relationsError===true||state.relationsError==='true';return json(state)}
 if(p==='/login'){
 const token=jwt(),session={access_token:token,refresh_token:'fixture-only',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}
 const value='base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),now=Date.now()
 const adminSig=createHmac('sha256',secret).update(JSON.stringify(['admin-browser-session:v1',now,customerId,sessionId])).digest('base64url')
 res.writeHead(302,{'set-cookie':[cookie('sb-127-auth-token',value),cookie('sb-127-admin-auth-token',value),cookie('admin-browser-session',now+'.'+adminSig)],location:app+(url.searchParams.get('next')||'/arquitetura')});return res.end()
 }
 if(p.startsWith('/assets/')){
 const file=resolve(base,decodeURIComponent(p.slice(8)));if(!file.startsWith(base+sep)){res.writeHead(403);return res.end()}
 res.writeHead(200,{'content-type':'image/webp'});return res.end(await readFile(file))
 }
 if(p.startsWith('/auth/v1/user'))return json(user)
 if(p==='/auth/v1/.well-known/jwks.json')return json({keys:[]})
 if(p==='/material'||p==='/checkout'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end('<h1>Homologação local</h1><p>Material e checkout simulados. Nenhuma compra é feita.</p>')}
 if(!p.startsWith('/rest/v1/'))return json({error:'not found'},404)
 const table=p.slice(9),single=(req.headers.accept||'').includes('vnd.pgrst.object')
 if(req.method!=='GET'&&req.method!=='HEAD'){if(table==='item_access')return json([]);return json({message:'Fixture is read-only'},405)}
 if(table==='product_complements'&&state.relationsError)return json({message:'synthetic failure'},503)
 let rows={
 stores:[{id:storeId,slug:'arquitetura',name:'Arquitetura',logo_url:null,support_url:backend+'/material',support_whatsapp:null,member_library_mode:'grouped'}],
 customers:[{...user,name:'Cliente de teste',blocked_at:state.scenario==='blocked'?new Date().toISOString():null}],
 member_terms_acceptance:[{customer_id:customerId,store_id:storeId,accepted_at:new Date().toISOString()}],
 products:products.map(p=>({...p,is_published:state.scenario==='draft-parent'&&p.id===products[0].id?false:true})),
 product_complements:state.scenario==='removed'?relations.filter(r=>r.complement_product_id!==products[2].id):relations,
 offers:offers.map(o=>({...o,offer_products:o.offer_products.map(l=>({...l,grant_level:products.findIndex(p=>p.id===l.product_id)<2?state.level:'complete'}))})),
 orders:own().map(i=>({customer_email:user.email,payt_product_code:offers[i].payt_product_code,offer_id:offers[i].id,status:'pago'})),
 modules:modules.map(m=>({...m,items:items.filter(i=>i.module_id===m.id)})),
 items:items.map(i=>{const m=modules.find(m=>m.id===i.module_id);return {...i,modules:{...m,products:products.find(p=>p.id===m.product_id)}}}),
 item_access:[], member_progress:[],
 }[table]
 if(!rows)return json({message:'Unknown fixture table '+table},400)
 for(const [key,value] of url.searchParams){if(key==='select'||key==='order'||key.includes('.')||key==='limit'||key==='offset')continue;if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));if(value.startsWith('in.(')){const values=value.slice(4,-1).split(',');rows=rows.filter(r=>values.includes(String(r[key])))}}
 return json(single?(rows[0]??null):rows)
 }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({message:String(error.message)}))}
})
server.listen(54329,'127.0.0.1',()=>console.log('Synthetic backend ready '+backend+'/login'))
if(process.argv.includes('--app')){
 const env={...process.env,SUPABASE_URL:backend,NEXT_PUBLIC_SUPABASE_URL:backend,SUPABASE_PUBLISHABLE_KEY:'fixture-only',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only',SUPABASE_SECRET_KEY:'fixture-only',PAYT_INTEGRATION_KEY:'fixture-only',RESEND_API_KEY:'fixture-only',EMAIL_FROM:'Fixture <fixture@example.test>',APP_URL:app,ADMIN_EMAILS:user.email,DEFAULT_STORE_SLUG:'arquitetura',LOGIN_GUARD_SECRET:secret,TURNSTILE_SITE_KEY:'',TURNSTILE_SECRET_KEY:''}
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3180'],{stdio:'inherit',env})
 process.on('SIGINT',()=>{child.kill();server.close()});process.on('SIGTERM',()=>{child.kill();server.close()})
}

