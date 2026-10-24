# Complementos contextuais — implementação e homologação

Implementação em `codex/complementos-netflix`, baseada no deploy verificado `635eb541765bf3d8d8f0d2fff9cdf04047b8864a`. Publicação autorizada e concluída em 24/10/2026; veja [publicacao.md](publicacao.md) para códigos Payt, checkouts, ativação e limites de verificação. Não houve compra artificial nem disparo manual de mensagens.

## Resultado funcional

- Home preserva hero, Barlow Condensed, paleta escura e carrosséis. Meus materiais agrupa compras abaixo do principal; Explore outros produtos não oferece os seis complementos contextuais.
- Somente o principal adquirido apresenta ofertas associadas. Produto e primeiro item/direto usam a mesma composição. Capas verticais nas fileiras; imagem quadrada integral no modal.
- Sem principal adquirido/publicado, compras válidas de complementos permanecem avulsas. Associação não concede nem revoga acesso.
- Configuração reutilizável por loja, com padrão `legacy`; novas relações e visibilidade editáveis no admin e importador.
- Salvamento atômico com revisão editorial; lista omitida preserva, lista vazia limpa. Vínculo singular e aliases Payt permanecem.
- Prévia administrativa simula 0/1/todos/avulsos sem gravar compras ou progresso.
- Imagem quebrada apresenta título; falha nas relações mantém compras disponíveis e omite ofertas contextuais.

## Evidências

`artifacts/complementos-contextuais-20261024/qa/browser.json` registra 11 grupos de verificações no Chrome real, em 1440, 390 e 320 px, sem erros JavaScript e sem overflow horizontal. Capturas na mesma pasta. Autenticação e dados sintéticos são servidos exclusivamente por HTTP em loopback; o aplicativo real utiliza seus guardas e carregadores normais. Isso não é uma compra real nem prova de entrega transacional em produção.

`qa/postgres-concurrency.json`: PostgreSQL 18.4 real, duas conexões. Edição antiga aguardou a primeira transação e foi recusada com 40001, preservando título/relações vencedores. Relações concorrentes que criariam uma cadeia também foram recusadas.

Testes de projeção cobrem outras lojas, múltiplos pais, acesso avulso, reembolso e retomada por nível. Testes de rotas cobrem primeira aula, item direto, falha de relações, link antigo contextual e oferta singular. Regressões existentes de Payt e acesso integram a suíte completa; não foram inventados códigos dos novos bumps de Paisagismo.

Comandos reproduzíveis:
```powershell
npm test -- --maxWorkers=2 --testTimeout=20000
npm run lint
npm run build
git diff --check
node scripts/qa-contextual-complements-fixture.mjs --app
# Em outro terminal, PLAYWRIGHT_MODULE aponta para playwright instalado:
node scripts/qa-contextual-browser.mjs
# EMBEDDED_POSTGRES_MODULE aponta para embedded-postgres instalado:
node scripts/qa-contextual-concurrency.mjs
```

Os dois pacotes de QA não são dependências da aplicação. A fixture não aceita credenciais de produção: substitui URL/chaves de Supabase, Payt, Resend, origem e autenticação por valores locais. Não reutilizar em hospedagem pública. A fixture de concorrência usa uma pasta local nova e não é um comando de migração de produção.

## Revisão final e verificações

A revisão independente encontrou três problemas importantes e nenhum crítico. Todos foram reproduzidos em testes, corrigidos e verificados: chave composta no importador, preservação de bytes em upload seguido de conflito e manutenção das compras simuladas na navegação. Consulte [revisao.md](revisao.md).

Suíte final: **1.286 testes aprovados em 162 arquivos**. Lint: **zero erros, três avisos já presentes na base**. Testes reais de concorrência e os 11 grupos de navegação complementam a suíte. **Build final aprovado** após as correções. `git diff --check` sem erros. Evidências de comandos em `verificacoes/`.

## Artes e conteúdo

Seis novas capas 1024×1536 WebP, 187–456 KB, títulos conferidos em tamanho normal e miniaturas. Seis quadradas existentes reaproveitadas, exportadas em 1024×1024; nenhuma capa 2:3 foi cortada para simular 1:1. Manifesto com dimensões, bytes, SHA-256 e campo de destino em `capas/manifest.json`.

Cinco PDFs de Paisagismo: 242,60 → 194,05 MiB. Originais preservados; estrutura, texto, links e renderização de todas as páginas comparados pelo otimizador. Neste lote, pixels idênticos a 120 dpi em todas as páginas. Inspeção visual de capa e páginas de consulta registrada em `qa/material-validation.json`. Isso não equivale a uma auditoria editorial integral do conteúdo.

Biblioteca dos Mestres localizada concluída: 35 páginas, 74 links e 66 marcadores no PDF. A pendência anterior de produção do PDF foi resolvida. Os sete arquivos de entrega e as 12 capas foram enviados e conferidos por hash durante a publicação.

## Cobertura dos critérios de aceite

| Critério da especificação | Evidência / limite |
|---|---|
| 1. Netflix e larguras 1440/390/320 | Capturas browser.json; hero/carrosséis preservados |
| 2. Básico/Completo e zero/um/todos | Projeções e rotas; navegação real em um e todos; acesso e módulos por nível |
| 3. Acesso avulso | Browser solo e rotas de produto/item; testes existentes da rota protegida de download |
| 4. Agrupamento e reembolso independente | Projeção pura, retomada, suíte existente de direitos; browser com principal reembolsado |
| 5. Oferta apenas interna | Home sem oferta, principal com modal, link de compra antigo redirecionado |
| 6. Complemento compartilhado | Testes de projeção com seleção determinística do principal |
| 7. Admin/importador e atomicidade | SQL, ações, parser/executor, transporte Supabase e duas conexões PostgreSQL |
| 8. Legado/Protocolo/versions/prévias | Regressões de conteúdo/upsell e navegação simulada; cliente bloqueado negado |
| 9. Isolamento | Schema aditivo com defaults, testes de lojas/direitos; snapshot confirma outras lojas e produtos preservados |
| 10. Eventos de venda | Suíte existente de parser/processamento/idempotência/reembolso; IDs reais confirmados na Payt; pendente observação de entrega após pagamento real |
| 11. Artes | Doze WebP com dimensões/hashes; inspeção de títulos/miniaturas; modal quadrado no browser |
| 12. Testes integrados | 1.286 testes, banco real local, 11 grupos browser; produção conferida em prévia administrativa e sessão anônima |

## Publicação e limites

Os três complementos de Paisagismo foram cadastrados e publicados após a conferência dos códigos, bumps e checkouts na Payt. Patologias conserva seus produtos, ofertas e entregas existentes. Snapshots e revisão independente confirmam preservação dos dados anteriores.

A navegação em produção usa a prévia administrativa; não equivale a uma compra real. A primeira entrega resultante de pagamento real dos novos produtos ainda não foi observada. Não houve reprocessamento histórico nem recálculo de compras.

Consulte [publicacao.md](publicacao.md) para aplicação, evidências e reversão.

## Encerramento após revisão geral

Versão final preserva o cabeçalho compacto aprovado e os controles após as capas. Cinco regressões adicionais verificam a prévia contextual; suíte final com 1.291 testes em 162 arquivos, build aprovado e lint sem erros (três avisos anteriores). Revisão independente final sem bloqueios. A conferência autenticada adicional em produção não foi repetida nesta última correção porque a conexão do Chrome deixou de responder; status do deploy é verificado pela API oficial. A limitação de compra real permanece descrita em publicacao.md.
