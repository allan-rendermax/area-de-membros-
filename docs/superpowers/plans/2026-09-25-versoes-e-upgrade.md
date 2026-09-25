# Versões e modal de upgrade — Implementation Plan

> **For agentic workers:** Use executing-plans para execução nativa, com revisão independente ao final.

**Goal:** Exibir apenas a versão comprada e oferecer upgrade em um modal configurável.
**Architecture:** Produto define organização em versões ou seções. Uma função de acesso compartilhada protege página, arquivo e progresso. O servidor envia ao modal somente informações comerciais, nunca os links bloqueados.
**Tech Stack:** Next.js 16, React 19, Supabase, Tailwind, Vitest.
**Spec:** Pedido do usuário nesta conversa: Completo vê apenas Completo; Básico vê seu material e uma chamada para Completo; imagem quadrada e botão/checkout editáveis.

## Global Constraints
- Preservar layout aprovado e navegação capa → conteúdo.
- Preservar nomes personalizados; nomes genéricos viram Básico/Completo conforme o nível salvo, nunca pela posição da lista.
- Produtos novos: Front sugere versões, complementares sugerem seções; packs podem escolher seções.
- Produtos antigos sem seção Completo permanecem em seções para não interromper compras existentes.
- Prévia administrativa pode ver ambas as versões; nenhuma compra é concedida por clicar no checkout.
- Checkout ausente mostra orientação de suporte, sem inventar URL.

## Review Focus
- Completo não consegue abrir Básico por link direto no modo versões.
- Básico nunca recebe URLs/IDs de itens bloqueados no HTML ou props do modal.
- Renomear/reordenar não altera níveis de acesso.
- Modal funciona por teclado, restaura foco e respeita movimento reduzido.
- Migração não deixa produtos antigos de um único nível sem conteúdo.

### Task 1: Configuração e regras de acesso
Files: `src/lib/domain/types.ts`, `src/lib/admin/forms.ts`, `src/lib/data/products.ts`, `src/lib/data/products-admin.ts`, `src/lib/access/product-content.ts`, `supabase/migrations/20260925010000_product_versions_upgrade.sql`.
- [x] Testar matriz com `expect(canAccessProductModule('complete', 'basic', 'versions')).toBe(false)` e equivalentes para seções e prévia.
- [x] Criar campos content_mode, upgrade_image_url, upgrade_button_text; modo migrado versions apenas em front que já possui seção complete.
- [x] Validar enums, URLs e texto do botão com limite de 80 caracteres.
- [x] Aplicar a função a página de produto, item, download e progresso; preservar negação antes de assinar arquivos/gravar progresso.

### Task 2: Admin e modal
Files: `src/app/admin/(painel)/produtos/{product-form,content-editor,actions}.tsx`, `src/components/membros/{product-upgrade,lesson-sidebar,item-content}.tsx`.
- [x] Formulário oferece organização, imagem de upgrade (até 2 MB), texto e URL do checkout.
- [x] Editor sugere primeiro Básico e depois Completo com níveis correspondentes; nomes continuam editáveis.
- [x] Modal reutiliza Modal acessível existente, imagem aspect-square object-contain, fallback capa e botão abaixo.
- [x] Botão usa `motion-safe:hover:scale-[1.03]`, transição curta e foco visível. Fechar por botão/Escape/backdrop.
- [x] Renderizar chamada de upgrade na lista de conteúdos; remover cartão duplicado no corpo principal.
- [x] Testar abertura, fechamento, texto personalizado e checkout seguro.

### Task 3: Verificação e publicação
- [x] Executar `npm test`, `npm run lint`, `npm run build`; corrigir regressões reais.
- [x] Revisão independente de autorização e vazamento de material.
- [x] Aplicar migração aditiva antes da aplicação e verificar configuração existente.
- [ ] Commit somente arquivos desta mudança, publicar usando autorização prévia e verificar produção.

## Execution notes
- Autorização explícita para implementar e publicar já fornecida pelo usuário; execução direta nesta sessão.
- Atlas atual já tem níveis basic e complete corretos; checkout de upgrade está vazio. Pergunta enviada sem bloquear configuração.

- Revisão independente corrigiu migração para exigir módulo Completo publicado com arquivo/link publicado. Migração aplicada em transação no projeto existente; apenas Atlas Patologias convertido.
- Verificação: 828 testes/106 arquivos passaram; build passou; ESLint src/tests sem erros. Lint global tem avisos preexistentes de skills locais.
