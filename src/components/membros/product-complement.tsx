import Link from 'next/link'
import type { ProductComplement } from '@/lib/access/product-complement'
import styles from './product-complement.module.css'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'
import { POSTER_WIDTH } from './poster-card'
import { preferredCheckoutUrl } from '@/lib/access/product-complement'
import { LockIcon } from './icons'

function Action({ complement, children }: { complement: ProductComplement; children: React.ReactNode }) {
  if (!complement.href) return <span className={styles.unavailable}>Compra indisponível</span>
  if (complement.external) return <a className={styles.action} href={complement.href} target="_blank" rel="noopener noreferrer">{children}</a>
  return <Link className={styles.action} href={complement.href}>{children}</Link>
}

export function ProductComplementCard({ complement }: { complement: ProductComplement }) {
  return <section className={styles.card} aria-label="Produto complementar">
    <p className={styles.label}>Produto complementar</p>
    <h3>{complement.product.title}</h3>
    <Action complement={complement}>{complement.owned ? 'Acessar materiais' : `Comprar ${complement.product.title}`}</Action>
  </section>
}

export function ProductComplementOffer({ complement }: { complement: ProductComplement }) {
  return <section className={styles.offer} aria-label="Produto complementar">
    <p className={styles.label}>Produto complementar</p>
    <h2>{complement.product.title}</h2>
    <p>{complement.owned ? 'Seu produto está liberado' : complement.product.description}</p>
    <Action complement={complement}>{complement.owned ? 'Acessar materiais' : `Comprar ${complement.product.title}`}</Action>
  </section>
}

export function ComplementPoster({ product }: { product: ShelfProduct }) {
  const href = preferredCheckoutUrl(product)
  return <div className={`member-poster ${POSTER_WIDTH} shrink-0 snap-start`}>
    {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Comprar ${product.title}`} className="group block focus-visible:outline-2 focus-visible:outline-destaque">
      <div className="relative"><AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" /><span className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-fundo/85 text-texto"><LockIcon className="h-5 w-5" /></span></div>
      <p className="mt-2 line-clamp-2 text-sm text-destaque">Comprar {product.title}</p>
    </a> : <div aria-label={`${product.title}: compra indisponível`}><div className="relative"><AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" className="grayscale opacity-70" /><span className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-fundo/85 text-texto"><LockIcon className="h-5 w-5" /></span></div><p className="mt-2 text-sm text-texto-suave">Compra indisponível</p></div>}
  </div>
}

export function ComplementPurchasePrompt({ product, dismissHref }: { product: ShelfProduct; dismissHref?: string }) {
  const href = preferredCheckoutUrl(product)
  return <section className={styles.purchasePrompt} aria-label="Compra solicitada">
    <div>
      <p className={styles.label}>Disponível para você</p>
      <h2>{product.title}</h2>
      <p>{href ? 'Continue para o checkout e libere este material.' : 'Este material ainda não está disponível para compra.'}</p>
    </div>
    <div className={styles.promptActions}>
      {href ? <a className={styles.action} href={href} target="_blank" rel="noopener noreferrer">Comprar {product.title}</a> : <span className={styles.unavailable}>Compra indisponível</span>}
      {dismissHref && <Link href={dismissHref} className={styles.dismiss}>Voltar ao acervo</Link>}
    </div>
  </section>
}
