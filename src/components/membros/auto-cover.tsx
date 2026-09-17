import { coverGradient } from '@/lib/content/cover'

const ASPECT = { poster: 'aspect-[2/3]', banner: 'aspect-video', episode: 'aspect-video' } as const

export function AutoCover({
  seed,
  title,
  imageUrl,
  aspect,
  muted = false,
  className = '',
}: {
  seed: string
  title: string
  imageUrl: string | null
  aspect: keyof typeof ASPECT
  muted?: boolean
  className?: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-superficie-2 ${ASPECT[aspect]} ${className}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" className={`h-full w-full object-cover ${muted ? 'opacity-40 grayscale' : ''}`} />
      ) : (
        <div className={`flex h-full w-full items-end p-3 ${muted ? 'opacity-50' : ''}`} style={{ backgroundImage: coverGradient(seed) }}>
          {title && <span className="line-clamp-3 text-sm leading-tight font-bold text-texto sm:text-base">{title}</span>}
        </div>
      )}
    </div>
  )
}
