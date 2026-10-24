import Link from 'next/link'
import type { Product,AccessLevel } from '@/lib/domain/types'
import { AutoCover } from './auto-cover'
import styles from './contextual-complements.module.css'
export function ContextualProductHeader({product,level,backHref,ownedCount,optionalCount}:{product:Product;level:AccessLevel;backHref:string;ownedCount:number;optionalCount:number}){
  return <>
    <header className={styles.header}>
      <div><Link href={backHref} className={styles.back}>← Voltar ao acervo</Link>
        <p className={styles.acquired}>✓ Versão {level==='basic'?'Básico':'Completo'} · Acesso liberado</p>
        <h1 className={styles.heading}>{product.title}</h1>
        {product.description && <p className="max-w-2xl text-sm leading-relaxed text-texto-suave">{product.description}</p>}
        <a className={styles.cta} href="#seu-material">Abrir meus materiais</a>
      </div><div className={styles.art}><AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" /></div>
    </header>
    <nav aria-label="Neste produto" className={styles.tabs}><a href="#seu-material">Seu material</a>{ownedCount>0 && <a href="#complementos-adquiridos">Seus complementos ({ownedCount})</a>}{optionalCount>0 && <a href="#complementos-disponiveis">Complementos disponíveis</a>}</nav>
  </>
}
