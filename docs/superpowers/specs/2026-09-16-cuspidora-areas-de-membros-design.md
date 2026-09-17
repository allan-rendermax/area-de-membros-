# Cuspidora de Áreas de Membros — Especificação de Design

**Data:** 16/09/2026
**Status:** partes 1–3 aprovadas em conversa; partes 4–5 aguardando revisão no documento
**Substitui em parte:** `2026-09-16-area-de-membros-design.md` (§4 modelo de dados, §7 vitrine, direção visual "prancheta técnica"). As demais decisões daquela spec continuam valendo.

## 1. Objetivo

Transformar a área de membros do Atlas numa **plataforma única com várias lojas**, onde lançar um produto novo (de qualquer nicho) é só cadastro, sem desenhar telas:

- visual fixo estilo Netflix, escuro, igual para todas as lojas;
- conteúdo organizado em produto → módulos → itens (arquivo, vídeo, link);
- Payt liberando produto principal **e bumps** do mesmo aviso;
- admin com avisos da Payt, registro/reenvio de e-mails e sucesso do cliente;
- login só com e-mail, reforçado contra robôs, com WhatsApp e instalação como app.

## 2. Decisões mantidas (não reabrir)

- Login do cliente **só com e-mail** (risco aceito). Admin com **código por e-mail** (aceita mais de 6 dígitos) e lista `ADMIN_EMAILS`.
- Entrega de arquivos **por link** (Drive ou similar), sem proteção de PDF.
- Site em `*.vercel.app`; domínio `grupoelevamax.com` **só para e-mail**.
- Acesso **calculado** a partir de pedidos pagos (nunca gravado) e status que **nunca retrocede**.
- URL do webhook continua `/api/webhooks/payt` (já validada em produção com a chave real).

## 3. Fora do escopo desta entrega (deixar o caminho aberto, sem construir)

| Futuro | O que já fica preparado |
|---|---|
| Importação de produto por ZIP ou skill que monta o produto | Produto/módulo/item com campos simples e ordem explícita; um importador só grava nessas tabelas |
| Importar clientes legados por CSV (ex.: Império Estoico) | Coluna `orders.source` (`payt` \| `importado` \| `manual`) |
| Biblioteca de cores metálicas | Todas as cores em um único arquivo de tokens de tema |
| Certificados | Registro de acesso por item permite calcular "concluiu" depois |
| Domínio/subdomínio por loja | Loja identificada por `slug`; trocar o caminho por subdomínio não muda o banco |
| Suspender acesso em pedido de reembolso/disputa | Status desconhecidos já ficam registrados em `payt_events` |

## 4. Lojas, endereços e dados (Parte 1 — aprovada)

### 4.1 Endereços

| Endereço | Conteúdo |
|---|---|
| `/` | Redireciona para `/{DEFAULT_STORE_SLUG}` |
| `/entrar` | Redireciona para `/{DEFAULT_STORE_SLUG}/entrar` (mantém links já enviados) |
| `/[loja]/entrar` | Login da loja |
| `/[loja]` | Vitrine |
| `/[loja]/produto/[slug]` | Página do produto |
| `/[loja]/item/[id]` | Abre item (arquivo/link: registra e redireciona; vídeo: player) |
| `/[loja]/manifest.webmanifest` | Manifesto do app instalável da loja |
| `/admin/...` | Admin único com seletor de loja |
| `/api/webhooks/payt` | Webhook único |

Slugs reservados (não podem ser loja): `admin`, `api`, `entrar`, `sair`, `_next`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, `icons`.

Sessão do cliente é **global** (uma conta por e-mail). Cada loja mostra só os produtos dela. Cliente sem pedido pago na loja vê o estado vazio com WhatsApp.

### 4.2 Modelo de dados

