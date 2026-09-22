# Conferência independente — "Cuspidora de áreas de membros" antes de publicar

Você é um revisor sênior de software (Next.js, Supabase/Postgres, integrações de pagamento e e-mail). Quero uma **segunda opinião independente** antes de colocar em produção uma plataforma de áreas de membros. Não reescreva o projeto: aponte riscos reais, com prioridade.

Sou estrategista digital, não programador. Responda em português simples, mas pode usar termos técnicos quando necessário (explique em uma frase).

---

## 1. O que é

Uma plataforma única que gera várias áreas de membros ("lojas") com o mesmo visual escuro estilo Netflix, sem design sob medida por produto.

- **Endereço por loja:** `site.com/arquitetura`, `site.com/outra-loja`.
- **Conta única:** o mesmo cliente (e-mail) vale para todas as lojas; cada loja mostra só o que ele comprou nela.
- **Estrutura:** Loja → Produtos → Módulos → Itens (vídeo, arquivo, link).
- **Venda pela Payt:** a Payt envia um aviso (postback/webhook) a cada mudança de pedido. O sistema libera o acesso e manda e-mail.
- **Login do cliente só com e-mail**, sem senha e sem código. **É decisão consciente do dono** (público low ticket, evitar suporte). Não trate como defeito; avalie apenas se as proteções em volta são suficientes.

**Stack:** Next.js 16 (App Router, `proxy.ts` no lugar de middleware), React 19, TypeScript, Tailwind v4, Supabase (Postgres, cliente com service role no servidor, RLS ligado sem policies = nada acessível pelo navegador), Resend (e-mail), Zod, Vitest, hospedagem Vercel.

**Estado atual:** 189 testes automatizados passando, lint e build limpos, teste no navegador (computador e celular) do login, vitrine, janela de compra, página de produto e abertura de item. Houve revisão por tarefa e uma revisão final; os 3 bloqueadores da revisão final foram corrigidos (detalhes na seção 4).

---

## 2. Como funciona (resumo técnico)

### 2.1 Aviso da Payt (`/api/webhooks/payt`)
1. Grava o aviso bruto em `payt_events`.
2. Confere a `integration_key` com comparação de tempo constante. Errada → 401 e `outcome = chave_invalida`.
3. Lê o aviso: produto principal + `product.items[]` + `order_bumps[]`, sem duplicar. Para cada item usa o **primeiro identificador não vazio** entre `code` → `sku` → `id`.
4. Converte o status da Payt (pago, reembolsado, cancelado, chargeback…). Status desconhecido → `ignorado`.
5. **Um pedido por código de produto** (`transaction_id + product_code`). A loja vem da oferta cadastrada com aquele código (código é único globalmente). Código não cadastrado → pedido guardado sem loja (`store_id` nulo) e `codigo_desconhecido`.
6. O status do pedido **nunca regride** (função SQL `apply_order_status`): um aviso atrasado de "aguardando" não desfaz um "pago".
7. Se há linha paga: acha ou cria o cliente. Para **cada loja**, manda **um e-mail** listando os produtos liberados naquela loja.
8. O acesso não é gravado como "permissão": é **calculado** a partir dos pedidos pagos. Reembolso/chargeback remove o acesso automaticamente.

Resultados possíveis gravados no evento: `liberado`, `atualizado`, `sem_mudanca`, `codigo_desconhecido`, `ignorado`, `invalido`, `chave_invalida`, `erro`.

Trecho central (decisão de e-mail por loja):

```ts
for (const store of storesOf(paid)) {
  const storeLines = paid.filter((l) => l.store?.id === store.id)
  // pula só se: cliente não é novo, nada mudou E já existe registro de e-mail para essa loja
  if (!customerCreated && !storeLines.some((l) => l.changed) && (await repo.hasNoticeForStore(customer.id, store.id))) continue
  granted = true
  try {
    const products = await productsFor(repo, storeLines)
    if (products.length === 0) continue
    const result = await deps.notify({ customerId: customer.id, to: p.customerEmail, customerName: p.customerName,
      store, products, kind: customerCreated ? 'acesso_novo' : 'produto_novo' })
    if (result.ok) emailsSent++
    else emailErrors.push(result.error)
  } catch (e) {
    emailErrors.push(errorMessage(e))
    try { await repo.logFailedNotice({ storeId: store.id, customerId: customer.id, toEmail: p.customerEmail,
      kind: customerCreated ? 'acesso_novo' : 'produto_novo', error: errorMessage(e) }) } catch {}
  }
}
```

