import type { OwnedGroup } from '@/lib/access/contextual-complements'
import type { PreviewContext } from '@/lib/membros/preview-context'
import { withPreview } from '@/lib/membros/paths'
import { PosterLink } from './poster-card'
export function OwnedProductGroup({group,storeSlug,preview,complementScenario}:{group:OwnedGroup;storeSlug:string;preview:PreviewContext;complementScenario?:string}){
  return <>{[group.product,...group.complements].map(product=><PosterLink
    key={product.id}
    product={{...product,unlocked:true}}
    href={withPreview(`/${storeSlug}/produto/${product.slug}`,preview,complementScenario)}
  />)}</>
}
