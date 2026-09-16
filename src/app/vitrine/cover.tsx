type CoverProps = { title: string; coverUrl: string | null; muted?: boolean }

// Capa em formato de livro técnico: lombada escura à esquerda.
// Sem imagem cadastrada, gera uma capa tipográfica com o título.
export function Cover({ title, coverUrl, muted = false }: CoverProps) {
  return (
    <div className="@container relative aspect-[3/4] overflow-hidden rounded-[3px] bg-tinta shadow-[0_1px_0_rgb(29_41_53/0.25),0_8px_18px_-10px_rgb(29_41_53/0.45)]">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className={`h-full w-full object-cover ${muted ? 'opacity-45 grayscale' : ''}`}
        />
      ) : (
        <div className={`flex h-full flex-col justify-end p-4 pl-6 ${muted ? 'bg-tinta-suave' : 'bg-tinta'}`}>
          <span className="text-[clamp(1.1rem,12cqw,2.2rem)] leading-[1.02] font-bold text-papel [font-stretch:72%] text-balance">
            {title}
          </span>
          <span className="mt-3 block h-[3px] w-10 bg-sinal" aria-hidden />
        </div>
      )}
      <span className="absolute inset-y-0 left-0 w-2 bg-black/25" aria-hidden />
    </div>
  )
}
