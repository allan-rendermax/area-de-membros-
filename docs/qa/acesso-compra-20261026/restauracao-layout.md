# Restauração do layout anterior

O usuário rejeitou a ampliação da interface e pediu voltar ao desenho anterior, limitando a melhoria ao acesso aos order bumps. Esta correção parte de `6ab7164`, preservando a atualização de segurança publicada depois da interface.

## Escopo

- Renderização interna, coluna de conteúdos, ajuda, carrossel e rota sem material retornam à estrutura de `9acf602`.
- Removidos painel “Conteúdos da compra”, atalhos duplicados em mobile/desktop, links extras no cabeçalho, componente/helper de navegação e testes exclusivos dessa estrutura.
- Na fileira de capas já existente, o texto “Acessar material” passa a ser um link real para o complemento adquirido. Título, capas, status e dimensões originais permanecem. Parâmetros de prévia/simulação continuam no endereço.
- Rótulos Atlas/Guia/Material digital e abertura protegida em nova aba permanecem. O nome do produto continua sendo passado ao helper de nomenclatura.
- Home, layout raiz, CSS global, projeção de acesso, dependências, configuração Vercel e downloads não são alterados.

A lista de recursos e módulos que já existia antes do PR #2 não foi redesenhada. O runner `scripts/qa-purchase-ui-agent-browser.mjs` e as capturas anteriores documentam a interface agora rejeitada; não são o contrato de validação desta restauração.

## Verificação do implementador

- `npm ci`: concluído a partir do lockfile atual, 409 pacotes auditados, 0 vulnerabilidades reportadas.
- `npx vitest run tests/membros tests/access --maxWorkers=2 --testTimeout=30000`: **57 arquivos / 412 testes aprovados**.
- `npx tsc --noEmit`: aprovado.
- `npm run lint`: 0 erros, três avisos preexistentes.
- `git diff --check`: aprovado.
- Comparação com `9acf602`: carrossel, sidebar, ajuda e rota de produto idênticos; o renderizador de item difere somente pelo argumento de nomenclatura; a fileira de complementos difere somente pelo link no texto já existente.
- Teste renderizado verifica destino do link, preservação da prévia e ausência da nova navegação. Rota vazia verifica retorno original e ausência do painel extra.

Suíte integrada, conferência de navegador e publicação são etapas do controlador após este commit.
