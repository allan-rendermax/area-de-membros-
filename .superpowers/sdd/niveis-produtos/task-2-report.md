# Task 2 — Administração, ofertas e uploads privados

Implementado no branch `codex/niveis-produtos`.

## Entrega

- Produto aceita e persiste `upgrade_checkout_url` validado como HTTP(S).
- Módulo recebe `required_level` Básico/Completo no cadastro e na edição, com Básico como padrão.
- Oferta define `grant_level_<productId>` por produto, preserva bundles ao reabrir e salva os pares pela RPC transacional `save_offer_levels_atomic`. Nível ausente assume Completo para compatibilidade. Erro de migration ausente interrompe a gravação.
- Uploads novos do admin geram ticket para `arquivos-restritos` e referência autenticada estável; a interface envia ao bucket do ticket e mantém fallback `arquivos` para tickets antigos.
- Ao marcar módulo Completo ou salvar item nele, URLs próprias do bucket público legado `arquivos` são recusadas com pedido de reenvio. Links externos continuam aceitos. O action confere que o módulo do item pertence ao produto administrado.
- A migration `20260924010000_product_access_levels.sql`, de propriedade da Task 1, já provisiona `arquivos-restritos` privado. Não foi criada uma segunda migration redundante.

## Verificação

- RED observado para parsers (6 falhas esperadas), RPC/offer UI (3 falhas esperadas) e bypass de URL pública classificada como Link (1 falha esperada); GREEN após implementação.
- Testes focados: `npm test -- tests/admin/forms.test.ts tests/admin/offer-persistence.test.ts tests/admin/item-upload.test.ts tests/admin/item-upload-ui.test.ts tests/admin/private-file-guards.test.ts tests/admin/product-role-persistence.test.ts` — 59/59 passaram.
- ESLint nos arquivos próprios — passou sem saída.
- `npx tsc --noEmit` — passou.
- `npm test` durante trabalho paralelo — 71 arquivos passaram, 2 arquivos de testes de rotas de membros falharam (32 testes): mocks de `loadGrantedProductLevels` enquanto rotas ainda chamavam `loadGrantedProductIds`. São arquivos da Task 3 em implementação; não alterados nesta tarefa. A suíte integrada deve ser repetida quando essa tarefa estabilizar.

## Limites

- Nenhuma migration aplicada remotamente, deploy ou push. Arquivos públicos antes distribuídos precisam ser retirados no provedor se revogação desses links for necessária.
