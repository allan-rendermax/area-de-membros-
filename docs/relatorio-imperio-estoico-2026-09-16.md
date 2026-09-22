# Relatório — revisão do Império Estoico (Lovable) × área de membros atual

**Data:** 16/09/2026
**Projeto revisado:** Lovable "APP ESTOICISMO BR" (marca Império Estoico), publicado em `appestoicismoilustrado.lovable.app`
**Comparado com:** este repositório (Next.js + Supabase + Vercel + Payt)

---

## 1. Resumo

O Império Estoico **está em produção e vendendo**: 612 clientes, 1.193 acessos ativos, 1.444 downloads, 1.660 avisos da Hotmart, 9 produtos. É uma versão já funcionando da mesma ideia do projeto atual (login só com e-mail, PDFs, suporte por WhatsApp).

Tem **1 falha crítica de segurança**, **cerca de 9 a 11 clientes que pagaram e não receberam o produto** e várias boas ideias para trazer ao projeto novo.

| Item | Situação |
|---|---|
| Tabelas com proteção (RLS) | Todas ligadas, sem abertura pública indevida |
| Arquivos (PDFs) | Pasta privada, links temporários de 1h (download) e 4h (visualizar) |
| Login do cliente | Só e-mail (decisão consciente, igual ao projeto novo) |
| Login do admin | **Só e-mail também** — ver §2.1 |

## 2. Correções urgentes no Império Estoico (produção)

### 2.1 CRÍTICO — qualquer pessoa entra como admin digitando o e-mail do admin

**Onde:** `supabase/functions/passwordless-login/index.ts`.
A função libera o login sem senha para qualquer perfil `active` **ou** para o e-mail salvo em `app_config.admin_email`. Os 2 admins têm perfil ativo. Então quem digitar o e-mail de um admin na tela normal recebe a sessão do admin, com acesso à lista dos 612 clientes, aos produtos e aos arquivos.

A senha em `/login?admin=1` não protege nada, porque o caminho sem senha continua aberto para o mesmo e-mail.

O e-mail do admin **não** fica visível publicamente no banco (conferido), mas é fácil de adivinhar ou descobrir (Hotmart, suporte, e-mails enviados).

**Correção:**
1. Na função `passwordless-login`, recusar qualquer e-mail cujo usuário esteja em `admin_users` (responder `EMAIL_NOT_ALLOWED`) e remover o desvio por `app_config.admin_email`.
2. Admin entra **só** por `/login?admin=1`, com senha forte.
3. Conferir se os 2 admins têm senha definida antes de publicar, para ninguém ficar trancado para fora.

**Instrução pronta para colar no chat do Lovable:**
> Na edge function `passwordless-login`, bloqueie o login sem senha para administradores: depois de achar o perfil, verifique se o `id` existe em `public.admin_users`; se existir, responda 403 `EMAIL_NOT_ALLOWED`. Remova o trecho que libera o e-mail de `app_config.admin_email`. Administradores devem entrar apenas por `/login?admin=1` com senha. Não altere mais nada.

### 2.2 ALTA — clientes que pagaram e não receberam o produto

**Causa:** cada produto aceita **um único código da Hotmart** (`products.platform_product_id`). Quando a mesma coisa é vendida com outro código, o aviso cai em "produto desconhecido" e ninguém recebe acesso.

| Código Hotmart | Nome na Hotmart | Compras aprovadas | Situação |
|---|---|---|---|
| `8072894` | Biblioteca Estóica | 10 | Cadastrado no app como `1504121`. **~8 a 9 sem reembolso e sem a Biblioteca** (1 reembolsado; 1 com "expirado" depois, conferir) |
| `7920093` | Estoicismo Visual — Completo **- DEACT** | 2 | Produto desativado na Hotmart, mas ainda vendeu (até 17/08). **Nenhum dos 2 tem acesso** (1 teve avisos de "atrasado" depois, conferir se pagou) |

**Correção:**
1. **Agora:** liberar manualmente o acesso a esses clientes (pelo admin ou por SQL) depois de conferir na Hotmart que as vendas não foram reembolsadas.
2. **Definitivo:** permitir **vários códigos da Hotmart por produto** (tabela `product_platform_ids` ou coluna em lista) e um botão no admin **"Reprocessar avisos de produto desconhecido"**.
3. Na Hotmart: verificar por que um produto "DEACT" ainda tinha checkout ativo.

**Não é problema:** os outros ~540 avisos de "produto desconhecido" são de **outros negócios da mesma conta Hotmart** (versão em espanhol, Nutrição Animal, Horta Lucrativa etc.). A Hotmart manda todas as vendas da conta para essa URL. O app ignora corretamente.

### 2.3 MÉDIA — login sem limite de tentativas

`passwordless-login` não tem limite de tentativas nem barreira contra robôs, e responde de forma diferente para e-mail liberado e não liberado. Um robô pode testar listas de e-mails e descobrir quem é cliente, ou entrar na conta.
**Correção:** limite por IP e por e-mail (ex.: 10 por IP e 5 por e-mail a cada 10 min), guardando só hash.

### 2.4 BAIXA

