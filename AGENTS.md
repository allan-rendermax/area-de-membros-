<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Intenção permanente do projeto

Leia [docs/diretrizes-da-plataforma.md](docs/diretrizes-da-plataforma.md) antes de modificar cadastros, integração Payt ou regras de acesso. Esta área de membros é uma base replicável para vários produtos, lojas e nichos; regras gerais devem ser configuráveis e reutilizáveis.

Os produtos atuais permanecem no modelo existente. Após aplicar a migração `20261023010000_checkout_plans.sql` e publicar o código correspondente, novos planos podem compartilhar um produto Payt com identificação explícita por checkout ou upsell. Não migrar automaticamente cadastros, pedidos ou liberações atuais. O código de referência de checkout não substitui os identificadores recebidos em eventos autenticados.
