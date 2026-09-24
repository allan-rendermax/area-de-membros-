import http from 'node:http'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const imageUrl = name => `/themes/arquitetura/${name}.webp`
const store = (n, slug, name) => ({ id:uuid(n),slug,name,logo_url:null,support_url:null,support_whatsapp:null,login_image_url:null })
const stores = [store(1,'arquitetura','Arquitetura QA'),store(2,'outra','Outra loja QA'),store(3,'admin-loja','Admin Loja QA')]
const product = (n, storeId, slug, title, role='front', sortOrder=n, published=true) => ({ id:uuid(n),store_id:uuid(storeId),slug,title,role,track:'Materiais',description:'Material fictício para teste local de acesso.',cover_url:null,banner_url:null,checkout_url:'https://example.com/checkout',is_featured:n===10,sort_order:sortOrder,is_published:published })
// The paid front stays first; among locked products, complementary roles must
// precede the front despite its lower sort_order. Upsell and orderbump tie on
// role priority, so their sort_order decides their relative order.
const products = [
  product(10,1,'atlas','Atlas QA (comprado)','front',50),
  product(11,1,'front-bloqueado','Front bloqueado QA','front',-10),
  product(12,2,'exclusivo','Exclusivo outra loja','front',12),
  product(13,1,'oculto','Produto oculto QA','front',13,false),
  product(14,3,'curso','Curso Admin Loja','front',14),
  product(15,1,'orderbump','Order bump QA','orderbump',90),
  product(16,1,'upsell','Upsell QA','upsell',30),
]
const modules = products.map(p=>({id:uuid(Number(p.id.slice(-12))+20),product_id:p.id,title:'Módulo QA',sort_order:0,is_published:true}))
const item = (n, module, kind, title, url, published=true) => ({id:uuid(n),module_id:uuid(module),kind,title,url,is_published:published,sort_order:n,cover_url:null})
const items = [
  item(50,30,'arquivo','Arquivo QA','http://127.0.0.1:54339/download/qa.pdf'),
  item(51,30,'video','Vídeo QA','https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  item(52,32,'arquivo','Arquivo outra loja','http://127.0.0.1:54339/download/secret.pdf'),
  item(53,30,'arquivo','Item oculto QA','http://127.0.0.1:54339/download/hidden.pdf',false),
  item(54,30,'video','Vídeo QA 2','https://www.youtube.com/watch?v=aqz-KE-bpKQ'),
  item(55,30,'video','Vídeo QA 3','https://www.youtube.com/watch?v=jNQXAC9IVRw'),
]
const customers = [{id:uuid(100),email:'aluno@example.test',name:'Aluno QA',blocked_at:null},{id:uuid(101),email:'bloqueado@example.test',name:'Bloqueado QA',blocked_at:new Date().toISOString()}]
const offers = [{id:uuid(70),store_id:uuid(1),name:'Atlas QA',payt_product_code:'ATLAS-QA',offer_products:[{product_id:uuid(10)}]},{id:uuid(71),store_id:uuid(3),name:'Admin Loja QA',payt_product_code:'ADMIN-QA',offer_products:[{product_id:uuid(14)}]}]
const orders = customers.flatMap(c => offers.map(o=>({id:uuid(200+(c===customers[0]?0:10)+(o===offers[0]?0:1)),customer_email:c.email,payt_product_code:o.payt_product_code,status:'pago',store_id:o.store_id})))
const tables = {stores,products,modules,items,customers,offers,orders,item_access:[],login_attempts:[],customer_devices:[],email_log:[],payt_events:[]}
const admin = {id:uuid(102),email:'admin@example.test'}
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
const requests = []; const mutations=[]; let generatedEmail='aluno@example.test'; let imagesEnabled=true
const withImages = (table, rows) => rows.map(row => {
  if(!imagesEnabled)return row
  if(table==='stores'&&row.id===uuid(1))return {...row,login_image_url:imageUrl('hero')}
  if(table==='products'&&row.id===uuid(10))return {...row,cover_url:imageUrl('atlas'),banner_url:imageUrl('hero')}
  if(table==='products'&&row.id===uuid(11))return {...row,cover_url:imageUrl('bonus'),banner_url:imageUrl('hero')}
  if(table==='items'&&row.module_id===uuid(30))return {...row,cover_url:imageUrl('atlas')}
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
const server = http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:54339')
  const send=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
  let body='';for await(const chunk of req)body+=chunk
  const input=body?JSON.parse(body):{}
  if(url.pathname==='/__metrics'){if(req.method==='DELETE')requests.length=0;return send(requests)}
  if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/auth/')){requests.push({path:url.pathname,query:url.search,at:Date.now(),method:req.method});await new Promise(resolve=>setTimeout(resolve,100))}
  if(url.pathname==='/__health')return send({ok:true})
  if(url.pathname==='/__control' && req.method==='POST'){
    if(input.blocked!==undefined)customers[0].blocked_at=input.blocked?new Date().toISOString():null
    if(input.paid!==undefined)orders[0].status=input.paid?'pago':'reembolsado'
    if(input.images!==undefined)imagesEnabled=Boolean(input.images)
    return send({ok:true,images:imagesEnabled})
  }
  if(url.pathname==='/__audit')return send({itemAccess:tables.item_access,loginAttempts:tables.login_attempts.length,mutations,stores})
  if(url.pathname.startsWith('/download/')){res.writeHead(200,{'content-type':'text/plain'});return res.end('Arquivo de teste local QA')}
  if(url.pathname==='/auth/v1/admin/generate_link'){generatedEmail=input.email;return send({action_link:'http://localhost',email_otp:'123456',hashed_token:'fixture-hash',verification_type:'magiclink',redirect_to:'http://localhost',...userFor(generatedEmail)})}
  if(url.pathname==='/auth/v1/verify')return input.token_hash==='fixture-hash'?send(sessionFor(generatedEmail)):input.token==='12345678'&&input.email===admin.email?send(sessionFor(admin.email)):send({msg:'Invalid OTP',code:'otp_expired'},403)
  if(url.pathname==='/auth/v1/otp')return send({})
  if(url.pathname==='/auth/v1/user'){const user=tokens.get((req.headers.authorization||'').replace(/^Bearer /,''));return user?send(user):send({msg:'invalid token'},401)}
  if(url.pathname==='/auth/v1/logout')return send({})
  if(url.pathname==='/auth/v1/.well-known/jwks.json')return send({keys:[]})
  if(url.pathname==='/rest/v1/rpc/store_customer_success')return send([])
  const table=url.pathname.replace('/rest/v1/','')
  if(!tables[table]){console.log('UNHANDLED',req.method,url.pathname);return send({message:'fixture unsupported'},404)}
  if(req.method==='POST'){
    const rows=(Array.isArray(input)?input:[input]).map(x=>({id:uuid(500+tables[table].length),created_at:new Date().toISOString(),...x}))
    tables[table].push(...rows)
    mutations.push({table,method:'POST',rows:rows.map(row=>row.id),at:Date.now()})
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
  if(table==='offers'&&url.searchParams.get('select')?.includes('stores('))rows=rows.map(o=>({...o,stores:stores.find(s=>s.id===o.store_id)}))
  rows=addNestedRelations(table,rows,url.searchParams.get('select'))
  if(table==='modules')rows=addModuleItems(rows,url.searchParams.get('select'),url.searchParams)
  rows=sortRows(rows,url.searchParams.get('order'))
  if(url.searchParams.has('offset'))rows=rows.slice(Number(url.searchParams.get('offset')))
  if(url.searchParams.has('limit'))rows=rows.slice(0,Number(url.searchParams.get('limit')))
  if(req.headers.accept?.includes('vnd.pgrst.object+json'))return rows.length===1?send(rows[0]):send({code:'PGRST116',details:`The result contains ${rows.length} rows`},406)
  return send(rows)
})
server.listen(54339,'127.0.0.1',()=>console.log('Fixture backend ready at 127.0.0.1:54339; synthetic data only'))
const systemEnv = Object.fromEntries(['PATH','Path','PATHEXT','SystemRoot','SYSTEMROOT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].flatMap(name => process.env[name] ? [[name,process.env[name]]] : []))
const app=spawn(process.execPath,['node_modules/next/dist/bin/next',process.argv.includes('--production')?'start':'dev','--hostname','127.0.0.1','--port','3187'],{cwd:process.cwd(),env:{...systemEnv,SUPABASE_URL:'http://127.0.0.1:54339',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54339',SUPABASE_PUBLISHABLE_KEY:'qa-public',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'qa-public',SUPABASE_SECRET_KEY:'qa-service',SUPABASE_SERVICE_ROLE_KEY:'qa-service',DATABASE_URL:'',DEFAULT_STORE_SLUG:'arquitetura',ADMIN_EMAILS:admin.email,LOGIN_GUARD_SECRET:'qa-local-login-secret-32-characters',APP_URL:'http://127.0.0.1:3187',PAYT_INTEGRATION_KEY:'qa-webhook',EMAIL_FROM:'qa@example.test',EMAIL_REPLY_TO:'',RESEND_API_KEY:'qa-no-email',VERCEL_OIDC_TOKEN:'',TURNSTILE_SITE_KEY:'',TURNSTILE_SECRET_KEY:''},stdio:'inherit',windowsHide:true})
function stop(){app.kill();server.close();process.exit()}
process.on('SIGINT',stop);process.on('SIGTERM',stop)