| Tabela | Campos | Observações |
|---|---|---|
| `stores` | `id`, `slug` (único), `name`, `logo_url`, `support_whatsapp`, `support_url`, `login_image_url`, `created_at` | `primary_color` removida (visual fixo) |
| `products` | `id`, `store_id`, `slug` (único por loja), `title`, `description`, `cover_url` (2:3), `banner_url` (16:9), `checkout_url`, `is_featured`, `sort_order`, `is_published`, `created_at`, `updated_at` | Substitui `materials` |
| `modules` | `id`, `product_id`, `title`, `sort_order`, `is_published`, timestamps | Produto com 1 módulo não mostra a divisão |
| `items` | `id`, `module_id`, `title`, `kind` (`arquivo` \| `video` \| `link`), `url`, `cover_url`, `sort_order`, `is_published`, timestamps | `url` nunca vai para o HTML da vitrine |
| `offers` | `id`, `store_id`, `name`, `payt_product_code` (**único global**), `created_at` | Uma conta Payt para todas as lojas |
| `offer_products` | `offer_id`, `product_id` | Substitui `offer_materials` |
| `customers` | sem mudança | Conta global |
| `orders` | + `source` (default `payt`); `store_id` passa a **aceitar nulo** | Loja vem da oferta; código desconhecido fica sem loja |
| `payt_events` | + `customer_email`, `product_codes text[]`, `payt_status` | Para listar sem abrir o JSON |
| `email_log` | `id`, `store_id`, `customer_id`, `to_email`, `kind` (`acesso_novo` \| `produto_novo` \| `reenvio`), `product_ids uuid[]`, `status` (`pendente` \| `enviado` \| `falhou`), `error`, `attempts`, `provider_id`, `created_at`, `sent_at` | Parte 2 |
| `item_access` | `id`, `customer_id`, `store_id`, `product_id`, `item_id`, `kind`, `created_at` | Parte 5 |
| `login_attempts` | + `email_hash` (nulo), `store_id` | Parte 4 |
| `customer_devices` | sem mudança | `last_seen_at` = último acesso |

RLS habilitado em todas as tabelas, sem políticas públicas; todo acesso pelo servidor com a chave de serviço (como hoje). Bucket `covers` continua público.

### 4.3 Regra de acesso

> O cliente vê um produto se tiver **pelo menos um pedido `pago`** cujo `payt_product_code` pertença a uma **oferta que libera esse produto**, e não estiver bloqueado.

Cadastrar uma oferta depois libera quem já comprou; reembolso de um pedido não remove acesso concedido por outro.

### 4.4 Migração dos dados atuais

Só há dados de exemplo (4 materiais, oferta `TESTE-ATLAS`, pedido `TESTE-LOCAL-2`). Cada material vira um produto com um módulo e um item `arquivo` apontando para o `download_url`; `offer_materials` vira `offer_products`. Tabelas antigas são removidas na mesma migração.

## 5. Payt, avisos e e-mails (Parte 2 — aprovada)

### 5.1 Bumps no mesmo aviso

1. O parser devolve **lista de produtos**: principal (`product.code` ou `product.sku`) + cada entrada de `product.items[]` + cada entrada de `order_bumps[]` (código por `code`/`sku`/`id`; nome e preço quando houver). Códigos repetidos são deduplicados.
2. Para **cada** código: `apply_order_status(transaction_id, código, …)` com a regra de nunca retroceder; a loja vem da oferta do código (nula se desconhecido).
3. Se algum pedido deste aviso está `pago` e acabou de virar pago (ou o cliente acabou de ser criado): garante o cliente e envia **um único e-mail** listando os produtos liberados neste aviso, por loja.
4. Status desconhecido ou `peding_refund`: registrado, sem mudar acesso.
5. `payt_events` guarda e-mail, códigos, status e resultado (`liberado`, `sem_mudanca`, `codigo_desconhecido`, `ignorado`, `chave_invalida`, `erro`).
6. Os nomes de campos de bump são confirmados no primeiro aviso real; o parser tolera ausência das listas.

