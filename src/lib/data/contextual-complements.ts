import type { ContextualRelation } from '@/lib/domain/types'
import { createAdminClient } from '@/lib/supabase/admin'
export type RelationsResult = { relations: ContextualRelation[]; available: boolean }
export async function listContextualRelations(storeId: string): Promise<RelationsResult> {
  const relations:ContextualRelation[]=[]
  const db=createAdminClient()
  try {
    for (let offset=0;;offset+=500) {
      const {data,error}=await db.from('product_complements')
        .select('store_id,parent_product_id,complement_product_id,sort_order').eq('store_id',storeId)
        .order('parent_product_id').order('sort_order').order('complement_product_id').range(offset,offset+499)
      if (error || !data) throw new Error('relations_unavailable')
      relations.push(...data.map(r=>({storeId:r.store_id as string,parentProductId:r.parent_product_id as string,complementProductId:r.complement_product_id as string,sortOrder:r.sort_order as number})))
      if(data.length<500) return {relations,available:true}
    }
  } catch {
    console.error('contextual_relations_unavailable')
    return {relations:[],available:false}
  }
}
