import type { ModuleWithItems } from '@/lib/domain/types'

export function LockedModules({ modules }: { modules: ModuleWithItems[] }) {
  if (modules.length === 0) return null
  return <section className="mt-9" aria-label="Módulos bloqueados">
    <h2 className="mb-4 text-xl font-bold">Módulos da versão completa</h2>
    <ul className="space-y-3">{modules.map((module) => <li key={module.id} className="rounded-xl border border-borda bg-superficie p-4">
      <span className="font-semibold">{module.title}</span>
      <span className="ml-3 text-sm text-texto-suave">{module.items.length} {module.items.length === 1 ? 'conteúdo bloqueado' : 'conteúdos bloqueados'}</span>
    </li>)}</ul>
  </section>
}
