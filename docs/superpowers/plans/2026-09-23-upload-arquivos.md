# Upload direto de arquivos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. No commits, push or deploy.

**Goal:** Enviar arquivos do formulário do item diretamente ao bucket público arquivos e preencher Link.

**Architecture:** Uma action recebe somente productId, nome e tamanho, exige requireOwnProduct e gera createSignedUploadUrl. Um formulário cliente usa uploadToSignedUrl e mantém o Link editável. Progresso indeterminado com etapas reais (preparando/enviando/concluído), pois o SDK não oferece callback de bytes.

**Tech Stack:** Next.js 16.3.5, React 19, Supabase JS, Vitest/happy-dom.

**Spec:** Requisitos completos da mensagem do usuário nesta tarefa; escopo limitado ao upload de arquivos de itens.

## Global Constraints

- Bucket arquivos público existente; nenhuma alteração de bucket, download do aluno, capas, schema, migrações, email ou webhook.
- Extensões pdf, zip, doc, docx, xls, xlsx, png, jpg, jpeg; limite 50 * 1024 * 1024 bytes no cliente e servidor.
- Pasta crypto.randomUUID por upload, nome sanitizado preservando extensão; upsert false.
- Autenticação/admin e produto da loja ativa via requireOwnProduct antes da assinatura.
- Nenhum arquivo binário deve passar pela action, nem haver mudança no limite de Server Actions.
- Sem commit/push/deploy. Usuário autorizou execução autônoma e dispensa nova aprovação de plano.

## Review Focus

- Loja/produto alheio não pode obter assinatura.
- Tamanho NaN/negativo, nome vazio, caminho e extensão maiúscula têm tratamento definido.
- Falha de assinatura/upload mantém URL anterior e permite tentar novamente.
- Salvar durante upload deve ficar bloqueado, incluindo submit por Enter.
- Arquivo 10,5 MB vai direto ao Storage; input file sem name evita inclusão na action salvar.

### Task 1: assinatura e validação

**Files:** src/lib/admin/item-upload.ts (novo), src/lib/data/products-admin.ts, src/app/admin/(painel)/produtos/actions.ts, tests/admin/item-upload.test.ts (novo).

**Interfaces:** validateItemUpload(name: unknown, size: unknown): string | null compartilhada; ItemUploadTicket com path, token, publicUrl, supabaseUrl, publishableKey; prepararUploadArquivo(productId: string, name: string, size: number): Promise<{ data: ItemUploadTicket; error?: never } | { error: string; data?: never }>. createItemUpload(name: string, size: number): Promise<ItemUploadTicket> na camada de dados. Apenas chave publicável sai do servidor; nunca secret.

- [x] Escrever testes da action reais, mockando auth/contexto e fronteira Storage: não admin, produto alheio, extensão inválida, >50MB, exatamente 50MB, nomes iguais geram paths distintos, sanitização, falha Storage em português.
- [x] Executar `npm test -- tests/admin/item-upload.test.ts` antes da implementação e guardar RED.
- [x] Implementar validação compartilhada, assinatura e action. Preservar redirects de auth fora do catch de erros operacionais. Dados inválidos retornam erro em português. Usar createSignedUploadUrl(path, { upsert: false }).
- [x] Executar teste focado até GREEN e relatar evidências.

### Task 2: formulário cliente

**Files:** src/app/admin/(painel)/produtos/item-fields.tsx (novo), content-editor.tsx, tests/admin/item-upload-ui.test.ts (novo).

**Interfaces:** ItemFields({moduleId, productId, item?}); consome prepararUploadArquivo e validateItemUpload. Usar createClient de @supabase/supabase-js com URL/chave publicável do ticket e auth sem persistência/refresh; storage.from('arquivos').uploadToSignedUrl(path, token, file).

- [x] Escrever teste happy-dom do ContentEditor/formulário real: escolher arquivo, aguardar upload resolvido, verificar input[name=url] com URL pública e edição manual posterior. Cobrir validação local, falhas preservando Link, retry e submit bloqueado durante envio.
- [x] Rodar teste e registrar RED antes de extrair ItemFields ou adicionar implementação.
- [x] Extrair somente ItemFields como componente cliente; manter todos os campos/actions atuais. Botão type=button abre input file sem name, accept restrito, label claro. Preparação/enviando com role=status e progress indeterminado acessível; sucesso preenche URL; erro role=alert em português. Não enviar file à action.
- [x] Rodar testes focados até GREEN e relatar evidências.

### Task 3: revisão e validação

- [x] Revisão independente de conformidade e qualidade após cada tarefa; corrigir defeitos reais com testes.
- [x] Validar UI pelo agent-browser Vercel em servidor local, usando fixture Supabase local quando não houver sessão admin disponível. Diferenciar explicitamente simulação de upload real.
- [x] Revisão final ampla de diff e restrições.
- [x] Transferir somente arquivos desta tarefa ao workspace original preservando mudanças preexistentes e validar nele: `npm test`, `npx tsc --noEmit`, `npm run lint`.
- [x] Relatório curto em português com arquivos, RED/GREEN, saídas resumidas e riscos residuais.