Se a gravação de algum pedido falhar, o endpoint responde erro (a Payt reenvia) e o evento fica como `erro`.

### 2.2 E-mails
- Tabela `email_log`: cada envio com status `pendente` / `enviado` / `falhou` e `resolved_by`.
- Tela no admin com **reenvio em lote** das falhas: agrupa por cliente + loja, limitado ao limite diário (`EMAIL_DAILY_LIMIT`, dia contado em UTC) e no máximo 100 por clique.
- Reenvio individual pela ficha do cliente.

### 2.3 Login do cliente (só e-mail)
- Campo-isca invisível (`website`); se preenchido, recusa.
- "Carimbo" do formulário assinado com HMAC (`LOGIN_GUARD_SECRET`); envio com menos de 1,5 s é recusado (robô).
- Limites em 10 minutos: 20 tentativas por IP e 5 por e-mail (e-mail guardado como hash). Atraso progressivo.
- Cloudflare Turnstile opcional (liga se as variáveis existirem).
- E-mail de admin e e-mail inexistente recebem **a mesma mensagem** (não revela quem é admin).
- Sessão em cookie; `proxy.ts` protege as rotas da loja.
- Links reais dos itens (`items.url`) **não aparecem no HTML**: o item abre por `/loja/item/[id]`, que confere o acesso no servidor, registra o download (`item_access`) e redireciona.

### 2.4 Admin
Telas: Lojas, Produtos (editor de módulos e itens, upload de capa até 2 MB), Ofertas (código Payt → produtos), Pedidos (por loja), Avisos da Payt (com coluna "chave válida"), E-mails, Sucesso do cliente (quem comprou e não baixou, por período, via função SQL `store_customer_success`), Clientes (busca global + linha do tempo).
Admin entra com link mágico por e-mail (Supabase Auth + lista de admins).

### 2.5 PWA
Manifesto por loja, ícones gerados no servidor, `sw.js` mínimo com página offline, botão "Instalar app".

### 2.6 Banco — migrações
- **Já aplicada:** `cuspidora_base` (aditiva): cria products, modules, items, offer_products, email_log, item_access; copia os "materiais" antigos para produtos (mesmo id), cada um com 1 módulo e 1 item.
- **A aplicar junto com a publicação (irreversível):**

```sql
drop table public.offer_materials;
drop table public.materials;
alter table public.stores drop column primary_color;
update public.payt_events set outcome = case outcome
  when 'processed' then 'sem_mudanca' when 'unauthorized' then 'chave_invalida'
  when 'invalid' then 'invalido' when 'ignored' then 'ignorado' when 'failed' then 'erro'
  else outcome end
where outcome in ('processed','unauthorized','invalid','ignored','failed');
```
As tabelas antigas só tinham dados de exemplo, já copiados. O código não usa mais essas tabelas nem a coluna.

