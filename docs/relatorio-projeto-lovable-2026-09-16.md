# Relatório — revisão do "Projeto - Alan" (Lovable) × área de membros atual

**Data:** 16/09/2026
**Projeto revisado:** Lovable "Projeto - Alan" (MemberFlow), publicado e público
**Comparado com:** este repositório (Next.js + Supabase + Vercel + Payt), spec em `docs/superpowers/specs/2026-09-16-area-de-membros-design.md`

---

## 1. Resumo em uma frase

O projeto do Lovable é uma **plataforma de cursos estilo Netflix** (vídeo, progresso, certificados, IA, 8 plataformas de venda); o seu projeto atual é uma **vitrine de PDFs só com a Payt**. **Não vale migrar para ele** — mas vale copiar 4 ideias e evitar 6 armadilhas que ele tem.

## 2. O que existe no projeto do Lovable

| Área | O que tem | Estado no banco |
|---|---|---|
| Conteúdo | Produto → Módulo → Aula (vídeo, texto, PDF, áudio, quiz), anexos, notas, resumo por IA | 3 produtos, 21 aulas |
| Acesso | "Turmas" com liberação por produto, módulo ou aula | — |
| Vendas | Webhooks de Payt, Kiwify, Hotmart, Cakto, Kirvano, Perfect Pay, Mercado Pago, CartPanda | 8 tokens criados, **0 eventos recebidos** |
| Login | E-mail + senha, "esqueci a senha", anti-robô (honeypot, tempo mínimo, limite por IP e por e-mail) | 1 perfil |
| E-mail | Modelos editáveis, log de envios com status "aguardando domínio" e reenvio | — |
| Admin | Painel de receita por produto/plataforma/dia, alunos, turmas, importação de curso por ZIP, marca (dezenas de gradientes e acabamentos metálicos) | — |
| Extras | Certificados com link público, assistente de IA (OpenAI/DeepSeek/MiniMax), "continuar assistindo" | — |

**Conclusão:** nenhum cliente real passou por lá. Pode ficar só como referência.

## 3. Armadilhas do Lovable — NÃO copiar

| # | Problema | Onde | Por que é grave |
|---|---|---|---|
| A1 | **Todo aluno criado pela venda recebe a senha `123456`** e ela vai escrita no e-mail | `src/lib/auth/default-password.ts`, `src/lib/webhooks/provision.server.ts` | Quem souber o e-mail do comprador entra. Na prática é igual ao "login só com email", mas com a falsa impressão de ter senha |
| A2 | **Reembolso remove a turma inteira**, inclusive a "turma padrão" | `provision.server.ts` → `revokesAccess` apaga `tenant_members` | Cliente que comprou Plano + Bump e pediu reembolso só do bump perde **tudo** |
| A3 | **Sem regra de "não voltar status"** — o id do evento inclui o status | `normalize.ts` → `eventId = pedido:evento:status` | Um "pago" atrasado depois de um "reembolsado" **devolve o acesso** |
| A4 | Todo comprador entra na "turma padrão", mesmo sem oferta cadastrada | `getDefaultTenantId` | Qualquer produto colocado nessa turma vira brinde para todos |
| A5 | Status descoberto por palavra-chave (`fail`, `expired`, `abandon`…) e código do produto aceitando até o **nome** do produto | `STATUS_KEYWORDS`, `collectProductCodes` | Um texto inesperado da plataforma pode liberar ou tirar acesso errado |
| A6 | Arquivos das aulas com "link temporário" de **5 anos**; pedido sem id vira `plataforma-<horário>` | `docs/PACOTE-PRODUTO.md`, `normalizeGeneric` | Link na prática permanente; o mesmo aviso repetido vira pedido duplicado |

Detalhes menores: documentação copiada de outro projeto (URLs `project--23b2dd25…`), tabelas de "comunidade" e "reengajamento" abandonadas no banco.

> O seu projeto atual **já resolve A2, A3, A4 e A6** pelo desenho: acesso calculado a partir de pedidos pagos por oferta, status que nunca retrocede e pedido único por (transação, código do produto).

## 4. O que aproveitar — lista de implementação

Ordem por prioridade. Cada item é independente.

### Tarefa 1 — Payt: ler order bumps que chegam no mesmo aviso (ALTA)

**Problema no projeto atual:** `src/lib/payt/parse.ts` lê só `product.code`/`product.sku`. O Lovable, montado a partir da documentação da Payt, lê também `product.items[]` e `order_bumps[]`. Se a Payt mandar o bump **dentro do mesmo aviso**, hoje o bump seria pago e **não liberado**.

