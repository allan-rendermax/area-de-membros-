import Link from 'next/link'
import type { ShelfProduct } from '@/lib/access/access'
import { AutoCover } from './auto-cover'

export const POSTER_WIDTH = 'w-[40%] shrink-0 snap-start sm:w-[26%] md:w-[20%] lg:w-[15%]'

export function PosterLink({ product, href }: { product: ShelfProduct; href: string }) {
  return (
    <Link href={href} className={`${POSTER_WIDTH} group block transition-transform duration-200 hover:scale-[1.04]`}>
      <AutoCover seed={product.id} title={product.title} imageUrl={product.coverUrl} aspect="poster" />
      <p className="mt-2 line-clamp-2 text-sm text-texto-suave group-hover:text-texto">{product.title}</p>
    </Link>
  )
}