### 2.7 Variáveis novas na Vercel
`LOGIN_GUARD_SECRET` (obrigatória), `EMAIL_DAILY_LIMIT` (padrão 100), `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (opcionais). Limite da Vercel: 4,5 MB por requisição → `serverActions.bodySizeLimit = '4.5mb'` e imagens até 2 MB.

---

## 3. Riscos já conhecidos e aceitos (não precisa repetir, mas diga se discorda da prioridade)

**Estacionados (decididos conscientemente):**
- Admin é global e confiável: um admin poderia forjar IDs de outra loja num formulário.
- Limites de login podem ser burlados por requisições simultâneas (contagem não é atômica).
- O carimbo do formulário pode ser reutilizado dentro da validade.
- A página `/admin` só redireciona e não checa admin (as páginas internas checam).

**Adiados para depois da publicação:**
- Reenvio pela ficha do cliente não marca as falhas antigas como resolvidas.
- Filtro "com erro" dos avisos não pega eventos `liberado` que tiveram falha só de e-mail.
- Pedidos com `store_id` nulo (código desconhecido) somem das listas por loja depois que a oferta é cadastrada.
- Função `store_customer_success` busca em lotes de 1000 sem `ORDER BY` estável (importa acima de ~1000 compradores).

**Pendências operacionais antes de vender:**
- Domínio do Resend ainda não verificado (DKIM).
- Falta um teste real da Payt com bump e com reembolso. **Dúvida aberta:** num reembolso só do bump, a Payt manda o código do bump sozinho ou o pedido inteiro? Hoje o sistema aplica o status a todos os códigos que vierem no aviso.
- Trocar dados de exemplo (oferta TESTE-ATLAS, links example.com).

---

## 4. Correções feitas após a revisão final
1. **Bump descartado:** `code: ""` impedia usar `sku`/`id` válidos → agora usa o primeiro não vazio.
2. **E-mail perdido:** se a gravação falhava no meio e a Payt reenviava, a loja era pulada (nada "mudou") e o cliente nunca recebia e-mail → agora só pula se já existe registro em `email_log` para cliente+loja; se o envio lança erro, grava linha `falhou` para entrar no reenvio em lote.
3. **Upload na Vercel:** limite antigo de 5 MB/arquivo e 12 MB/requisição quebraria com 413 → 2 MB por imagem e 4,5 MB por requisição.

---

## 5. O que quero de você

Analise o desenho acima e responda:

1. **Liberação de acesso e dinheiro:** existe cenário realista em que um cliente **pague e não receba acesso**, ou **perca o acesso sem reembolso**, ou **mantenha acesso após reembolso/chargeback**? Considere avisos fora de ordem, duplicados, bumps, reembolso parcial, e-mail com maiúsculas/espaços, troca de e-mail na Payt.
2. **E-mail:** a regra de "pular loja só se já existe registro em `email_log`" pode gerar e-mail duplicado ou nenhum e-mail em algum caso? (Ex.: novo bump pago horas depois; registro `falhou` antigo existente.)
3. **Segurança:** dado que o login só com e-mail é aceito, as proteções (isca, carimbo HMAC, limites por IP/e-mail, Turnstile opcional, mensagem neutra) são razoáveis? Qual é a **maior** brecha restante e a correção mais barata?
4. **Publicação:** o que pode quebrar no primeiro dia na Vercel/Supabase (variáveis, migração irreversível, limites, cache, service worker velho)? Qual a ordem segura: migração antes ou depois do deploy?
5. **Riscos estacionados/adiados:** algum deveria subir para "corrigir antes de vender"? Por quê?
6. **Teste real com a Payt:** me dê um roteiro curto (passo a passo, o que conferir em cada passo) para validar compra com bump, reembolso só do bump e chargeback.

**Formato da resposta:**
- `### Bloqueia a publicação` (ou "Nenhum")
- `### Corrigir antes de vender`
- `### Pode esperar`
- `### Roteiro de teste com a Payt`
- `### Veredito` — Publicar: Sim / Não, e o motivo em 1–2 frases.

Seja objetivo (até ~700 palavras). Se precisar ver código específico para confirmar algo, diga **qual arquivo** quer que eu cole em vez de supor.

Arquivos que posso colar se pedir: `src/lib/orders/process-postback.ts`, `src/lib/payt/parse.ts`, `src/lib/payt/status.ts`, `src/lib/auth/login-guard.ts`, `src/lib/auth/customer-login.ts`, `src/proxy.ts`, `src/app/[loja]/item/[id]/page.tsx`, `src/lib/email/server.ts`, `supabase/migrations/20260917000001_cuspidora_base.sql`, `supabase/migrations/20260917000002_cuspidora_limpeza.sql`.
