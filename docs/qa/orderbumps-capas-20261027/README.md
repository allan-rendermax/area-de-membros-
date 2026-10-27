# Retorno das capas e dos complementos — prévia de 27/10/2026

Registro da prévia. Publicação autorizada pelo usuário em 27/10/2026; resultado registrado em `publicacao.md`.

## Resultado

- Cards existentes de complementos recolocados na coluna principal. Após a conferência, o usuário aprovou a posição imediatamente abaixo do banner do Protocolo (commit `efec391`). As capturas desta pasta registram a etapa anterior; a publicação terá capturas próprias.
- Banner original do Protocolo Anti-Retrabalho preservado, conforme confirmação expressa do usuário.
- Atlas Completo continua com dois materiais; Básico com um. Downloads individuais não foram reintroduzidos.
- Comprados abrem seus materiais; não comprados abrem a oferta e o checkout cadastrado.
- Página inicial, autorização, níveis, regras de compra e dependências sem alteração de código.
- Correções pontuais de unicidade da âncora de ofertas e largura da grade em 320px.

## Catálogo proposto, somente na fixture local

`data-plan.json` registra cada valor anterior e proposto. As capas históricas dos três produtos abaixo retornam, com visibilidade `catalog`; os três continuam relacionados ao Atlas de Patologias:

1. Kit Gestão de Obras.
2. Kit Captação e Atendimento de Clientes.
3. Orçamento de Obras na Prática.

Os nove demais order bumps permanecem `contextual`. As seis relações existentes são preservadas; seis associações de Hospitalar/Urbanismo são acrescentadas conforme os registros de publicação desses produtos. Não há exclusão nem alteração de módulos, materiais, checkouts, imagens de compra ou direitos.

Os seis complementos de Hospitalar/Urbanismo não têm checkout avulso cadastrado. A prévia mantém o acesso de quem comprou; para quem não comprou, o modal informa a indisponibilidade de compra. Nenhum checkout ou preço foi inventado.

## Evidências

- `browser-results.json`: 20 verificações com Vercel agent-browser, incluindo 1440/918/390/320px; nenhum/um/todos complementos comprados; Básico/Completo; três modais e destinos exatos; três produtos na vitrine e nove contextuais; acesso de compra avulsa; associações de Paisagismo, Hospitalar e Urbanismo.
- `links-results.json`: três checkouts Payt reais carregados com produto e R$19,90, sem preencher formulário nem efetuar compra; âncoras de oferta únicas nas rotas de produto e item.
- `data-plan.json`: três imagens antigas responderam HTTP 200, hashes SHA-256 iguais ao registro histórico de setembro. Campos e associações propostos ficam explícitos.
- Capturas: `atlas-1440.png`, `atlas-918.png`, `atlas-390.png`, `atlas-um-adquirido.png` e `vitrine.png`.
- Revisão independente: aprovada após correção da âncora duplicada. Nenhuma mudança de autorização ou banner encontrada.
- Build de produção aprovado após todas as correções. TypeScript e lint dos arquivos alterados aprovados. Lint geral tem sete avisos anteriores fora do escopo.
- Suíte final após as correções: **178 arquivos / 1.469 testes aprovados**, com `npm test -- --maxWorkers=2`. A concorrência padrão excedia o tempo de inicialização do PGlite; a execução limitada terminou sem falhas.

As contas, pedidos e direitos da prévia são simulados no backend loopback. Seus materiais apontam para destinos locais; capas e checkouts usam os URLs reais. Os testes de checkout verificam carregamento e destino, não a conclusão de pagamento.

## Recuperação preservada

O backup publicado anterior continua intacto: tag `backup/layout-original-19-outubro-aprovado-20261027`, produção `16c09952edd3f90f288df1c965d753965696594c` e pasta `C:/Users/arqal/OneDrive/Desktop/Backups Area de Membros/2026-10-27-original-19-outubro/`.

Antes de publicar esta prévia, conferir o catálogo vivo contra os valores anteriores de `data-plan.json` e aplicar somente as alterações aprovadas; não substituir o banco por uma fixture.
