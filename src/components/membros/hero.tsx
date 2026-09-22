import Link from 'next/link'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'
import { LockIcon, PlayIcon } from './icons'

export function Hero({ product, storeSlug }: { product: ShelfProduct; storeSlug: string }) {
  const href = product.unlocked ? `/${storeSlug}/produto/${product.slug}` : `/${storeSlug}?comprar=${product.slug}`
  return (
    <section className="relative">
      <AutoCover seed={product.id} title="" imageUrl={product.bannerUrl ?? product.coverUrl} aspect="banner" className="max-h-[72vh] w-full rounded-none sm:aspect-[21/9]" eager />
      <div className="absolute inset-0 bg-gradient-to-t from-fundo via-fundo/40 to-transparent" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-fundo/80 via-transparent to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-8 sm:px-8 sm:pb-14">
        <h1 className="max-w-2xl text-3xl leading-tight font-extrabold sm:text-5xl">{product.title}</h1>
        {product.description && <p className="mt-3 line-clamp-3 max-w-xl text-sm text-texto-suave sm:text-base">{product.description}</p>}
        <Link href={href} className="mt-5 inline-flex items-center gap-2 rounded-md bg-destaque px-6 py-3 font-semibold text-texto hover:bg-destaque-hover">
          {product.unlocked ? <PlayIcon /> : <LockIcon />}
          {product.unlocked ? 'Acessar' : 'Quero acessar'}
        </Link>
      </div>
    </section>
  )
}
