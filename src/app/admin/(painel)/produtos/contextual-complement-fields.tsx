'use client'
import { useState } from 'react'
import type { Product,ContextualRelation } from '@/lib/domain/types'
import { ui } from '@/components/admin/ui'
export function ContextualComplementFields({product,products,relations,revision,disabled,onDirty}:{product:Product|null;products:Product[];relations:ContextualRelation[];revision:number;disabled:boolean;onDirty:()=>void}) {
  const [selected,setSelected]=useState(()=>relations.filter(r=>r.parentProductId===product?.id).sort((a,b)=>a.sortOrder-b.sortOrder).map(r=>r.complementProductId))
  const [visibility,setVisibility]=useState(product?.catalogVisibility ?? 'catalog')
  const hasParent=relations.some(r=>r.complementProductId===product?.id && products.some(p=>p.id===r.parentProductId && p.isPublished))
  const isTarget=relations.some(r=>r.complementProductId===product?.id)
  const parentIds=new Set(relations.map(r=>r.parentProductId))
  const candidates=products.filter(p=>p.id!==product?.id && p.storeId===product?.storeId && !parentIds.has(p.id) && !selected.includes(p.id))
  // New products have no product.storeId yet; all supplied candidates are scoped by the server.
  const options=product?candidates:products.filter(p=>!parentIds.has(p.id) && !selected.includes(p.id))
  const change=(ids:string[])=>{setSelected(ids);onDirty()}
  const move=(index:number,delta:number)=>{const ids=[...selected];[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];change(ids)}
  return <fieldset disabled={disabled} className="space-y-4 border-t border-borda pt-5">
    <legend className="px-2 text-xl font-bold">Organização na biblioteca</legend>
    <input type="hidden" name="contextual_complement_ids" value={JSON.stringify(selected)} />
    <input type="hidden" name="editorial_revision" value={product?revision:''} />
    <label className={ui.label}>Onde oferecer este produto<select name="catalog_visibility" value={visibility} onChange={e=>{setVisibility(e.target.value as typeof visibility);onDirty()}} className={ui.input}>
      <option value="catalog">Catálogo geral</option><option value="contextual">Somente dentro dos produtos associados</option>
    </select></label>
    {visibility==='contextual' && !hasParent && <p role="status" className={ui.notice}>Sem principal publicado associado. Quem já comprou continua encontrando este material avulso; a oferta não aparece no catálogo geral.</p>}
    <p className="text-sm text-texto-suave">Complementos deste produto: a compra e o acesso de cada material continuam independentes.</p>
    {isTarget?<p className="text-sm">Este material é um complemento. Não pode agrupar outros complementos.</p>:<label className={ui.label}>Adicionar complemento<select value="" onChange={e=>{if(e.target.value)change([...selected,e.target.value])}} className={ui.input}><option value="">Selecione um produto</option>{options.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
    <ol className="space-y-2">{selected.map((id,index)=><li key={id} className="flex flex-wrap items-center gap-2 rounded-lg border border-borda p-3"><span className="min-w-0 flex-1">{products.find(p=>p.id===id)?.title ?? 'Produto indisponível'}</span>
      <button type="button" disabled={index===0} onClick={()=>move(index,-1)} className="min-h-11 px-2 disabled:opacity-40" aria-label={`Subir ${products.find(p=>p.id===id)?.title}`}>↑</button>
      <button type="button" disabled={index===selected.length-1} onClick={()=>move(index,1)} className="min-h-11 px-2 disabled:opacity-40" aria-label={`Descer ${products.find(p=>p.id===id)?.title}`}>↓</button>
      <button type="button" onClick={()=>change(selected.filter(x=>x!==id))} className="min-h-11 px-2">Remover</button>
    </li>)}</ol>
  </fieldset>
}
