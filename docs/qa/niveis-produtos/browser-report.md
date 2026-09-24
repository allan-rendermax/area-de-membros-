# QA integrado — níveis Básico e Completo

Data: 2026-09-24. App Next 16.3.5 em `127.0.0.1:3191`, Supabase/Storage sintético em `127.0.0.1:54341`, iniciado com `browser-fixture.mjs --production`. Navegador: `agent-browser@0.38.1`, sessões isoladas com domínio permitido `127.0.0.1,localhost`. Sem credenciais, banco, email, Payt ou storage reais.

## Navegador

| Perfil | Resultado observado |
| --- | --- |
| `basico@example.test` | `Seu acesso: Básico`; um produto/uma capa na vitrine; extra mostra só título e contagem, sem link de item; CTA aponta ao checkout fictício de upgrade. `Abrir primeiro conteúdo` aponta ao item Básico. |
| `completo@example.test` | `Seu acesso: Completo`; módulos Básico e Completo, links de ambos os itens; sem CTA de upgrade. |
| `upgrade@example.test` | Pedidos Básico + upgrade pagos resultam em Completo, extras visíveis, sem CTA. |
| `reembolso@example.test` | Pedido Básico pago + upgrade reembolsado resulta em Básico, extra oculto, CTA visível. |
| `bloqueado@example.test` | Login não concede sessão útil; tentativa de abrir o produto retorna à página de entrada. |

Com Basic autenticado, abrir diretamente `/arquitetura/item/00000000-0000-4000-8000-000000000051` redirecionou para `/arquitetura/produto/atlas?bloqueado=1`; a rota `/abrir` do mesmo item também redirecionou ao produto. A resposta HTML autenticada de Basic (34.371 bytes) e a resposta RSC `text/x-component` (7.011 bytes) não contêm `niveis-qa-test.pdf`, `modelo.pdf` nem o ID do item extra `000000000051`. Após o reenvio privado, a verificação foi repetida para o novo nome do arquivo. A vitrine retornou exatamente um link `/arquitetura/produto/atlas`.

Nas larguras 390 e 1440, `document.documentElement.scrollWidth <= innerWidth` nas páginas de membro verificadas. A captura Basic mobile final mostra a concordância corrigida `1 conteúdo bloqueado`. `agent-browser errors` não relatou erro JS nas sessões de membro e admin. As capturas estão em [screenshots](screenshots/): `basic-mobile.png`, `basic-desktop.png`, `complete-mobile.png`, `complete-desktop.png`, `upgrade-desktop.png`, `refunded-desktop.png`, `admin-product-desktop.png`, `admin-modules-desktop.png`, `admin-offer-desktop.png`.

## Admin e arquivos privados

Login administrativo sintético com `admin@example.test` e OTP fictício funcionou. No produto, a URL de upgrade foi alterada para `https://example.test/checkout/upgrade-v2`, salva e confirmada após reload; o CTA Basic mostrou esse destino. O módulo extra foi alternado para Básico, salvo/recarregado, e restaurado para Completo, novamente salvo/recarregado. Na oferta `BASIC-QA`, o grant foi alternado Complete→Basic via `save_offer_levels_atomic`; ambos os estados persistiram após reabrir a oferta, com o código Payt preservado.

O admin enviou `niveis-qa-test.pdf` pelo controle do item Complete. O fake registrou `createSignedUploadUrl` no bucket `arquivos-restritos` e `uploadToSignedUrl` (325 bytes). O item foi salvo com referência `authenticated/arquivos-restritos` e o novo caminho permaneceu após reload. O endpoint real `/abrir` respondeu HTTP 307 com `Location` para o arquivo privado assinado; a URL assinada respondeu 200 `application/pdf` (30 bytes sintéticos), e o acesso ao item foi registrado. O fake recebeu `createSignedUrl` com `expiresIn: 60`. Dados exatos em [download-evidence.json](download-evidence.json).

O download PDF por navegação direta do `agent-browser` perdeu o contexto CDP ao sair do app. O resultado HTTP foi confirmado separadamente com o cookie sintético do perfil Complete; isso limita apenas a observação visual do visualizador PDF. Um `fetch` de navegador que seguia o redirecionamento também falhou no contexto de automação, mas o provider registrou a requisição e a prova HTTP direta confirmou 307→200.

## Payt sintético

Verificação HTTP suplementar na rota real `/api/webhooks/payt`, com o mesmo aluno `reembolso@example.test` e sem reiniciar nem recadastrar o produto: antes Basic com CTA; POST `paid` do código `UPGRADE-QA` retornou 200/`liberado` e a página autenticada virou Complete, com extra e sem CTA; POST `refunded` da mesma transação retornou 200/`atualizado` e a página voltou a Basic, com CTA e sem extra. O pedido terminou `reembolsado` na fixture. Respostas e estados em [webhook-evidence.json](webhook-evidence.json). Esta sequência foi verificada por HTTP autenticado, além da inspeção visual dos perfis estáticos no navegador.

## Limites e ajuste da fixture

O fake simula PostgREST, Auth e Storage, sem executar migration SQL ou política RLS. O preload do Next impede `fetch` para fora do loopback; entrega real de email e checkout não foram testados. Para salvar a URL no admin, desativei as imagens sintéticas via `/__control`, pois a imagem relativa da fixture era rejeitada pela validação HTTPS do formulário. A fixture recebeu correções de inicialização `NODE_OPTIONS` no Windows, caminho relativo da assinatura e CORS/preflight do storage; nenhum arquivo do aplicativo foi alterado nesta tarefa de QA. `node --check` passou para a fixture final.
