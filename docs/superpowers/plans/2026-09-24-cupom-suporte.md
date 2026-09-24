# Cupom e suporte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Oferecer resgate de desconto de aluno configurável, contatos de suporte e login semanticamente acessível, preservando a interface aprovada.
**Architecture:** Campo nullable de checkout promocional atravessa domínio, persistência e vitrine. LockedPoster usa dois estágios num diálogo sequencial. MaterialHelp reutiliza o WhatsApp existente e oferece o e-mail informado.
**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, Supabase SQL, Vitest/happy-dom, agent-browser.
**Spec:** docs/superpowers/specs/2026-09-24-cupom-suporte-design.md

## Global Constraints

- Manter Clique aqui para download, home, produto mobile, item e cabeçalho.
- Sem links fictícios em produção, sem criar cupom ou alterar provedor, sem publicação ou migração remota.
- Usar o link completo de cupom confirmado pelo administrador; desconto anunciado apenas com esse link configurado.
- E-mail grupoelevamax@gmail.com é suporte; não alterar entrega de e-mails.
- Ler guias relevantes em node_modules/next/dist/docs antes de código.
- Usar worktree C:/Users/arqal/.codex/worktrees/cupom-suporte-membros/Area de membros. Não editar checkout original.

## Review Focus

- Cupom ausente/inválido: não prometer desconto ou criar link perigoso (Task 1).
- Parâmetros de cupom/tracking/hash: preservar URL exatamente (Task 1).
- Modal: Tab, Shift+Tab, Escape, voltar e reabertura não perdem foco nem ficam presos (Task 1).
- Material adquirido e preview admin: não expor promoção/checkout (Task 1).
- WhatsApp vazio/inválido: e-mail disponível; URLs javascript rejeitadas (Task 2).

### Task 1: Fluxo de cupom configurável, da persistência ao modal

**Files:** src/lib/domain/types.ts, src/lib/access/access.ts, src/lib/admin/forms.ts, src/lib/data/products.ts, src/lib/data/products-admin.ts, src/app/admin/(painel)/produtos/product-form.tsx, src/app/admin/(painel)/clientes/[id]/vitrine/page.tsx, src/components/membros/locked-poster.tsx. Nova migration supabase/migrations/20260924000002_student_checkout.sql. Testes tests/admin/forms.test.ts, tests/access/shelf.test.ts, tests/membros/locked-poster.test.ts e teste de dados/migração focado novo se necessário.

**Interface:** studentCheckoutUrl?: string | null em Product/ShelfProduct para compatibilidade dos chamadores existentes; toProduct devolve string|null. ProductInput aceita string|null após parse, saveProduct persiste student_checkout_url. Nenhuma dependência de Task 2. Modal existente pode ser usado sem editar seu contrato.

- [x] Escrever testes que falhem antes da implementação: parse URL válida preservando query/hash, vazio null, javascript rejeitado; persistência e leitura do campo; buildShelf retorna null para adquirido; modal resgata cupom, usa href exato, volta, fecha por Escape, restaura foco, reabre pelos detalhes, acompanha comprar; link normal fallback; sem URL não há anúncio de 10%; preview limpa ambos os campos.
```ts
const promotional = 'https://checkout.example.test/item?coupon=ALUNO10&utm_source=members#payment'
expect(parseProductForm(formWith({ student_checkout_url: promotional }), 'store').studentCheckoutUrl).toBe(promotional)
expect(buildShelf([product('p', 1, { studentCheckoutUrl: promotional })], new Set(['p'])).unlocked[0].studentCheckoutUrl).toBeNull()
```
Adaptar auxiliares ao padrão dos arquivos de testes; testes devem exercitar comportamento e payload real, não apenas procurar strings no código.
- [x] Executar testes focados e registrar falhas reais.
- [x] Criar migration aditiva e configurar tipo, colunas, mapping, parse, save e form. Campo admin: Checkout de aluno com 10% de desconto; ajuda: Cole o link completo do checkout com o cupom de aluno de 10% já aplicado. Deixe vazio para não oferecer o desconto.
```sql
alter table public.products add column student_checkout_url text;
```
```ts
studentCheckoutUrl: optionalUrl(form, 'student_checkout_url', 'Checkout de aluno'),
student_checkout_url: input.studentCheckoutUrl ?? null,
```
- [x] UI sequencial: state do estágio detalhes/cupom, reset ao fechar/abrir/mudar comprar; validar URLs com isHttpUrl antes de renderizar. Primeiro botão Resgatar meu cupom de 10%, segundo estágio Seu desconto de aluno + produto + Você tem 10% de desconto neste material. + link Ir para o checkout com 10% de desconto. Voltar retorna aos detalhes; Fechar/Escape encerra. Um único diálogo acessível ativo, foco acompanha nova ação principal ao mudar estágio. href exato, target blank e noopener noreferrer. Fallback Quero acessar somente para checkout normal válido. Sem ambos: Este material ainda não está disponível para compra.
- [x] Testar migration em banco local PGlite ou teste SQL existente adequado; confirmar registros atuais intactos e novo campo null.
- [x] Executar testes focados até passar e auto-revisar diff; não executar suíte completa concorrente. Não mudar arquivos de suporte/login/fixture. Relatar evidências RED/GREEN. Controlador faz commit para evitar disputa de índice com Task 2.

