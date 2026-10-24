import Link from 'next/link'
import type { OwnedGroup } from '@/lib/access/contextual-complements'
import type { PreviewContext } from '@/lib/membros/preview-context'
import { withPreview } from '@/lib/membros/paths'
import { PosterLink,POSTER_WIDTH } from './poster-card'
import styles from './contextual-complements.module.css'
export function OwnedProductGroup({group,storeSlug,preview,complementScenario}:{group:OwnedGroup;storeSlug:string;preview:PreviewContext;complementScenario?:string}){
  return <div className={`${styles.group} ${POSTER_WIDTH}`}>
    <PosterLink product={{...group.product,unlocked:true}} href={withPreview(`/${storeSlug}/produto/${group.product.slug}`,preview,complementScenario)} />
    {group.complements.length>0 && <details><summary>{group.complements.length} {group.complements.length===1?'complemento adquirido':'complementos adquiridos'}</summary>
      <ul>{group.complements.map(item=><li key={item.id}><Link href={withPreview(`/${storeSlug}/produto/${item.slug}`,preview,complementScenario)}>{item.title}</Link></li>)}</ul>
    </details>}
  </div>
}
