import { ui } from '@/components/admin/ui'
import type { Item, ModuleWithItems } from '@/lib/domain/types'
import { excluirItem, excluirModulo, moverItem, moverModulo, salvarItem, salvarModulo } from './actions'

const KIND_LABEL = { arquivo: 'Arquivo', video: 'Vídeo', link: 'Link' } as const

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  )
}

function MoveButtons({
  action,
  hidden,
  first,
  last,
  label,
}: {
  action: (form: FormData) => Promise<void>
  hidden: Record<string, string>
  first: boolean
  last: boolean
  label: string
}) {
  return (
    <form action={action} className="flex gap-1">
      <Hidden values={hidden} />
      <button type="submit" name="direcao" value="up" disabled={first} aria-label={`Subir ${label}`} className={`${ui.buttonGhost} px-2 disabled:opacity-40`}>↑</button>
      <button type="submit" name="direcao" value="down" disabled={last} aria-label={`Descer ${label}`} className={`${ui.buttonGhost} px-2 disabled:opacity-40`}>↓</button>
    </form>
  )
}

function ConfirmDelete({ action, hidden, question }: { action: (form: FormData) => Promise<void>; hidden: Record<string, string>; question: string }) {
  return (
    <details className="relative">
      <summary className={`${ui.buttonDanger} cursor-pointer list-none`}>Excluir</summary>
      <form action={action} className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-borda bg-superficie p-3 text-sm shadow-xl">
        <Hidden values={hidden} />
        <p>{question}</p>
        <button type="submit" className={`${ui.buttonDanger} mt-3 w-full`}>Confirmar exclusão</button>
      </form>
    </details>
  )
}

function ItemFields({ moduleId, productId, item }: { moduleId: string; productId: string; item?: Item }) {
  return (
    <form action={salvarItem} className="grid gap-3 sm:grid-cols-2">
      <Hidden values={{ id: item?.id ?? '', module_id: moduleId, product_id: productId }} />
      <label className={ui.label}>Título<input name="title" required defaultValue={item?.title} className={ui.input} /></label>
      <label className={ui.label}>
        Tipo
        <select name="kind" defaultValue={item?.kind ?? 'arquivo'} className={ui.input}>
          <option value="arquivo">Arquivo (PDF, Drive…)</option>
          <option value="video">Vídeo (YouTube, Vimeo, Panda)</option>
          <option value="link">Link externo</option>
        </select>
      </label>
      <label className={`${ui.label} sm:col-span-2`}>Link<input name="url" type="url" required defaultValue={item?.url} className={ui.input} /></label>
      <label className={`${ui.label} sm:col-span-2`}>
        Capa (opcional, link de imagem)
        <input name="cover_url" type="url" defaultValue={item?.coverUrl ?? ''} className={ui.input} />
      </label>
      <label className={ui.checkbox}>
        <input name="is_published" type="checkbox" defaultChecked={item?.isPublished ?? true} /> Publicado
      </label>
      <button type="submit" className={`${ui.button} justify-self-start`}>{item ? 'Salvar item' : 'Adicionar item'}</button>
    </form>
  )
}

export function ContentEditor({ productId, modules }: { productId: string; modules: ModuleWithItems[] }) {
  return (
    <div className="flex flex-col gap-4">
      {modules.length === 0 && (
        <p className={ui.notice}>Nenhum módulo ainda. Crie o primeiro abaixo — produto com um módulo só não mostra a divisão para o cliente.</p>
      )}

      {modules.map((m, moduleIndex) => (
        <section key={m.id} className={`${ui.card} p-4`}>
          <div className="flex flex-wrap items-end gap-3">
            <form action={salvarModulo} className="flex flex-1 flex-wrap items-end gap-3">
              <Hidden values={{ id: m.id, product_id: productId }} />
              <label className={`${ui.label} min-w-48 flex-1`}>Módulo<input name="title" required defaultValue={m.title} className={ui.input} /></label>
              <label className={ui.checkbox}><input name="is_published" type="checkbox" defaultChecked={m.isPublished} /> Publicado</label>
              <button type="submit" className={ui.buttonGhost}>Salvar</button>
            </form>
            <MoveButtons action={moverModulo} hidden={{ id: m.id, product_id: productId }} first={moduleIndex === 0} last={moduleIndex === modules.length - 1} label={m.title} />
            <ConfirmDelete action={excluirModulo} hidden={{ id: m.id, product_id: productId }} question={`Excluir o módulo e os ${m.items.length} itens dele?`} />
          </div>

          <ul className="mt-4 divide-y divide-borda rounded-md border border-borda">
            {m.items.map((item, itemIndex) => (
              <li key={item.id} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`${ui.pill} bg-superficie-2 text-texto-suave`}>{KIND_LABEL[item.kind]}</span>
                  <span className={`flex-1 ${item.isPublished ? '' : 'text-texto-suave line-through'}`}>{item.title}</span>
                  <MoveButtons
                    action={moverItem}
                    hidden={{ id: item.id, module_id: m.id, product_id: productId }}
                    first={itemIndex === 0}
                    last={itemIndex === m.items.length - 1}
                    label={item.title}
                  />
                  <ConfirmDelete action={excluirItem} hidden={{ id: item.id, product_id: productId }} question={`Excluir "${item.title}"?`} />
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-texto-suave hover:text-texto">Editar</summary>
                  <div className="mt-3">
                    <ItemFields moduleId={m.id} productId={productId} item={item} />
                  </div>
                </details>
              </li>
            ))}
            {m.items.length === 0 && <li className="p-3 text-sm text-texto-suave">Nenhum item neste módulo.</li>}
          </ul>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-destaque">+ Novo item</summary>
            <div className="mt-3">
              <ItemFields moduleId={m.id} productId={productId} />
            </div>
          </details>
        </section>
      ))}

      <form action={salvarModulo} className={`${ui.card} flex flex-wrap items-end gap-3 p-4`}>
        <Hidden values={{ product_id: productId, is_published: 'on' }} />
        <label className={`${ui.label} min-w-48 flex-1`}>
          Novo módulo
          <input name="title" required placeholder="Ex.: Módulo 1 — Fissuras" className={ui.input} />
        </label>
        <button type="submit" className={ui.button}>Criar módulo</button>
      </form>
    </div>
  )
}
