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

export function LessonSkeleton() {
  return (
    <main className="lesson-workspace mx-auto w-full max-w-[1440px] px-4 pt-7 pb-24 sm:px-8 sm:pt-10 lg:px-10" role="status" aria-busy="true">
      <span className="sr-only">Carregando material…</span>
      <div className="lesson-workspace-grid grid min-w-0 gap-8 animate-pulse lg:grid-cols-[minmax(0,1fr)_minmax(290px,34%)] xl:gap-10" aria-hidden="true">
        <div className="min-w-0">
          <div className="lesson-heading flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 rounded-full border border-borda bg-superficie" />
            <div className="min-w-0 flex-1 space-y-3 pt-1">
              <div className="h-3 w-28 rounded bg-superficie-2" />
              <div className="h-9 w-4/5 rounded bg-superficie" />
              <div className="h-4 w-48 max-w-full rounded bg-superficie-2" />
            </div>
          </div>
          <div className="mt-7 aspect-video overflow-hidden rounded-xl border border-borda bg-superficie" />
          <div className="mt-9 h-7 w-48 rounded bg-superficie-2" />
          <div className="mt-5 h-16 rounded-xl border border-borda bg-superficie" />
        </div>
        <aside className="space-y-4">
          <div className="h-6 w-36 rounded bg-superficie-2" />
          <div className="space-y-3 rounded-xl border border-borda bg-superficie p-5">
            <div className="h-4 w-3/4 rounded bg-superficie-2" />
            <div className="h-10 rounded bg-superficie-2" />
            <div className="h-10 rounded bg-superficie-2" />
          </div>
        </aside>
      </div>
    </main>
  )
}
