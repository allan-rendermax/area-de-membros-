# Planos Payt por checkout — implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Executar as tarefas em sequência, com revisão independente.

**Goal:** Publicar Urbanismo com planos reconhecidos por checkout e preservar os acessos existentes.

**Architecture:** Adicionar identificação configurável às ofertas e vincular o plano ao pedido numa operação atômica. Todos os consumidores de acesso usam o vínculo persistido; fallback por código existe somente no modo legado. Admin e importador configuram regras reutilizáveis.

**Tech Stack:** Next.js 16.3.5, React, TypeScript, Supabase/PostgreSQL, Vitest/PGlite, scripts Node.

**Spec:** docs/superpowers/specs/2026-10-23-planos-por-checkout.md

## Global Constraints

- Não migrar produtos/pedidos existentes para identificação por checkout.
- Nenhuma regra LG5BGY, título, preço ou URL de Urbanismo fixa no código da aplicação.
- Links de eventos são dados autenticados; nenhuma chamada remota para resolver links no processamento.
- Proteções por loja, titularidade, precedência de status, arquivos privados e inbox/cron permanecem.
- Somente um implementador altera este worktree por vez. Sem subagentes internos do implementador.
- Produção somente após validação e revisão; usuário já autorizou publicação.

## Review Focus

- Pedido pago sem plano seguido de reenvio válido com mesmo status deve adquirir o plano uma vez.
- Reembolso sem checkout ou com identificador divergente deve retirar o acesso daquele pedido, sem mudar de plano.
- Bump do mesmo grupo não herda identificador do principal; duplicatas conflitantes não podem ampliar direitos.
- Fallback de login, notificações, success RPC e liberação manual não pode voltar a usar código compartilhado indistintamente.
- Edição concorrente/aliases sobrepostos e associação entre lojas não podem produzir regras ambíguas.

### Task 1: Persistência e execução de planos

**Files:** nova migration supabase/migrations/20261023010000_checkout_plans.sql; src/lib/payt/{parse,checkout}.ts; src/lib/domain/types.ts; src/lib/orders/process-postback.ts; src/lib/data/{postback-repo,products,orders}.ts; src/lib/access/access.ts; testes correspondentes e helpers/fakes.

**Interfaces:**
- Offers: match_type = product|checkout|upsell (default product); checkout_code text nullable (referência); match_values text[] default vazio.
- Orders: offer_id uuid nullable e metadados do identificador; leitura OrderRef.offerId e ProductLink.offerId/matchType.
- Parser: PaytProductLine.checkoutUrl e upsellCode opcionais, normalizados e somente da própria linha.
- Nova RPC atômica apply_payt_order_status recebe dados existentes e identificadores próprios; retorna pedido persistido, mudança, status, offer_id e aviso de identificação. Manter apply_order_status legado operacional para produtos antigos.
- PostbackRepo deve usar resolução/persistência atômica no banco e produtos do plano persistido para avisos; mocks antigos podem ser atualizados sem remover testes.
- save_offer_group_atomic preserva assinatura e aceita match_type/checkout_code/match_values em p_plans, ausentes significam modo legado.

- [x] Escrever testes novos com código compartilhado SHARED, dois aliases/planos e concessões basic/complete. Exemplo: expect(grantedProductLevels([{productCode:'SHARED',offerId:'basic',status:'pago'}],[{productCode:'SHARED',offerId:'basic',matchType:'checkout',productId:'atlas',grantLevel:'basic'},{productCode:'SHARED',offerId:'full',matchType:'checkout',productId:'atlas',grantLevel:'complete'}],false).get('atlas')).toBe('basic').
- [x] Executar testes e registrar falha antes de implementar.
- [x] Criar migração e núcleo conforme spec. Cobrir SQL real para vínculos, validação de aliases, conflitos/reembolsos, resolução tardia, manual, exclusão e success RPC.
- [x] Atualizar consumidores de acesso/login/e-mails de forma coerente, sem fallback em planos específicos. Adicionar testes de ponta a ponta em memória com notificações falsas.
- [x] Rodar testes focados, suite completa com maxWorkers=2 e tsc; corrigir falhas. Commit feat: resolve Payt plans by checkout without changing legacy access.
- [x] Reportar contrato exato das interfaces e evidência RED/GREEN ao controlador.

### Task 2: Cadastro administrativo e importação

**Files:** src/lib/admin/offer-groups.ts; src/lib/data/offer-groups.ts; src/app/admin/(painel)/ofertas/offer-group-form.tsx; telas de pedidos/avisos se necessário; scripts/lib/cadastro-{plano,executor,pasta}.mjs; docs/ofertas-com-planos.md; docs/como-cadastrar-produto.md; docs/diretrizes-da-plataforma.md; testes admin/cadastro.

**Interfaces:** Consumir match_type, checkout_code e match_values da Task 1. OfferPlanInput expõe matchType, checkoutCode e matchValues. Planos sem campos são product.

- [x] Adicionar testes que aceitam código compartilhado com matchValues distintos, rejeitam mistura product/checkout e sobreposição, e preservam planos legados.
- [x] Implementar modo de identificação, código checkout de referência e aliases na interface. O seletor de produtos e níveis continua igual. Dados de erro ficam no formulário.
- [x] Implementar ficha por pasta com campos explícitos para cada nível: produto_payt compartilhado, codigo_checkout_basico/completo/upgrade, links_checkout_basico/completo/upgrade (aliases separados por vírgula); documentação deve indicar campos realmente suportados. Não confundir checkout_upgrade (botão) com identificador comercial. Oferecer alternativa genérica planos.json se necessária para upsell/combos, com validação antes de rede.
- [x] Preflight e gravação do importador usam identidade completa do plano e agrupamento correto; reexecução não altera outros produtos. Códigos distintos antigos continuam aceitos.
- [x] Conferir tela administrativa com fixture local e testes. Testes focados, tsc, suite completa e commit feat: configure checkout plans in admin and folder imports.

### Task 3: Revisão e publicação

**Files:** docs/status-cadastro-urbanismo-2026-10-23.md e artefatos de operação fora de fontes versionadas.

- [x] Revisão independente da branch e correção de achados reais com testes.
- [x] Build/lint e plano de aplicação sobre origin/main conferidos. Snapshot somente leitura de ofertas/vínculos/produtos atuais.
- [x] Confirmar formato de identificador em eventos autenticados Payt e mapear aliases oficiais já observados no painel.
- [x] Aplicar migration em transação e publicar aplicação. Criar grupo de três planos Urbanismo, com um produto LG5BGY e referências R272NA/LJPMZ2/R6GZ2X. Configurar postback da área de membros, preservando integrações atuais.
- [x] Publicar produto somente após plano e entrega válidos. Validar Básico/Completo em simulação, acesso privado sem compra, modo legado preservado e teste de conexão.
- [x] Salvar evidências e documentação final, sem credenciais ou dados de clientes.
