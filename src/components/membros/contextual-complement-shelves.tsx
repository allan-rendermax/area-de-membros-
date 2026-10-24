import type { ProductComplements } from '@/lib/access/contextual-complements'
import type { PreviewContext } from '@/lib/membros/preview-context'
import { withPreview } from '@/lib/membros/paths'
import { Carousel } from './carousel'
import { PosterLink,POSTER_WIDTH } from './poster-card'
import { LockedPoster } from './locked-poster'
import styles from './contextual-complements.module.css'
export function ContextualComplementShelves({complements,storeSlug,preview,requestedSlug,complementScenario}:{complements:ProductComplements;storeSlug:string;preview:PreviewContext;requestedSlug?:string;complementScenario?:string}) {
  if(!complements.owned.length && !complements.optional.length)return null
  return <div id="complementos" className={styles.shelves}>
    {complements.owned.length>0 && <div id="complementos-adquiridos"><Carousel title="Seus complementos">{complements.owned.map(p=><div key={p.id} className={`${styles.card} ${POSTER_WIDTH}`}>
      <PosterLink product={{...p,unlocked:true}} href={withPreview(`/${storeSlug}/produto/${p.slug}`,preview,complementScenario)} /><p className={`${styles.status} ${styles.acquired}`}>✓ Adquirido · Acessar material</p>
    </div>)}</Carousel></div>}
    {complements.optional.length>0 && <div id="complementos-disponiveis"><Carousel title="Complemente seu material">{complements.optional.map(p=><div key={p.id} className={`${styles.card} ${POSTER_WIDTH}`}>
      <LockedPoster product={{...p,unlocked:false}} initiallyOpen={requestedSlug===p.slug} queryParameter="complemento" contextual /><p className={styles.status}>Vendido separadamente</p>
    </div>)}</Carousel></div>}
  </div>
}