### 5.2 Tela de avisos — `/admin/avisos`

Tabela paginada (50/página): data, e-mail, códigos, status Payt, chave válida, resultado, erro. Filtros: todos / com erro / código desconhecido. Detalhe mostra o JSON bruto formatado. Código desconhecido tem atalho "Criar oferta com este código" (abre o formulário de oferta preenchido).

### 5.3 Registro e reenvio de e-mails — `/admin/emails`

- Todo e-mail ao cliente grava `email_log` como `pendente` antes do envio e atualiza para `enviado` (com `provider_id`) ou `falhou` (com erro).
- Remetente: `"{nome da loja}" <acesso@grupoelevamax.com>` (`EMAIL_FROM` define o endereço).
- **Reenviar em lote:** pega os `falhou`, agrupa **um por cliente e loja**, monta o e-mail com a lista **atual** de produtos liberados e envia em sequência. Mostra quantos cabem hoje e para no limite diário configurado (`EMAIL_DAILY_LIMIT`, padrão 100 = plano grátis do Resend); máximo 100 por clique.
- Reenvio individual na linha do registro e na ficha do cliente.
- Código de login do admin não entra no registro (sai pelo SMTP do Supabase).

### 5.4 Dependência operacional

Enquanto o domínio `grupoelevamax.com` não estiver verificado no Resend (em 16/09: DKIM `not_started`), todo envio falha e o **admin não consegue entrar**. Nada se perde: os envios ficam `falhou` para o reenvio em lote. A verificação do Resend segue como pendência paralela.

## 6. Template Netflix (Parte 3 — aprovada)

### 6.1 Tema

- Fixo e escuro: fundo `#0b0b0c`, superfícies `#141414`/`#1c1c1f`, bordas `#2a2a2e`, texto `#f5f5f5`/`#a1a1aa`, destaque vermelho `#e11d2e` (hover `#f43f5e`).
- Tokens em um único arquivo (variáveis CSS + Tailwind); nenhuma tela usa cor literal.
- Loja personaliza apenas nome, logo, imagem do login e WhatsApp.
- **Capa automática:** sem `cover_url`/`banner_url`, renderiza gradiente escuro determinístico (a partir do id) com o título.

### 6.2 Vitrine `/[loja]`

1. Topo: logo e nome da loja, botão "Instalar app", menu com "Sair".
2. **Hero:** produto `is_featured` (ou primeiro liberado) com banner, título, descrição curta e botão **Acessar** (liberado) ou **Quero acessar** (bloqueado).
3. Fileiras em carrossel (scroll-snap; arrasto no celular; setas no computador):
   - **Continuar** — produtos com `item_access` nos últimos 30 dias, mais recente primeiro (some se vazia);
   - **Seus produtos** — liberados;
   - **Desbloqueie mais** — publicados e não liberados, capa dessaturada com cadeado; toque abre janela com capa, descrição e botão para `checkout_url` (sem link direto do card).
4. Cards pôster 2:3 com leve ampliação no hover.
5. Sem produto liberado: mensagem + WhatsApp.

### 6.3 Produto `/[loja]/produto/[slug]`

Banner, título, descrição. Cada módulo publicado = fileira de cards 16:9 com ícone do tipo (PDF/arquivo, vídeo, link). Um só módulo = grade simples. Sem acesso → redireciona à vitrine com a janela de compra aberta (`?comprar=slug`).

### 6.4 Item `/[loja]/item/[id]`

Sempre confere sessão, publicação e acesso no servidor e grava `item_access`.

- `arquivo` e `link`: redireciona (302) para `url`; os cards abrem em nova aba.
- `video`: página com player 16:9 embutido (YouTube, Vimeo, Panda — detectado pela URL; outra URL vira link), lista dos itens do módulo e anterior/próximo.

### 6.5 Qualidade