**O que fazer:**
1. `parsePaytPostback` passa a devolver uma **lista** de produtos: o principal + cada item de `product.items[]` e `order_bumps[]` (campos `code` ou `sku`, nome e valor).
2. `process-postback.ts` cria/atualiza um pedido por (`transaction_id`, código) para cada item — a regra da spec §5 ("cada produto vira um pedido próprio") continua igual.
3. Testes: aviso com 1 produto; aviso com produto + 2 bumps; bump sem código é ignorado e registrado em `payt_events.error`.
4. **Confirmar com o aviso de teste real da Payt** (pendência já prevista na spec §5, item c) e ajustar os nomes dos campos.

Também do Lovable: a Payt manda `peding_refund` (com erro de digitação) para **pedido de reembolso**. No projeto atual ele cai em "status desconhecido" e não muda acesso — está certo; só incluir um teste para garantir.

### Tarefa 2 — Tela "Avisos da Payt" no admin (ALTA)

**Por quê:** a tabela `payt_events` já guarda tudo, mas não há tela. No primeiro teste real você vai precisar ver o que chegou sem abrir o Supabase.

**O que fazer:** página `/admin/avisos` com os últimos 100 avisos: data, e-mail, código do produto, status, chave válida (sim/não), resultado e erro. Clique abre o conteúdo bruto. Filtro "só com erro".

### Tarefa 3 — Registro de e-mails com reenvio (MÉDIA-ALTA)

**Por quê:** enquanto o domínio não estiver verificado no Resend, os e-mails "Seu acesso chegou" falham. O Lovable guarda cada envio com status (`pendente`, `enviado`, `falhou`) e permite reenviar depois — nada se perde.

**O que fazer:**
1. Tabela `email_log` (`id`, `customer_id`, `to_email`, `template`, `status`, `error`, `created_at`, `sent_at`), RLS ligado sem políticas públicas.
2. Todo envio (webhook e reenvio manual) grava uma linha antes e atualiza depois.
3. Admin: lista "E-mails não enviados" + botão **Reenviar todos** (usar depois de verificar o domínio).

### Tarefa 4 — Reforço do login só com e-mail (MÉDIA)

**Por quê:** como o login não tem senha, limitar tentativas é a principal defesa. Hoje o limite é só por IP.

**O que fazer (copiado do `auth-guard` do Lovable, sem serviço externo):**
1. Campo invisível "armadilha" (robô preenche, pessoa não) em `/entrar`.
2. Recusar envio feito em menos de ~1 segundo após abrir a página.
3. Limite também **por e-mail** (ex.: 6 tentativas em 10 min), guardando o e-mail só como hash.
4. Testes para os três bloqueios.

Não muda a decisão de login só com e-mail.

### Tarefa 5 — Painel de receita (BAIXA)

No `/admin`, cards com: vendas pagas, receita total, reembolsos e receita por oferta nos últimos 7/30 dias. Os dados já existem em `orders.amount_cents`. Inspiração: `sales-revenue-panels.tsx` do Lovable.

### Tarefa 6 — Visual do login (DECISÃO SUA)

A tela de login do Lovable (imagem grande à esquerda, formulário à direita, textos editáveis) é a que aparece no seu print. O projeto atual está com a direção "prancheta técnica" aguardando aprovação em `docs/design/`. Escolha uma das duas; se quiser a do Lovable, a tarefa é só refazer o layout de `/entrar` — sem mudar a lógica.

## 5. Irrelevante para o seu caso (não implementar)

Player de vídeo, progresso e "continuar assistindo", quiz, notas, resumo por IA, assistente de IA, certificados, importação por ZIP, turmas com liberação por aula, biblioteca de gradientes/metálicos, comunidade, e-mail senha/"esqueci a senha", e as 7 outras plataformas de venda.

**Para o futuro, se precisar:** o normalizador multi-plataforma do Lovable (`src/lib/webhooks/normalize.ts`) é uma boa referência se um dia vender pela Kiwify/Hotmart — mas reescrito com a regra de "não voltar status". Marca d'água com CPF no PDF só se a pirataria virar problema (hoje está fora do escopo).

## 6. Sobre o projeto do Lovable em si

- Está **publicado e público**, com a senha fixa `123456` no código e 8 tokens de webhook criados.
- Sem clientes reais, então o risco hoje é baixo.
- **Recomendação:** despublicar no Lovable (ou não ligar nenhuma plataforma de venda a ele) para ninguém comprar e cair lá por engano.
