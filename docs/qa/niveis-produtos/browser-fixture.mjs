import http from 'node:http'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const imageUrl = name => `/themes/arquitetura/${name}.webp`
const store = (n, slug, name) => ({ id:uuid(n),slug,name,logo_url:null,support_url:null,support_whatsapp:null,login_image_url:null })
const stores = [store(1,'arquitetura','Arquitetura QA'),store(2,'outra','Outra loja QA'),store(3,'admin-loja','Admin Loja QA')]
stores[0].support_url='http://127.0.0.1:54341/reference?support=1'
stores[0].support_whatsapp='5511999999999' // Synthetic number: inspect the link only; never send a message.
const product = (n, storeId, slug, title, role='front', sortOrder=n, published=true) => ({ id:uuid(n),store_id:uuid(storeId),slug,title,role,track:'Materiais',description:'Material fictício para teste local de níveis.',cover_url:null,banner_url:null,checkout_url:'http://127.0.0.1:54341/reference?checkout=regular',student_checkout_url:null,upgrade_checkout_url:'http://127.0.0.1:54341/reference?checkout=upgrade',is_featured:n===10,sort_order:sortOrder,is_published:published })
const products = [
  product(10,1,'atlas','Atlas de Níveis QA','front',10),
  {...product(11,1,'oferta-aluno','Oferta com Cupom QA','front',11),student_checkout_url:'http://127.0.0.1:54341/reference?coupon=ALUNO10&utm_source=members#payment'},
  product(12,2,'exclusivo','Exclusivo outra loja','front',12),
  product(14,3,'curso','Curso Admin Loja','front',14),
]
const modules = [
  {id:uuid(30),product_id:uuid(10),title:'Material básico',required_level:'basic',sort_order:0,is_published:true},
  {id:uuid(31),product_id:uuid(10),title:'Extras do Completo',required_level:'complete',sort_order:1,is_published:true},
  {id:uuid(32),product_id:uuid(12),title:'Outra loja',required_level:'basic',sort_order:0,is_published:true},
  {id:uuid(34),product_id:uuid(14),title:'Admin',required_level:'basic',sort_order:0,is_published:true},
]
const item = (n, module, kind, title, url, published=true) => ({id:uuid(n),module_id:uuid(module),kind,title,url,is_published:published,sort_order:n,cover_url:null})
const items = [
  item(50,30,'arquivo','Guia básico','http://127.0.0.1:54341/storage/v1/object/authenticated/arquivos-restritos/qa/guia.pdf'),
  item(51,31,'arquivo','Modelo completo','http://127.0.0.1:54341/storage/v1/object/authenticated/arquivos-restritos/qa/modelo.pdf'),
  item(52,32,'arquivo','Arquivo outra loja','http://127.0.0.1:54341/storage/v1/object/authenticated/arquivos-restritos/qa/secret.pdf'),
]
const customers = [
  {id:uuid(100),email:'basico@example.test',name:'Aluno Básico',blocked_at:null},
  {id:uuid(101),email:'completo@example.test',name:'Aluno Completo',blocked_at:null},
  {id:uuid(102),email:'upgrade@example.test',name:'Aluno Upgrade',blocked_at:null},
  {id:uuid(103),email:'reembolso@example.test',name:'Aluno Reembolso',blocked_at:null},
  {id:uuid(104),email:'bloqueado@example.test',name:'Aluno Bloqueado',blocked_at:new Date().toISOString()},
]
const admin = {id:uuid(199),email:'admin@example.test'}
const offer_products = [
  {id:uuid(80),offer_id:uuid(70),product_id:uuid(10),grant_level:'basic'},
  {id:uuid(81),offer_id:uuid(71),product_id:uuid(10),grant_level:'complete'},
  {id:uuid(82),offer_id:uuid(72),product_id:uuid(10),grant_level:'complete'},
  {id:uuid(83),offer_id:uuid(73),product_id:uuid(14),grant_level:'complete'},
]
const offers = [
  {id:uuid(70),store_id:uuid(1),name:'Atlas Básico QA',payt_product_code:'BASIC-QA'},
  {id:uuid(71),store_id:uuid(1),name:'Atlas Completo QA',payt_product_code:'COMPLETE-QA'},
  {id:uuid(72),store_id:uuid(1),name:'Upgrade QA',payt_product_code:'UPGRADE-QA'},
  {id:uuid(73),store_id:uuid(3),name:'Admin Loja QA',payt_product_code:'ADMIN-QA'},
]
const order = (n,email,code,status,transaction) => ({id:uuid(n),store_id:uuid(1),customer_email:email,customer_name:'Aluno QA',payt_product_code:code,payt_product_name:'Atlas de Níveis QA',transaction_id:transaction,status,status_rank:status==='pago'?1:2,is_test:false,source:'payt',created_at:new Date().toISOString()})
const orders = [
  order(200,'basico@example.test','BASIC-QA','pago','BASIC-200'),
  order(201,'completo@example.test','COMPLETE-QA','pago','COMPLETE-201'),
  order(202,'upgrade@example.test','BASIC-QA','pago','BASIC-202'),
  order(203,'upgrade@example.test','UPGRADE-QA','pago','UPGRADE-203'),
  order(204,'reembolso@example.test','BASIC-QA','pago','BASIC-204'),
  order(205,'reembolso@example.test','UPGRADE-QA','reembolsado','UPGRADE-205'),
  order(206,'bloqueado@example.test','COMPLETE-QA','pago','COMPLETE-206'),
]
const email_log = customers.map((c,i)=>({id:uuid(300+i),customer_id:c.id,store_id:uuid(1),to_email:c.email,product_ids:[uuid(10)],status:'enviado',created_at:new Date().toISOString()}))
const tables = {stores,products,modules,items,customers,offers,offer_products,orders,item_access:[],member_progress:[],login_attempts:[],customer_devices:[],email_log,payt_events:[]}
const userFor = email => ({...(customers.find(c=>c.email===email)||admin),aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}})
const tokens = new Map()
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const sessionFor = email => {
  const user=userFor(email), now=Math.floor(Date.now()/1000)
  const data=`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,email,session_id:uuid(Number(user.id.slice(-12))+1000),role:'authenticated',aud:'authenticated',iat:now,exp:now+3600})}`
  const token=`${data}.${createHmac('sha256','qa-local-only').update(data).digest('base64url')}`
  tokens.set(token,user)
  return {access_token:token,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'local-qa-refresh',user}
}
const requests = []; const mutations=[]; const storageEvents=[]; let generatedEmail='basico@example.test'; let imagesEnabled=true; let progressFailure=false; let nextRowId=500
const withImages = (table, rows) => rows.map(row => {
  if(!imagesEnabled)return row
  if(table==='stores'&&row.id===uuid(1))return {...row,login_image_url:imageUrl('hero')}
  if(table==='products'&&row.id===uuid(10))return {...row,cover_url:imageUrl('atlas'),banner_url:imageUrl('hero')}
  if(table==='items'&&[uuid(30),uuid(31)].includes(row.module_id))return {...row,cover_url:imageUrl('atlas')}
  return row
})
const sortRows = (rows, order) => {
  if(!order)return rows
  const clauses=order.split(',').map(part=>{const [key,direction='asc']=part.split('.');return {key,direction}})
  return [...rows].sort((a,b)=>{
    for(const {key,direction} of clauses){const av=a[key]??'',bv=b[key]??'';if(av===bv)continue;return (av<bv?-1:1)*(direction==='desc'?-1:1)}
    return 0
  })
}
const addNestedRelations = (table, rows, select) => {
  if(table!=='items'||!select?.includes('modules'))return rows
  return rows.map(row=>{
    const parentModule=modules.find(candidate=>candidate.id===row.module_id)
    if(!parentModule)return {...row,modules:null}
    if(!select.includes('products'))return {...row,modules:parentModule}
    const relatedProduct=products.find(candidate=>candidate.id===parentModule.product_id)
    return {...row,modules:{...parentModule,products:relatedProduct?withImages('products',[relatedProduct])[0]:null}}
  })
}
const matches = (row, key, value) => {
  if(value.startsWith('eq.'))return String(row[key])===value.slice(3)
  if(value.startsWith('in.('))return value.slice(4,-1).split(',').includes(String(row[key]))
  if(value.startsWith('gte.'))return String(row[key])>=value.slice(4)
  if(value.startsWith('cs.'))return value.slice(3).replace(/[{}]/g,'').split(',').every(x=>(row[key]||[]).includes(x))
  if(value==='is.null')return row[key]==null
  return true
}
const addModuleItems = (rows, select, params) => {
  if(!select?.includes('items('))return rows
  return rows.map(module=>{
    let nested=withImages('items',items.filter(item=>item.module_id===module.id))
    for(const [key,value] of params){if(key.startsWith('items.')&&key!=='items.order')nested=nested.filter(item=>matches(item,key.slice(6),value))}
    nested=sortRows(nested,params.get('items.order')||'sort_order.asc,created_at.asc')
    return {...module,items:nested}
  })
}
const linked = offer => offer_products.filter(link=>link.offer_id===offer.id)
const offerWithRelations = (offer,select) => {
  const links=linked(offer)
  const row={...offer}
  if(select?.includes('offer_products('))row.offer_products=links.map(link=>({
    ...link,
    ...(select.includes('products(')?{products:products.find(p=>p.id===link.product_id)||null}:{})
  }))
  if(select?.includes('stores('))row.stores=stores.find(s=>s.id===offer.store_id)||null
  return row
}
const rpcOffer = (input, legacy=false) => {
  const id=input.p_id || uuid(900+offers.length)
  const existing=offers.find(o=>o.id===id)
  if(existing && existing.store_id!==input.p_store_id)return {error:'Oferta de outra loja'}
  if(existing && existing.payt_product_code!==input.p_product_code)return {error:'Código de oferta imutável'}
  let grants=legacy
    ? (input.p_product_ids||[]).map(product_id=>({product_id,grant_level:linked(existing||{}).find(l=>l.product_id===product_id)?.grant_level||'complete'}))
    : (input.p_grants||[]).map(g=>({product_id:g.product_id||g.productId||g.id,grant_level:g.grant_level||g.grantLevel||g.level}))
  if(!grants.length || grants.some(g=>!products.some(p=>p.id===g.product_id&&p.store_id===input.p_store_id)||!['basic','complete'].includes(g.grant_level)))return {error:'Grants inválidos'}
  if(offers.some(o=>o.id!==id&&o.payt_product_code===input.p_product_code))return {error:'Código repetido'}
  if(existing)Object.assign(existing,{name:input.p_name})
  else offers.push({id,store_id:input.p_store_id,name:input.p_name,payt_product_code:input.p_product_code})
  offer_products.splice(0,offer_products.length,...offer_products.filter(l=>l.offer_id!==id))
  for(const grant of grants)offer_products.push({id:uuid(1000+offer_products.length),offer_id:id,...grant})
  mutations.push({table:'offers',method:legacy?'save_offer_atomic':'save_offer_levels_atomic',id,grants,at:Date.now()})
  return {id}
}
const rpcOrder = input => {
  let row=orders.find(o=>o.transaction_id===input.p_transaction_id&&o.payt_product_code===input.p_product_code)
  const changed=!row || (input.p_status_rank>row.status_rank)
  if(!row){row=order(1200+orders.length,input.p_customer_email,input.p_product_code,input.p_status,input.p_transaction_id);orders.push(row)}
  if(changed)Object.assign(row,{store_id:input.p_store_id,customer_email:input.p_customer_email,customer_name:input.p_customer_name,payt_product_name:input.p_product_name,status:input.p_status,status_rank:input.p_status_rank,amount_cents:input.p_amount_cents,is_test:input.p_is_test})
  mutations.push({table:'orders',method:'apply_order_status',id:row.id,changed,status:row.status,at:Date.now()})
  return {out_order_id:row.id,out_changed:changed,out_status:row.status}
}
const server = http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:54341')
  const cors={'access-control-allow-origin':'http://127.0.0.1:3191','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info,x-upsert'}
  const send=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json',...cors});res.end(JSON.stringify(value))}
  if(req.method==='OPTIONS'){res.writeHead(204,cors);return res.end()}
  let body='';for await(const chunk of req)body+=chunk
  let input={}
  if(body && (req.headers['content-type']||'').includes('application/json')){
    try{input=JSON.parse(body)}catch{return send({message:'JSON inválido'},400)}
  }
  if(url.pathname==='/__metrics'){if(req.method==='DELETE')requests.length=0;return send(requests)}
  if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/storage/'))requests.push({path:url.pathname,query:url.search,at:Date.now(),method:req.method})
  if(url.pathname==='/__health')return send({ok:true,syntheticOnly:true,app:'http://127.0.0.1:3191',provider:'http://127.0.0.1:54341'})
  if(url.pathname==='/__control' && req.method==='POST'){
    if(input.blocked!==undefined)customers.find(c=>c.email==='bloqueado@example.test').blocked_at=input.blocked?new Date().toISOString():null
    if(input.images!==undefined)imagesEnabled=Boolean(input.images)
    if(input.supportWhatsapp!==undefined)stores[0].support_whatsapp=input.supportWhatsapp?'5511999999999':null
    if(input.progressFailure!==undefined)progressFailure=Boolean(input.progressFailure)
    return send({ok:true,images:imagesEnabled,supportWhatsapp:Boolean(stores[0].support_whatsapp),progressFailure})
  }
  if(url.pathname==='/__audit')return send({itemAccess:tables.item_access,memberProgress:tables.member_progress,loginAttempts:tables.login_attempts.length,mutations,storageEvents,offers:offers.map(o=>offerWithRelations(o,'offer_products(grant_level)')),orders,modules,products,paytEvents:tables.payt_events})
  if(url.pathname==='/reference'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8',...cors})
    return res.end('<h1>Destino local de QA</h1><p>Checkout e suporte fictícios. Nenhum serviço externo.</p>')
  }
  if(url.pathname.startsWith('/storage/v1/object/upload/sign/')&&req.method==='POST'){
    const parts=url.pathname.split('/');const bucket=parts[6],path=parts.slice(7).join('/')
    if(bucket!=='arquivos-restritos')return send({message:'bucket inválido'},400)
    storageEvents.push({kind:'createSignedUploadUrl',bucket,path,at:Date.now()})
    return send({url:`/object/upload/sign/${bucket}/${path}?token=qa-upload`,token:'qa-upload',path})
  }
  if(url.pathname.startsWith('/storage/v1/object/upload/sign/')&&req.method==='PUT'){
    storageEvents.push({kind:'uploadToSignedUrl',path:url.pathname,bytes:Buffer.byteLength(body),at:Date.now()})
    return send({Key:url.pathname.replace('/storage/v1/object/upload/sign/','')})
  }
  if(url.pathname.startsWith('/storage/v1/object/sign/')&&req.method==='POST'){
    const parts=url.pathname.split('/');const bucket=parts[5],path=parts.slice(6).join('/')
    if(bucket!=='arquivos-restritos')return send({message:'bucket inválido'},400)
    storageEvents.push({kind:'createSignedUrl',bucket,path,expiresIn:input.expiresIn,at:Date.now()})
    return send({signedURL:`/object/sign/${bucket}/${path}?token=qa-download`})
  }
  if(url.pathname.startsWith('/storage/v1/object/')){
    storageEvents.push({kind:'objectRequest',path:url.pathname,method:req.method,at:Date.now()})
    res.writeHead(200,{'content-type':'application/pdf',...cors});return res.end('%PDF-1.4\n% synthetic local QA\n')
  }
  if(url.pathname==='/auth/v1/admin/generate_link'){generatedEmail=input.email;return send({action_link:'http://localhost',email_otp:'123456',hashed_token:'fixture-hash',verification_type:'magiclink',redirect_to:'http://localhost',...userFor(generatedEmail)})}
  if(url.pathname==='/auth/v1/verify')return input.token_hash==='fixture-hash'?send(sessionFor(generatedEmail)):input.token==='12345678'&&input.email===admin.email?send(sessionFor(admin.email)):send({msg:'Invalid OTP',code:'otp_expired'},403)
  if(url.pathname==='/auth/v1/otp')return send({})
  if(url.pathname==='/auth/v1/user'){const user=tokens.get((req.headers.authorization||'').replace(/^Bearer /,''));return user?send(user):send({msg:'invalid token'},401)}
  if(url.pathname==='/auth/v1/logout')return send({})
  if(url.pathname==='/auth/v1/.well-known/jwks.json')return send({keys:[]})
  if(url.pathname==='/rest/v1/rpc/store_customer_success')return send([])
  if(url.pathname==='/rest/v1/rpc/save_offer_levels_atomic'||url.pathname==='/rest/v1/rpc/save_offer_atomic'){
    const result=rpcOffer(input,url.pathname.endsWith('save_offer_atomic'))
    return result.error?send({message:result.error,code:'P0001'},400):send(result.id)
  }
  if(url.pathname==='/rest/v1/rpc/apply_order_status')return send(rpcOrder(input))
  const table=url.pathname.replace('/rest/v1/','')
  if(!tables[table]){console.log('UNHANDLED',req.method,url.pathname);return send({message:'fixture unsupported'},404)}
  if(table==='member_progress'&&progressFailure&&['POST','DELETE'].includes(req.method))return send({code:'QA_FAILURE',message:'Falha sintética ao salvar progresso'},503)
  if(req.method==='POST'){
    const rows=(Array.isArray(input)?input:[input]).map(x=>{
      const conflict=url.searchParams.get('on_conflict')?.split(',')
      const existing=table==='member_progress'&&conflict&&tables[table].find(row=>conflict.every(key=>row[key]===x[key]))
      if(existing){Object.assign(existing,x,{updated_at:new Date().toISOString()});return existing}
      const row={id:uuid(nextRowId++),created_at:new Date().toISOString(),...x}
      tables[table].push(row)
      return row
    })
    mutations.push({table,method:table==='member_progress'?'UPSERT':'POST',rows:rows.map(row=>row.id),at:Date.now()})
    const representation=req.headers.prefer?.includes('return=representation')
    return send(representation?(req.headers.accept?.includes('vnd.pgrst.object+json')?rows[0]:rows):null,201)
  }
  let rows=withImages(table,tables[table]).filter(row=>[...url.searchParams].every(([key,value])=>{
    if(['select','order','limit','offset'].includes(key)||key.startsWith('items.'))return true
    if(key==='modules.product_id'){
      const parentModule=modules.find(candidate=>candidate.id===row.module_id)
      return value.startsWith('eq.')?parentModule?.product_id===value.slice(3):true
    }
    if(key==='modules.products.store_id'){
      const parentModule=modules.find(candidate=>candidate.id===row.module_id)
      const relatedProduct=products.find(candidate=>candidate.id===parentModule?.product_id)
      return value.startsWith('eq.')?relatedProduct?.store_id===value.slice(3):true
    }
    return matches(row,key,value)
  }))
  if(req.method==='PATCH'){
    for(const row of rows)Object.assign(tables[table].find(candidate=>candidate.id===row.id),input)
    mutations.push({table,method:'PATCH',rows:rows.map(row=>row.id),at:Date.now()})
    const changed=rows.map(row=>({...row,...input}))
    return send(req.headers.prefer?.includes('return=representation')?(req.headers.accept?.includes('vnd.pgrst.object+json')?changed[0]:changed):null)
  }
  if(req.method==='DELETE'){
    const ids=new Set(rows.map(row=>row.id))
    tables[table].splice(0,tables[table].length,...tables[table].filter(row=>!ids.has(row.id)))
    mutations.push({table,method:'DELETE',rows:[...ids],at:Date.now()})
    return send(null)
  }
  if(req.headers.prefer?.includes('count='))res.setHeader('content-range',`0-${Math.max(0,rows.length-1)}/${rows.length}`)
  if(req.method==='HEAD'){res.writeHead(200);return res.end()}
  if(table==='offers')rows=rows.map(o=>offerWithRelations(o,url.searchParams.get('select')))
  rows=addNestedRelations(table,rows,url.searchParams.get('select'))
  if(table==='modules')rows=addModuleItems(rows,url.searchParams.get('select'),url.searchParams)
  rows=sortRows(rows,url.searchParams.get('order'))
  if(url.searchParams.has('offset'))rows=rows.slice(Number(url.searchParams.get('offset')))
  if(url.searchParams.has('limit'))rows=rows.slice(0,Number(url.searchParams.get('limit')))
  if(req.headers.accept?.includes('vnd.pgrst.object+json'))return rows.length===1?send(rows[0]):send({code:'PGRST116',details:`The result contains ${rows.length} rows`},406)
  return send(rows)
})
server.listen(54341,'127.0.0.1',()=>console.log('Fixture backend ready at 127.0.0.1:54341; synthetic data only'))
const systemEnv = Object.fromEntries(['PATH','Path','PATHEXT','SystemRoot','SYSTEMROOT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].flatMap(name => process.env[name] ? [[name,process.env[name]]] : []))
// Child Next workers inherit this guard. A paid synthetic webhook can attempt
// an access notice; the guard stops Resend or any other external fetch.
const guardPath=join(tmpdir(),`niveis-qa-network-guard-${process.pid}.cjs`)
writeFileSync(guardPath,`const original=globalThis.fetch;globalThis.fetch=function(input,...rest){const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))return Promise.reject(new Error('Synthetic QA blocked external fetch: '+url.hostname));return original.call(this,input,...rest)};`)
const app=spawn(process.execPath,['--require',guardPath,'node_modules/next/dist/bin/next',process.argv.includes('--production')?'start':'dev','--hostname','127.0.0.1','--port','3191'],{cwd:process.cwd(),env:{...systemEnv,NODE_OPTIONS:`--require=${guardPath.replaceAll('\\','/')}`,SUPABASE_URL:'http://127.0.0.1:54341',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54341',SUPABASE_PUBLISHABLE_KEY:'qa-public',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'qa-public',SUPABASE_SECRET_KEY:'qa-service',SUPABASE_SERVICE_ROLE_KEY:'qa-service',DATABASE_URL:'',DEFAULT_STORE_SLUG:'arquitetura',ADMIN_EMAILS:admin.email,LOGIN_GUARD_SECRET:'qa-local-login-secret-32-characters',APP_URL:'http://127.0.0.1:3191',PAYT_INTEGRATION_KEY:'qa-webhook',EMAIL_FROM:'qa@example.test',EMAIL_REPLY_TO:'',RESEND_API_KEY:'qa-no-email',VERCEL_OIDC_TOKEN:'',TURNSTILE_SITE_KEY:'',TURNSTILE_SECRET_KEY:''},stdio:'inherit',windowsHide:true})
function stop(){app.kill();server.close();try{unlinkSync(guardPath)}catch{}process.exit()}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
