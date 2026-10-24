import { redirect } from 'next/navigation'
import type { AccessLevel,CustomerRow,Product,Store } from '@/lib/domain/types'
import type { RecentProductVisitWithAccess } from '@/lib/data/item-access'
import { listContextualRelations } from '@/lib/data/contextual-complements'
import { projectContextualLibrary } from '@/lib/access/contextual-complements'
import { buildShelf,buildTracks } from '@/lib/access/access'
import { arrangeComplementaryTracks,selectComplementaryPairs,findRequestedComplement } from '@/lib/access/product-complement'
import { projectContextualResume,resolveContextualRequest } from '@/lib/membros/contextual-library'
import { contextualPreviewRights } from '@/lib/membros/contextual-preview'
import { previewIncludesDrafts,previewAccessLevel,type PreviewContext } from '@/lib/membros/preview-context'
import { getMemberTheme,withMemberArtwork } from '@/lib/membros/theme'
import { withPreview } from '@/lib/membros/paths'
import { supportHref } from '@/lib/support/whatsapp'
import { StoreHeader } from './store-header'
import { ArchitectureHero } from './architecture-hero'
import { Hero } from './hero'
import { Carousel } from './carousel'
import { PosterLink,POSTER_WIDTH } from './poster-card'
import { LockedPoster } from './locked-poster'
import { ComplementPoster,ComplementPurchasePrompt } from './product-complement'
import { OwnedProductGroup } from './owned-product-group'
import { InstallAppButton } from './install-app-button'
import { ScrollToMaterials } from './scroll-to-materials'
import { WhatsAppFloating } from './whatsapp-button'
import styles from './contextual-complements.module.css'

export async function renderContextualHome({store,customer,products,granted,levels,recentVisits,preview,query}:{
  store:Store;customer:CustomerRow|null;products:Product[];granted:Set<string>;levels:Map<string,AccessLevel>
  recentVisits:RecentProductVisitWithAccess[];preview:PreviewContext;query:Record<string,string|string[]|undefined>
}){
  const {relations}=await listContextualRelations(store.id)
  const scenario=typeof query.complementos==='string'?query.complementos:undefined
  const purchases=preview?contextualPreviewRights(products,relations,preview,scenario):granted
  const visibleProducts=products.map(p=>withMemberArtwork(p,store.slug))
  const input={storeId:store.id,products:visibleProducts,relations,granted:purchases,includeDrafts:previewIncludesDrafts(preview)}
  const projection=projectContextualLibrary(input)
  const requested=typeof query.comprar==='string'?resolveContextualRequest(input,query.comprar,store.slug):{kind:'legacy' as const}
  if(requested.kind==='owned'||requested.kind==='offer')redirect(withPreview(requested.href,preview,scenario))
  const fullShelf=buildShelf(visibleProducts.filter(p=>p.catalogVisibility!=='contextual'),purchases,{includeDrafts:input.includeDrafts})
  const legacyPairs=selectComplementaryPairs([...fullShelf.unlocked,...fullShelf.locked]).filter(([source,target])=>!target.unlocked && !relations.some(r=>r.parentProductId===source.id && r.complementProductId===target.id))
  const legacyTargets=new Set(legacyPairs.map(([,target])=>target.id))
  const discoveryIds=new Set(projection.discovery.map(p=>p.id))
  for(const [source] of legacyPairs)discoveryIds.add(source.id)
  const discoveryShelf=buildShelf(visibleProducts.filter(p=>discoveryIds.has(p.id)),purchases,{includeDrafts:input.includeDrafts})
  const architecture=getMemberTheme(store.slug)==='arquitetura'
  const tracks=arrangeComplementaryTracks(buildTracks(discoveryShelf,architecture?['Atlas Visuais','Softwares e IA','Prática Profissional','Protocolos Profissionais']:[]))
  const requestedLegacy=requested.kind==='legacy'?findRequestedComplement(tracks.flatMap(track=>track.products),legacyTargets,typeof query.comprar==='string'?query.comprar:null):null
  const effectiveLevels=preview?new Map([...purchases].map(id=>[id,previewAccessLevel(preview) ?? 'complete'])):levels
  const continuing=projectContextualResume(input,projection,recentVisits,effectiveLevels,store.slug)
  const support=supportHref(store,'geral',customer?.email ?? null)
  return <>
    <StoreHeader store={store} email={customer?.email ?? ''} preview={preview} complementScenario={scenario} actions={<InstallAppButton/>} active="home" />
    <main className="pb-24">
      {architecture?<ArchitectureHero/>:fullShelf.featured && <Hero product={fullShelf.featured} storeSlug={store.slug} preview={preview}/>}
      <div id="materiais" className="scroll-mt-28 py-6 sm:py-9">
        {architecture && <div className="arq-library-heading"><h2>Tudo pronto para você criar</h2><p>Seu acervo de arquitetura, em um só lugar.</p></div>}
        {requested.kind==='unavailable' && <p role="status" className="mx-4 mb-6 rounded-lg border border-borda p-4 sm:mx-8">Este material não está liberado no seu acesso atual. Confira sua compra ou fale com o suporte.{support && <a href={support} className="ml-2 underline" target="_blank" rel="noopener noreferrer">Falar com o suporte</a>}</p>}
        <div className="flex flex-col gap-10">
          {requestedLegacy && <ComplementPurchasePrompt product={requestedLegacy} dismissHref={withPreview(`/${store.slug}#materiais`,preview,scenario)}/>}
          {continuing.length>0 && <Carousel title="Continuar">{continuing.map(card=><div key={card.product.id} className={`${styles.card} ${POSTER_WIDTH}`}><PosterLink product={{...card.product,unlocked:true}} href={withPreview(card.href,preview,scenario)}/><p className={styles.status}>Retomar: {card.materialTitle}</p></div>)}</Carousel>}
          {projection.owned.length>0?<Carousel title="Meus materiais">{projection.owned.map(group=><OwnedProductGroup key={group.product.id} group={group} storeSlug={store.slug} preview={preview} complementScenario={scenario}/>)}</Carousel>:<section className="mx-4 rounded-lg border border-borda bg-superficie p-6 sm:mx-8"><h2 className="text-lg font-semibold">Nenhum produto liberado ainda</h2><p className="mt-2 text-texto-suave">Seus produtos aparecem aqui assim que o pagamento é confirmado.</p>{support && <a href={support} className="mt-4 inline-flex min-h-11 items-center underline" target="_blank" rel="noopener noreferrer">Falar com o suporte</a>}</section>}
          {tracks.length>0 && <div id="explorar" className="scroll-mt-28 space-y-8"><h2 className="px-4 text-2xl font-bold sm:px-8">Explore outros produtos</h2>{tracks.map(track=><Carousel key={track.name} title={track.name}>{track.products.map(p=>p.unlocked?<PosterLink key={p.id} product={p} href={withPreview(`/${store.slug}/produto/${p.slug}`,preview,scenario)}/>:legacyTargets.has(p.id)?<ComplementPoster key={p.id} product={p}/>:<LockedPoster key={p.id} product={p} initiallyOpen={query.comprar===p.slug}/>)}</Carousel>)}</div>}
        </div>
      </div><ScrollToMaterials/>
    </main><WhatsAppFloating href={support}/>
  </>
}
