# Validação — acesso interno à compra

Implementação na branch `codex/compra-acesso-ui`, base `611aac7`, código validado em `b554ff5`. Execução local com dados sintéticos; nenhuma alteração de produção, cadastro, pedido, Payt ou concessão de acesso.

## Resultado

- Página inicial preservada. Nenhuma mudança nos arquivos da home, cabeçalho, CSS global ou projeção de acesso. No mesmo cenário, textos, links, fontes e geometria de todas as seções da home são idênticos (`home-before.json`, `home-after.json`).
- Layout interno conserva título, faixa de recursos, coluna de conteúdos e capas. Navegação mostra principal e complementos adquiridos, item atual e retorno ao principal. Links continuam disponíveis no celular.
- Rótulos gerados para o aluno usam Atlas, Guia ou Material digital conforme o título. URLs, extensões, tipos MIME e cadastro administrativo continuam técnicos. Vídeos, links e formatos editáveis preservam os rótulos adequados.
- Carrosséis internos escondem controles quando não existe conteúdo para rolar. O padrão dos carrosséis da home foi preservado.

## Evidências de verificação

| Verificação | Resultado |
| --- | --- |
| Baseline | 162 arquivos / 1.291 testes aprovados |
| Suíte final em `b554ff5` | 167 arquivos / 1.317 testes aprovados, 82,07 s |
| `npm run lint` | 0 erros, 3 avisos preexistentes |
| `npm run build` | Compilação, TypeScript e geração de páginas aprovadas |
| Vercel agent-browser 0.38.1 | 18 grupos de verificações aprovados |
| JavaScript no navegador | Nenhum erro registrado na sessão final |
| Layout mobile | 320 e 390 px sem rolagem horizontal; título antes dos atalhos |

Logs: `baseline-tests.log`, `tests.log`, `lint.log`, `build.log`. A suíte ainda emite o aviso preexistente de configuração Vite; não foi necessário alterar dependências. Os três avisos do lint são variáveis não utilizadas em arquivos administrativos preexistentes.

`browser-validation.json` registra: Atlas → Guia → Atlas por cliques; abertura do material em outra aba; rota direta de item; ausência de complementos; reembolso do complemento e do principal; compra avulsa; principal em rascunho; relação removida; múltiplos complementos a 320 px; preservação da prévia `complete` com `one` e `all`; igualdade da home e ausência de erros de JavaScript.

Os screenshots foram inspecionados visualmente. A comparação dos pixels de `home-before.png` e `home-after.png` detectou diferença somente no retângulo x=1204–1332, y=17–50: o botão preexistente “Instalar app”, cuja presença depende do evento de instalação do navegador e do estado da sessão. Todos os pixels fora desse retângulo são iguais. Cabeçalho e PWA não foram modificados.

## Limites da homologação

O backend local simula autenticação, compras e destinos de materiais. O clique abre a página “Homologação local”; não valida download de um arquivo real nem uma transação real. A fixture usa links externos; a nomenclatura de recursos de arquivo está coberta nos testes renderizados de `ResourceList` e nos testes do helper de rótulos. A capa principal já existente no workspace foi incluída como recurso da fixture para tornar as capturas reproduzíveis.

## Reproduzir

1. Instalar as dependências com `npm ci`.
2. Rodar `node scripts/qa-contextual-complements-fixture.mjs --app`. A aplicação responde em `127.0.0.1:3180` e o backend sintético em `127.0.0.1:54329`.
3. Instalar/inicializar Vercel agent-browser 0.38.1. No Windows, iniciar a sessão `compra-ui-final-20261026` pelo shell antes de executar o runner: `agent-browser --session compra-ui-final-20261026 open http://127.0.0.1:54329/login`.
4. Definir `AGENT_BROWSER_BIN` com o caminho absoluto do executável e rodar `node scripts/qa-purchase-ui-agent-browser.mjs`. O runner controla o navegador exclusivamente pelo CLI agent-browser.
5. Para conferir manualmente, abrir `http://127.0.0.1:54329/login?next=/arquitetura/produto/paisagismo` enquanto a fixture estiver rodando.

Comandos de qualidade: `npm test -- --maxWorkers=2 --testTimeout=20000`, `npm run lint`, `git diff --check`. Para build sem configuração de produção, definir `DEFAULT_STORE_SLUG=arquitetura` e `APP_URL=http://127.0.0.1:3180` e rodar `npm run build`.

## Decisões tomadas

1. Não inventar a contagem de quatro materiais do piloto: o catálogo não fornece um inventário genérico confiável. Custo: o detalhamento da quantidade fica dependente de metadados futuros.
2. Remover PDF/PDFs da apresentação gerada para membros, preservando formatos e endereços técnicos. Custo: nomes técnicos ainda podem aparecer no visualizador externo ou no arquivo baixado.
3. Manter a implementação em branch isolada, sem publicar. Custo: a disponibilização em produção depende de uma etapa posterior de publicação.

Relatórios das tarefas em `task-1-report.md` e `task-2-report.md`; decisões em `decisions.md`. A revisão independente final aprovou a implementação, sem apontamentos críticos ou importantes. O único ajuste documental foi corrigido e conferido em uma revisão posterior; ver `final-review.md`.
