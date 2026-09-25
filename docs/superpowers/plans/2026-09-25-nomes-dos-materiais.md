# Nomes dos materiais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar o nome do produto no cabeçalho e como padrão do material, mantendo a edição individual no admin.

**Architecture:** Reutilizar `items.title`, sem migração. Uma função compartilhada resolve nomes vazios ou genéricos para o nome do produto. O formulário recebe o título do produto, preenche o campo existente e mantém o mesmo contrato de gravação.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Vitest, happy-dom.

**Spec:** Pedido explícito do usuário nesta tarefa em 25/09/2026: substituir “Seu conteúdo” pelo nome do produto; retirar “Seu acesso”; usar nome do produto no lugar de “Material principal”, com edição pelo admin. Preservar capa → conteúdo e o layout restaurado.

## Global Constraints

- Preservar cartão, lateral, ajuda, barra inferior e permissões Básico/Completo.
- Cabeçalho mostra somente o nome do produto, sem repeti-lo em subtítulo.
- Remover a linha inteira “Seu acesso: …” apenas da tela de conteúdo.
- Nomes personalizados existentes continuam válidos no cartão, lateral e formulário.
- Novos materiais recebem o nome do produto previamente preenchido; ao salvar, o campo é persistido como título do item. Não há renomeação automática de títulos personalizados após mudar o produto.
- Itens antigos chamados “Clique Aqui”, “Clique Aqui para …”, “Material principal” ou vazios usam o nome do produto como apresentação padrão.
- Não alterar dados reais, URLs, downloads, autenticação, progresso ou regras de acesso.
- Preservar alterações locais fora deste escopo.

## Review Focus

- Títulos antigos com caixa ou espaços variados: fallback consistente no admin e aluno.
- Nome customizado: gravação pelo campo `title` e apresentação sem sobrescrita.
- Nome longo: quebra de linha no cabeçalho, cartão e lateral; conferir desktop e celular.
- Produto com vários recursos: nomes explícitos preservados, sem mudanças de sequência.
- Acesso Básico: retirar o rótulo visual não libera os módulos restritos.

### Task 1: Nome padrão compartilhado e formulário de edição

**Files:**
- Create: `src/lib/content/material-title.ts`
- Modify: `src/app/[loja]/item/[id]/page.tsx`
- Modify: `src/app/admin/(painel)/produtos/[id]/page.tsx`
- Modify: `src/app/admin/(painel)/produtos/content-editor.tsx`
- Modify: `src/app/admin/(painel)/produtos/item-fields.tsx`
- Test: `tests/membros/material-title.test.ts`
- Test: `tests/membros/content-routes.test.ts`
- Test: `tests/admin/item-upload-ui.test.ts`

**Interfaces:**
- Consumes: `Item.title`, `Product.title`, campo existente `title` de `salvarItem`.
- Produces: `materialTitle(title: string | undefined, productTitle: string): string`.
- `ContentEditor` e `ItemFields` recebem `productTitle: string` obrigatório.

- [x] **Step 1: Escrever regressões antes de implementar.**

```ts
expect(materialTitle(' Clique Aqui ', 'Atlas')).toBe('Atlas')
expect(materialTitle('Material principal', 'Atlas')).toBe('Atlas')
expect(materialTitle('Plantas editáveis', 'Atlas')).toBe('Plantas editáveis')
expect(doc.querySelector('h1')?.textContent).toBe(product.title)
expect(doc.querySelector('.lesson-heading')?.textContent).not.toContain('Seu acesso:')
expect(doc.querySelector('aside')?.textContent).toContain(product.title)
expect(addForm().querySelector<HTMLInputElement>('[name="title"]')?.value).toBe('Atlas de teste')
expect(new FormData(itemForm()).get('title')).toBe('Plantas editáveis')
```

Cobrir arquivo e link com nomes genéricos, nomes personalizados existentes, campo editado e os testes existentes de bloqueios e navegação. Para o campo editado, alterar o valor do input antes de construir FormData.

- [x] **Step 2: Executar regressões.**

Run: `npx vitest run tests/membros/material-title.test.ts tests/membros/content-routes.test.ts tests/admin/item-upload-ui.test.ts`
Expected: FAIL nas novas expectativas de nome padrão, cabeçalho e campo preenchido.

- [x] **Step 3: Implementar a resolução compartilhada e a apresentação.**

```ts
export function materialTitle(title: string | undefined, productTitle: string): string {
  const value = title?.trim() ?? ''
  return !value || /^clique\s+aqui(?:\s+para\b.*)?[.!]?$/i.test(value) || /^material\s+principal$/i.test(value)
    ? productTitle
    : value
}
```

Na rota de item, aplicar `materialTitle(item.title, ctx.product.title)` ao mapear recursos. Usar `ctx.product.title` no h1 e remover subtítulo e linha de acesso. Manter filtragem de módulos autorizados e todos os componentes de navegação.

Na página admin, passar `productTitle={product.title}` para `ContentEditor`; este repassa a `ItemFields` e resolve os nomes apresentados na listagem. No formulário:

```tsx
<label className={ui.label}>Nome do material
  <input name="title" required defaultValue={materialTitle(item?.title, productTitle)} className={ui.input} />
  <span className="text-xs font-normal text-texto-suave">Por padrão, usamos o nome do produto. Você pode editar o nome visível no cartão e na lista de conteúdos.</span>
</label>
```

- [x] **Step 4: Verificar testes focados e validação geral.**

Run: `npm test` e `npm run build`, mais ESLint nos arquivos alterados e `git diff --check` no escopo.
Expected: PASS, sem erros de TypeScript, lint ou espaços inválidos nas alterações.

- [x] **Step 5: Revisão independente e publicação.**

Revisor somente leitura confere diff desde `4325400` contra este plano, enquanto o implementador realiza a validação visual. Corrigir achados relevantes antes de publicar. Commit apenas arquivos desta tarefa, push seguindo a publicação já autorizada nesta conversa, esperar Ready do Vercel e conferir tela autenticada em prévia. No admin real apenas inspecionar campos, sem salvar dados de demonstração.

Expected: nome do produto no h1 e cartão/lateral, sem rótulo de acesso; campo editável preenchido no admin; navegação e download preservados.


## Execution record

- Implementado nesta sessão conforme pedido explícito, sem nova rodada de autorização.
- Pré-verificação: uma tarefa integrada, sem conflitos de interfaces. O nome do produto é passado da página admin para o editor e o formulário.
- RED: sete expectativas de integração falharam antes das mudanças; helper inicialmente ausente. GREEN: 56 testes focados passaram.
- Revisão independente somente leitura: nenhuma regressão relevante em persistência, permissões ou navegação. Detectou variação de espaços internos em Material principal; corrigida com dois casos RED → GREEN.
- Validação final: 809 testes em 102 arquivos; build e ESLint aprovados.
- Publicação e conferência visual registradas em docs/estado-atual.md após conclusão.
