export function ShelfSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="aspect-video max-h-[72vh] w-full bg-superficie sm:aspect-[21/9]" />
      {[0, 1].map((row) => (
        <div key={row} className="mt-8 px-4 sm:px-8">
          <div className="mb-3 h-5 w-40 rounded bg-superficie-2" />
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <div key={card} className="aspect-[2/3] w-[40%] shrink-0 rounded-md bg-superficie sm:w-[26%] md:w-[20%] lg:w-[15%]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
