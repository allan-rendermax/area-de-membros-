# Área de Membros Própria — Especificação de Design

**Data:** 2026-09-16
**Status:** aprovado em conversa, aguardando revisão do documento

## 1. Objetivo

Substituir a área de membros de terceiros por uma plataforma própria que:

- recebe as vendas da **Payt** e libera o acesso automaticamente;
- cria o cliente no primeiro pedido e reconhece compras seguintes pelo email;
- **retira o acesso** em reembolso e chargeback;
- mostra uma **vitrine**: materiais liberados para baixar e os demais com cadeado, levando ao checkout;
- funciona bem no celular e no computador;
- está pronta para vários nichos (lojas), começando só com **Arquitetura**.

Primeiro produto: **Atlas Visual das Patologias na Construção Civil**.

## 2. Fora do escopo (v1)

- Senha ou código de verificação no login (decisão consciente — ver §6).
- Proteção dos PDFs (marca d'água, links temporários). A entrega é por link (Google Drive ou download direto).
- Assinaturas/recorrência.
- Mais de uma loja ativa (a estrutura existe; só "Arquitetura" é cadastrada).
- Domínio próprio no site (usa o endereço gratuito `*.vercel.app`; o domínio `.com` é usado só para enviar emails).
- Checkout próprio (a venda continua na Payt).

## 3. Stack

| Camada | Ferramenta |
|---|---|
| Site, vitrine, admin e webhook | Next.js (App Router, TypeScript), hospedado na Vercel |
| Banco de dados e sessão | Supabase (Postgres + Auth) |
| Emails | Resend, com domínio `.com` verificado |
| Venda | Payt (postback) |
| Código | GitHub |

Custos esperados para operar comercialmente: Vercel Pro (US$ 20/mês), Supabase Pro (US$ 25/mês), domínio `.com` (~US$ 10–15/ano), Resend gratuito até 3 mil emails/mês. Taxa da Payt continua existindo.

## 4. Modelo de dados

Tudo pertence a uma **loja**. A regra central: **o que se vende (oferta) é separado do que se recebe (material)**.

| Tabela | Campos principais | Observações |
|---|---|---|
| `stores` | `id`, `slug`, `name`, `logo_url`, `primary_color`, `support_url` | v1: só `arquitetura` |
| `materials` | `id`, `store_id`, `title`, `description`, `cover_url`, `download_url`, `checkout_url`, `sort_order`, `is_published` | `checkout_url` é o destino do botão "Quero acessar" quando bloqueado |
| `offers` | `id`, `store_id`, `name`, `payt_product_code` | Código único por loja. Ex.: Plano Básico, Plano Completo, cada bump e upsell |
| `offer_materials` | `offer_id`, `material_id` | Plano Completo → Atlas + Bônus 1, 2, 3 |
| `customers` | `id` (= `auth.users.id`), `email` (único, minúsculo), `name`, `blocked_at` | Um cliente pode comprar em várias lojas |
| `orders` | `id`, `store_id`, `customer_email`, `payt_transaction_id`, `payt_product_code`, `status`, `status_rank`, `payt_type`, `is_test`, `amount_cents`, `paid_at`, `updated_at` | Único por (`payt_transaction_id`, `payt_product_code`). Ligado ao cliente pelo email e à oferta pelo código do produto — sem chave fixa, então cadastrar a oferta depois vale automaticamente |
| `payt_events` | `id`, `received_at`, `payload` (jsonb), `key_valid`, `outcome`, `processed_at`, `error` | Todo aviso recebido, válido ou não |
| `login_attempts` | `ip`, `created_at` | Limite de tentativas na tela de login |
| `customer_devices` | `customer_id`, `device_hash`, `first_seen_at`, `last_seen_at` | Base do alerta de compartilhamento |

### Regra de acesso

O acesso **não é gravado**; é calculado:

> Um cliente vê um material se tiver **pelo menos um pedido com status `pago`** de uma oferta ligada a esse material, e o cliente não estiver bloqueado.

Consequências:

- Reembolso/chargeback muda o status do pedido e o acesso some sozinho.
- Duas ofertas que liberam o mesmo material: reembolsar uma não remove o acesso concedido pela outra.
- Pedido de oferta ainda não cadastrada não casa com nenhuma oferta; ao cadastrar a oferta com aquele código, o acesso passa a valer sem nenhuma atualização nos pedidos.
- Pedidos pendentes não criam cliente; o cliente é criado quando o primeiro pedido vira `pago`.

### Segurança dos dados

RLS habilitado em todas as tabelas, sem políticas públicas. Toda leitura e escrita acontece no servidor (Next.js) com a chave de serviço. A vitrine é montada por uma função no servidor que devolve `download_url` **apenas** para materiais liberados.

## 5. Webhook da Payt

Endpoint: `POST /api/webhooks/payt`.

1. **Registrar** o payload bruto em `payt_events`.
2. **Validar** `integration_key` contra a variável de ambiente (comparação em tempo constante). Inválida → responde 401, marca `key_valid = false`, fim.
3. **Normalizar** email (trim + minúsculas).
4. **Encontrar ou criar** o pedido por (`transaction_id`, código do produto), guardando o email normalizado e o código do produto.
5. **Traduzir o status** da Payt para o status interno e **nunca retroceder**:

   | Interno | Nível | Payt (confirmado) |
   |---|---|---|
   | `pendente` | 0 | `waiting_payment` |
   | `pago` | 1 | `paid` |
   | `cancelado` | 2 | `canceled` |
   | `reembolsado` | 2 | a confirmar com aviso de teste |
   | `chargeback` | 2 | a confirmar com aviso de teste |

   Um aviso só altera o pedido se o novo nível for **maior** que o atual. Status desconhecido (ex.: `lost_cart`, `subscription_renewed`) é registrado e **não altera acesso**.
6. **Se o status atual do pedido é `pago`:**
   - garante que o cliente existe (cria usuário no Supabase Auth + linha em `customers` se preciso);
   - envia email somente se o pedido **acabou de virar** `pago` ou o cliente **acabou de ser criado**: **"Seu acesso chegou"** para cliente novo, **"Novo material liberado"** para existente.
7. Falha no envio do email é registrada em `payt_events.error` e responde 200 (o admin reenvia). Erro inesperado (ex.: banco fora) → registra e responde 500 para a Payt tentar de novo; o reprocessamento é seguro.

**Idempotência:** o mesmo aviso repetido não cria usuário duplicado nem reenvia email. Se a criação do cliente falhar no meio, a nova tentativa da Payt cria o cliente e envia o email.

**Bumps e upsells:** cada produto vira um pedido próprio; reembolso de um não afeta os outros.

**Reembolso/chargeback:** nenhum email ao cliente; o pedido aparece destacado no admin.

**Pré-requisito de implementação:** disparar um aviso de teste real da Payt e confirmar (a) os textos de reembolso e chargeback, (b) onde ficam o código do produto e o email no payload, (c) se bumps chegam como avisos separados ou vários produtos no mesmo aviso. A tradução de status e o parser são ajustados a partir desse payload real.

## 6. Login (somente email)

**Decisão do dono do negócio:** o cliente entra digitando apenas o email, sem senha e sem código. Risco aceito: quem souber o email de um cliente acessa a conta dele.

Fluxo:

1. Tela única `/entrar`: campo de email.
2. Servidor normaliza o email e verifica: cliente existe e não está bloqueado.
   - Não existe → "Não encontramos compras com este email" + link de suporte da loja.
   - Bloqueado → mensagem de conta suspensa + link de suporte.
3. Servidor gera um link mágico via Supabase Admin e o valida no próprio servidor, criando a sessão em cookie. O cliente não recebe nada por email nesse passo.
4. Registra o aparelho em `customer_devices` (hash de user agent + IP).
5. Sessão longa: o cliente continua logado no aparelho até sair.
6. Limite de tentativas por IP na tela de login.

**Email "Seu acesso chegou":** botão "Acessar meus materiais" apontando para `/entrar`, com o email já preenchido.

**Mitigações:**
- Admin destaca contas com muitos aparelhos distintos e permite bloquear.
- Ativar código de 6 dígitos no futuro é uma mudança no fluxo de login, sem migração de dados.

## 7. Área do cliente (vitrine)

Rota `/` (exige sessão; sem sessão → `/entrar`).

- **Topo:** logo e nome da loja, botão Sair.
- **Seus materiais:** cards com capa, título e botão **Baixar** (abre `download_url` em nova aba).
- **Desbloqueie mais:** cards apagados com cadeado; ao tocar, abre um painel com descrição e botão **Quero acessar** (`checkout_url`).
- Grade responsiva: 1 coluna (< 400px), 2 colunas (celular), 3–4 colunas (computador).
- Só aparecem materiais com `is_published = true`.
- Direção visual definida na implementação, com prévia para aprovação.

## 8. Admin

Rota `/admin`. **Login do admin é diferente do cliente:** email da lista `ADMIN_EMAILS` + **código de 6 dígitos** enviado por email. Sem isso, qualquer pessoa digitando o email do admin entraria.

Funções v1:

- **Materiais:** criar, editar, ordenar, publicar/ocultar.
- **Ofertas:** criar, editar código da Payt, escolher materiais liberados.
- **Pedidos:** lista com filtros (status, oferta desconhecida, teste); reembolsos e chargebacks destacados.
- **Clientes:** buscar por email; ver pedidos e aparelhos; **corrigir email**; **reenviar email de acesso**; **bloquear/desbloquear**; destaque para contas com muitos aparelhos.

## 9. Emails

Enviados pelo Resend a partir de um endereço do domínio `.com` (ex.: `acesso@dominio.com`).

| Email | Quando | Conteúdo |
|---|---|---|
| Seu acesso chegou | Primeiro pedido pago do cliente | Nome do material, botão "Acessar meus materiais" |
| Novo material liberado | Pedido pago de cliente existente | Nome do material, mesmo botão |
| Código do admin | Login no admin | Código de 6 dígitos |

Autenticação do Supabase não envia emails a clientes (login sem email), exceto o código do admin, que usa SMTP do Resend configurado no Supabase.

## 10. Testes

1. **Automatizados (webhook e regra de acesso):**
   - aviso repetido não duplica cliente nem email;
   - aviso fora de ordem não retrocede status (`pago` depois de `reembolsado` é ignorado);
   - reembolso e chargeback removem acesso;
   - duas ofertas liberando o mesmo material: reembolso de uma mantém acesso;
   - bump reembolsado com plano mantido;
   - oferta desconhecida cadastrada depois libera acesso;
   - chave de integração inválida é recusada;
   - cliente bloqueado não vê nada e não entra.
2. **Aviso de teste real da Payt** em ambiente de preview.
3. **Ponta a ponta antes de vender:** compra real de valor baixo → email chega → login no celular → baixar → reembolso → acesso some.

## 11. Ordem de construção

| # | Etapa | Resultado |
|---|---|---|
| 1 | Preparação: repositório GitHub, projeto Next.js, projeto Supabase, projeto Vercel | Site vazio no ar |
| 2 | Banco e regra de acesso | Tabelas, RLS, função da vitrine |
| 3 | Webhook da Payt + testes + captura de aviso real | Pedidos e clientes criados por avisos de teste |
| 4 | Login por email + vitrine | Cliente entra e vê liberados/bloqueados |
| 5 | Domínio `.com` + Resend + emails | Emails chegando na caixa de entrada |
| 6 | Admin | Cadastro e suporte |
| 7 | Teste ponta a ponta + publicação | Pronto para vender |

## 12. Pendências que dependem do dono do negócio

- Compra do domínio `.com` (confirmar nome e preço antes).
- Contas: GitHub, Resend, Supabase e Vercel já existem. Falta conectar GitHub e Resend ao projeto na etapa 1/5.
- Cadastro de materiais, ofertas, links de download e checkout (feito pelo admin após a etapa 6).
- Disparo do aviso de teste no painel da Payt.
