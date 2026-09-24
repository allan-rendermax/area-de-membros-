# QA da integração — níveis e entregas recentes

Data: 2026-09-24. `agent-browser 0.38.1` contra o build local em `127.0.0.1:3191`, com provedor sintético em `127.0.0.1:54341` (`browser-fixture.mjs --production`). Sessões separadas para Básico, Completo e admin; navegação limitada a `127.0.0.1,localhost`. Nenhum serviço, credencial, pedido ou catálogo real foi usado.

## Resultado funcional

| Fluxo | Observação |
| --- | --- |
| Básico | Atlas exibe o módulo Básico e o extra apenas como título/contagem, sem link para o item extra. A sidebar contém só Guia básico; próximo conteúdo fica desabilitado no item. `Desbloquear versão completa` aponta a `/reference?checkout=upgrade`. [Produto desktop](screenshots/basic-product-desktop.png). |
| Progresso Básico | `Concluir` inseriu uma linha de `member_progress` para item `…0050`; após reload permaneceu `Concluído`. Desfazer voltou a `Concluir` e removeu a linha. O estado veio da consulta ao provedor, não só da UI local. [Item mobile](screenshots/basic-item-mobile.png). |
| Cupom | Produto publicado `oferta-aluno`, ausente de todos os pedidos, abriu `Resgatar meu cupom de 10%` e depois `Ir para o checkout com 10% de desconto`. O href é `/reference?coupon=ALUNO10&utm_source=members#payment`, distinto dos checkouts regular e upgrade. [Cupom mobile](screenshots/coupon-mobile.png). |
| Completo | Atlas exibe os dois módulos e links dos dois itens, sem CTA de upgrade. O item extra `…0051` tem navegação ao anterior e `Próximo conteúdo` desabilitado; conclusão persistiu após reload em `member_progress`. [Produto desktop](screenshots/complete-product-desktop.png), [item mobile](screenshots/complete-extra-mobile.png). |
| Ajuda | `Precisa de ajuda?` no item extra expandiu instruções de download, WhatsApp e email. O número do WhatsApp é sintético; apenas o href foi inspecionado, sem envio. [Ajuda mobile](screenshots/complete-help-mobile.png). |
| Falha de progresso | Com `progressFailure=true`, `Concluir` manteve o estado anterior, exibiu `Não foi possível salvar o progresso. Tente novamente.` e não criou linha do item Básico. O controle foi restaurado para `false`. [Erro mobile](screenshots/progress-failure-mobile.png). |
| Admin | No produto `oferta-aluno`, `Papel=Front`, checkout normal, checkout de upgrade e checkout de aluno aparecem juntos. `Salvar` retornou `Produto salvo.`; após reload os quatro valores permaneceram iguais. [Formulário desktop](screenshots/admin-product-desktop.png) e [mobile](screenshots/admin-product-mobile.png). |

Nas páginas verificadas a 390 e 1440 px, `document.documentElement.scrollWidth` foi igual a `innerWidth`. `agent-browser errors` não retornou erros JS nas três sessões. As capturas mostram a interface aprovada de item e toolbar preservada. Os testes anteriores de Payt, reembolso, upload privado e demais perfis permanecem documentados em [browser-report.md](../niveis-produtos/browser-report.md); não foram repetidos nesta rodada de integração.

## Ajuste visual verificado

Na primeira captura admin a 1440 px, o texto nativo do seletor de arquivo avançava sobre a coluna dos campos. O ajuste de contenção do commit `a260290` foi reconstruído e recapturado: o texto agora permanece na coluna da imagem no [desktop](screenshots/admin-product-desktop.png), e o [mobile](screenshots/admin-product-mobile.png) mantém os campos legíveis. Em ambas as larguras, `scrollWidth === innerWidth` e `agent-browser errors` permaneceu vazio.

## Limites

O provedor é em memória e simula Auth, PostgREST e Storage. Este teste visual não executa SQL ou políticas RLS nem efetua email, checkout ou contato externo. O build/testes/lint da integração foram executados separadamente; este relatório cobre apenas o navegador.
