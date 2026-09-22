import Image from 'next/image'
import { isOptimizableImage } from '@/lib/content/image'

export function ContentImage({
  src,
  sizes,
  eager = false,
  className,
}: {
  src: string
  sizes: string
  eager?: boolean
  className?: string
}) {
  const loading = eager ? 'eager' : 'lazy'
  const fetchPriority = eager ? 'high' : undefined

  if (isOptimizableImage(src)) {
    return (
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        className={className}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      className={className}
    />
  )
}