### Task 2: Suporte preparado e região principal do login

**Files:** src/components/membros/material-help.tsx, src/lib/support/contact.ts (novo), src/app/admin/(painel)/lojas/store-form.tsx, src/app/[loja]/entrar/page.tsx, tests/membros/material-help.test.ts. Teste de login se já houver infraestrutura adequada; alteração semântica simples será validada por navegador/axe.

**Interface:** MaterialHelp mantém props href:string|null e context opcional. Novo SUPPORT_EMAIL constante. Não modificar tipos de domínio, forms parser, checkout ou outros arquivos da Task 1.

- [x] Atualizar testes de MaterialHelp com falha inicial para e-mail sempre disponível, WhatsApp válido identificado, link de suporte HTTP normal mantido, javascript rejeitado sem remover e-mail. Preservar orientações Downloads e aplicativo.
```ts
const html = renderToStaticMarkup(createElement(MaterialHelp, { href: null }))
expect(html).toContain('href="mailto:grupoelevamax@gmail.com"')
expect(html).not.toContain('href="https://wa.me/')
```
- [x] Rodar testes focados e observar falha; implementar constante e contato.
```ts
export const SUPPORT_EMAIL = 'grupoelevamax@gmail.com'
```
Validar href com isHttpUrl antes de classificar wa.me/api.whatsapp.com/www.whatsapp.com. E-mail visível literal com mailto, sem target blank obrigatório. Texto de ajuda orienta usar contatos abaixo em vez de buscar comprovante para suporte; comprovante pode permanecer na orientação para conferir e-mail de compra. Área de toque min-h-11.
- [x] No StoreForm, explicar que support_whatsapp é opcional e deve conter DDI+DDD+número; vazio mantém somente os outros canais. Não preencher número nem alterar configurações de produção.
- [x] Trocar div.member-login-panel por main com mesmas classes e fechamento correspondente; preservar todo o layout e sidebar. Confirmar nenhum main ancestral usando layout existente.
- [x] Rodar testes focados e auto-revisar. Nenhum teste novo para simples copy. Relatar RED/GREEN. Controlador faz commit após integração.

### Task 3: Revisão e validação integradas

**Files:** docs/qa/cupom-suporte/*; eventual fixture de QA local scripts/qa-members-browser-fixture.mjs apenas se necessário; docs/status-cupom-suporte-2026-09-24.md.

**Interfaces:** consome Tasks 1 e 2 prontas; nenhuma modificação em produto sem achado concreto.

- [x] Controlador cria diff de cada tarefa e despacha revisão de escopo/qualidade independente. Corrigir achados antes de conclusão.
- [x] Rodar npm test, npm run lint, npm run build e verificar exit codes. Baseline já contém avisos Vite e imagens de teste, registrar sem atribuir à mudança.
- [x] QA agent-browser em aplicativo local com provedor fictício: mobile 375x812 e desktop 1440x900, login/main/ajuda, WhatsApp ausente e presente via fixture, oferta com cupom e sem links, segundo modal, voltar/Escape/Tab, URL exata do checkout local com cupom e retorno ao catálogo. Sem compras reais. Screenshots para revisão visual, erros console e axe login.
- [x] Revisão final de toda mudança por agente independente. Registrar limites: desconto real requer link do provedor e migration antes de deploy.
- [x] Entregar resultado e instruções: Admin > Lojas > WhatsApp; Admin > Produtos > Checkout de aluno com 10% de desconto. Nenhum deploy neste pedido; produção permanece como estava.

