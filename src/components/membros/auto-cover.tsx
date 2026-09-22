import { coverGradient } from '@/lib/content/cover'
import { ContentImage } from './content-image'

const ASPECT = { poster: 'aspect-[2/3]', banner: 'aspect-video', episode: 'aspect-video' } as const
const SIZES = {
  poster: '(max-width: 639px) 40vw, (max-width: 767px) 26vw, (max-width: 1023px) 20vw, 15vw',
  banner: '100vw',
  episode: '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw',
} as const

export function AutoCover({
  seed,
  title,
  imageUrl,
  aspect,
  muted = false,
  className = '',
  eager = false,
  sizes,
}: {
  seed: string
  title: string
  imageUrl: string | null
  aspect: keyof typeof ASPECT
  muted?: boolean
  className?: string
  eager?: boolean
  sizes?: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-superficie-2 ${ASPECT[aspect]} ${className}`}>
      {imageUrl ? (
        <ContentImage
          src={imageUrl}
          sizes={sizes ?? SIZES[aspect]}
          eager={eager}
          className={`h-full w-full object-cover ${muted ? 'opacity-40 grayscale' : ''}`}
        />
      ) : (
        <div className={`flex h-full w-full items-end p-3 ${muted ? 'opacity-50' : ''}`} style={{ backgroundImage: coverGradient(seed) }}>
          {title && <span className="line-clamp-3 text-sm leading-tight font-bold text-texto sm:text-base">{title}</span>}
        </div>
      )}
    </div>
  )
}