Esqueleto de carregamento, estados vazio e erro em toda tela; validado em 375px e 1440px; botões só com ícone têm `aria-label`; páginas logadas com `noindex`. Admin usa o mesmo tema com tabelas compactas.

## 7. Entrada: login, anti-robô, WhatsApp e app (Parte 4)

### 7.1 Layout do login `/[loja]/entrar` (referência: print do Lovable "MemberFlow")

- **Computador:** metade esquerda com imagem grande (`login_image_url` ou imagem escura padrão) sob degradê, selo "Área de membros", título "Seus materiais em **um só lugar**" e subtítulo; painel direito escuro com logo + nome da loja, "Entrar", campo de e-mail e botão vermelho **Entrar**.
- **Celular:** imagem como fundo com escurecimento e cartão do formulário centralizado.
- Sem campo de senha. `?email=` preenche o campo (links dos e-mails).
- Textos fixos; nada configurável além do que a loja já tem.

### 7.2 Proteção

Validada no servidor antes de qualquer consulta de cliente:

1. **Campo-armadilha** invisível (preenchido = recusa silenciosa com mensagem genérica).
2. **Tempo mínimo** de 1,5 s entre abrir e enviar, com carimbo de tempo assinado (HMAC com `LOGIN_GUARD_SECRET`) no formulário.
3. **Limites** em janela de 10 min: 20 tentativas por IP e 5 por e-mail. E-mail guardado só como `sha256(salt + email)`.
4. **Atraso progressivo** a partir da 3ª tentativa do mesmo e-mail.
5. **Turnstile opcional:** se `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` existirem, o widget aparece e o token é verificado no servidor; sem as chaves, fica desligado.

Mensagens mantidas: e-mail sem compra na loja → "Não encontramos compras com este e-mail nesta loja" + WhatsApp; bloqueado → conta suspensa + WhatsApp; excesso → "Muitas tentativas, aguarde alguns minutos".

### 7.3 WhatsApp contextual

- `stores.support_whatsapp` (só dígitos, com DDI). Sem número → usa `support_url`; sem nenhum → não mostra.
- Botão flutuante no login e na vitrine.
- Mensagens prontas:
  - e-mail não encontrado: *"Olá! Comprei um produto da {loja} com o e-mail {email} e não estou conseguindo acessar."*
  - vitrine/login geral: *"Olá! Preciso de ajuda com a área de membros da {loja}."* (inclui o e-mail quando logado).

### 7.4 Instalar app (PWA)

- Manifesto dinâmico por loja: nome, `start_url` e `scope` `/[loja]`, tema escuro, ícones (logo da loja ou ícone padrão 192/512/maskable).
- Service worker mínimo em `/sw.js`: só rede, com página offline simples. **Não guarda em cache páginas logadas nem arquivos.**
- Botão "Instalar app" no login e na vitrine:
  - Android/Chrome: usa o prompt nativo (`beforeinstallprompt`);
  - iPhone: janela com o passo a passo (Compartilhar → Adicionar à Tela de Início);
  - some quando já está instalado (`display-mode: standalone`).

## 8. Sucesso do cliente (Parte 5)

### 8.1 Registros

- `item_access`: gravado em toda abertura de item (§6.4).
- Último acesso: `customer_devices.last_seen_at` (já atualizado no login).

### 8.2 Situação de cada cliente, por loja

Comprador da loja = tem pedido `pago` de oferta da loja.

| Situação | Regra |
|---|---|
| **Nunca entrou** | Primeiro pedido pago há mais de 24 h e nenhum registro em `customer_devices` |
| **Entrou e não abriu nada** | Tem login e zero `item_access` na loja |
| **Ativo** | `item_access` na loja nos últimos 30 dias |
| **Inativo** | Demais casos |

### 8.3 Tela `/admin/sucesso`