- **Falha ao criar usuário (113 avisos):** acontece quando a Hotmart manda produto principal e bump ao mesmo tempo, e os dois tentam criar o mesmo cliente. **Nenhum cliente ficou sem acesso por isso** (conferido: o único caso sem acesso foi reembolsado); a nova tentativa da Hotmart resolve. Melhoria: ao receber "already registered", buscar o usuário existente em vez de responder erro.
- **Reembolso remove o produto mesmo que o cliente o tenha por outra compra** (ex.: comprou avulso e depois num combo). Hoje nenhum produto tem bônus embutido (`bundled_product_ids` vazio), então o risco atual é baixo.
- Comparação do `hottok` com `!==` em vez de comparação em tempo constante.

## 3. O que trazer para o projeto novo

Ordem por prioridade.

### Tarefa A — Suporte por WhatsApp em todo lugar (ALTA, rápida)
- Botão flutuante de WhatsApp na vitrine e no login.
- Na mensagem "Não encontramos compras com este email", link para o WhatsApp com texto pronto: *"Olá! Meu email de compra não está liberado na loja X."*
- Campo `support_whatsapp` na tabela `stores` (o projeto novo tem `support_url`; manter os dois).

### Tarefa B — Registro de downloads + "Sucesso do cliente" no admin (MÉDIA-ALTA)
O Império Estoico registra cada download e tem a tela `/admin/sucesso` para achar quem **comprou e nunca entrou** e quem **entrou e nunca baixou**. É isso que evita pedido de reembolso por "não recebi".
1. Tabela `material_downloads` (`customer_id`, `material_id`, `created_at`).
2. O botão **Baixar** passa a apontar para `/baixar/[materialId]`: confere o acesso no servidor, grava o download e redireciona para o `download_url`. Isso também esconde o link do Drive do HTML da vitrine.
3. Admin → Clientes: colunas **Último acesso** e **Downloads**, com etiquetas *Nunca entrou* / *Não baixou* / *Ativo*.

### Tarefa C — Botão "Instalar app" (PWA) (MÉDIA)
Transforma o site em ícone na tela do celular, com instruções para Android e iPhone. O cliente low ticket compra no celular e esquece o link; com o ícone, ele volta sozinho.
Inclui: `manifest.webmanifest`, ícones 192/512, e o botão no login e na vitrine (referência: `src/components/InstallAppButton.tsx`).

### Tarefa D — Importar clientes por planilha (MÉDIA, quando for migrar)
Necessário **se um dia o Império Estoico ou outra base vier para a plataforma nova** (hoje são 612 clientes).
CSV com `email, nome, codigo_produto, transacao` → cria o cliente e um pedido `pago` marcado como importado (sem e-mail por padrão). Referência: `src/lib/customer-import.functions.ts` (limite de 500 linhas por envio e relatório por linha).

### Tarefa E — Suspender em disputa ou pedido de reembolso (DECISÃO SUA)
A Hotmart avisa **pedido** de reembolso e disputa antes do reembolso efetivo, e o Império Estoico **suspende** o acesso nesses casos, podendo reativar. No projeto novo, hoje esses avisos não mexem no acesso.
- **Manter como está (recomendado para low ticket):** menos suporte, e o cliente que desistiu do reembolso não fica bloqueado.
- **Suspender:** protege o PDF de quem pede reembolso só para baixar tudo. Exige um status novo `suspenso` que pode voltar para `pago`, o que quebra a regra de "nunca retroceder" para esse caso.

## 4. O que o projeto novo já faz melhor (confirmado por este caso)

| Problema real no Império Estoico | Como o projeto novo evita |
|---|---|
| Um código da plataforma por produto → clientes sem acesso | **Ofertas separadas dos materiais**: vários códigos podem liberar o mesmo material |
| Produto cadastrado depois não libera quem já comprou | **Acesso calculado a partir dos pedidos**: cadastrar a oferta depois libera na hora, sem reprocessar |
| Reembolso de uma compra tira produto que veio de outra | Acesso só some se **nenhum** pedido pago liberar o material |
| Admin entra só com e-mail | Admin com **código de 6 dígitos** e lista `ADMIN_EMAILS` |
| Login sem limite de tentativas | Limite por IP já existe (reforço por e-mail no relatório anterior) |

## 5. Irrelevante ou opcional

- Frase do dia e carrossel de banners: opcional, estética de nicho.
- Meta Pixel dentro da área de membros: não precisa, o rastreio de compra é no checkout.
- Limite de downloads por item e arquivos no Storage privado: só se a pirataria virar problema (hoje a decisão é entregar por link).
- Fila própria de e-mails do Lovable com descadastro: o projeto novo usa Resend.
- Visual dourado e serifado: é identidade do nicho estoico. Se o Império vier para a plataforma nova, vira o **tema da loja** (cor, logo e fonte por `store`).

## 6. Próximos passos sugeridos

1. **Hoje:** corrigir o login do admin no Império Estoico (§2.1).
2. **Hoje:** conferir na Hotmart e liberar os ~10 clientes sem acesso (§2.2).
3. Aceitar múltiplos códigos por produto no Império Estoico (§2.2) ou planejar a migração dele para a plataforma nova.
4. No projeto novo: tarefas A e B, junto com as tarefas 1 a 3 do relatório anterior (`docs/relatorio-projeto-lovable-2026-09-16.md`).