- Seletor de período (7/30/90 dias) e loja.
- Indicadores: compradores, % que entrou, % que abriu algo, e-mails com falha.
- Tabela de clientes: e-mail, primeira compra, produtos liberados, último acesso, itens abertos, situação; filtros rápidos **Nunca entrou** e **Entrou e não abriu nada**; busca por e-mail; 50 por página.
- Ficha do cliente (já existente em `/admin/clientes/[id]`) ganha linha do tempo: pedidos, e-mails (com status), primeiro/último acesso e itens abertos; botão **Reenviar acesso**.

## 9. Admin — telas afetadas

| Tela | Mudança |
|---|---|
| Lojas (nova) | Criar/editar loja: nome, slug, logo, WhatsApp, link de suporte, imagem do login |
| Produtos (substitui Materiais) | Lista por loja; edição com abas **Geral** (capas, checkout, destaque, publicado) e **Conteúdo** (módulos e itens com ordenação) |
| Ofertas | Escolhe produtos em vez de materiais; código Payt único global |
| Pedidos, Clientes | Filtro por loja; coluna origem |
| Avisos, E-mails, Sucesso | Novas (§5.2, §5.3, §8.3) |

## 10. Erros

- Webhook: chave inválida → 401 + registro; corpo inválido → 400 + registro; erro inesperado → 500 (Payt reenvia; reprocessamento é seguro); falha de e-mail → `falhou` no registro e resposta 200.
- Item: sem sessão → login da loja; sem acesso → vitrine com janela de compra; item inexistente ou despublicado → 404 da loja.
- Loja inexistente → 404 genérico.

## 11. Testes

**Automatizados (Vitest):**
- Parser: principal só; principal + `order_bumps[]`; principal + `product.items[]`; códigos repetidos; bump sem código.
- Processamento: aviso com 3 produtos libera os 3; reembolso só do bump mantém o principal; aviso repetido não duplica pedido nem e-mail; código desconhecido registrado sem travar o resto; loja resolvida pela oferta.
- Acesso: produto por duas ofertas, reembolso de uma mantém; oferta cadastrada depois libera.
- E-mail: falha vira `falhou`; reenvio em lote agrupa por cliente/loja e respeita o limite diário.
- Login: armadilha, tempo mínimo, limite por IP e por e-mail, Turnstile ligado/desligado.
- Sucesso: classificação das quatro situações.
- Utilitários: detecção de provedor de vídeo, link de WhatsApp, capa automática determinística, slugs reservados.

**Navegador (Playwright), 375px e 1440px:** login → vitrine → produto → item vídeo e arquivo; produto bloqueado abre janela de compra; botão instalar; admin: criar loja → produto → módulo → item → oferta.

**Antes de vender:** aviso de teste real da Payt com bump, e-mail chegando após verificação do Resend, fluxo completo no celular e reembolso removendo acesso.

## 12. Ordem de construção

| # | Etapa | Depende de |
|---|---|---|
| 1 | Migração do banco (§4) + tipos + camada de dados | — |
| 2 | Payt com bumps + `payt_events` enriquecido (§5.1) | 1 |
| 3 | Registro de e-mails + reenvio (§5.3) | 1 |
| 4 | Tema e componentes base Netflix (§6.1) | — |
| 5 | Rotas por loja, vitrine, produto, item (§6.2–6.4) | 1, 4 |
| 6 | Login novo + proteção + WhatsApp (§7.1–7.3) | 1, 4 |
| 7 | PWA (§7.4) | 5 |
| 8 | Admin: lojas, produtos/módulos/itens, ofertas (§9) | 1, 4 |
| 9 | Admin: avisos e e-mails (§5.2, §5.3) | 2, 3, 8 |
| 10 | Sucesso do cliente (§8) | 5, 8 |
| 11 | Revisão final, Playwright, deploy | todas |

Etapas 2, 3 e 4 podem correr em paralelo após a 1; 5, 6 e 8 em paralelo após a 4.
