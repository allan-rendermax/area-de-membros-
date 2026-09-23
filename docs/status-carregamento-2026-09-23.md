# Carregamento da área de membros — segunda rodada, 23/09/2026

## Mudanças

- Metadados públicos da loja (nome, logo, suporte e imagem de entrada) reutilizados entre requisições. Cache por slug, revalidação em 300 segundos e invalidação imediata da tag após salvar pelo painel, incluindo nomes antigos e resultados de loja inexistente.
- Módulos e materiais obtidos em uma consulta relacional, preservando rascunhos no admin, publicação, ordem e módulos vazios.
- Após autorizar uma aula, leitura dos irmãos e gravação de acesso executadas em paralelo. A página continua aguardando ambas; erros continuam sendo propagados.
- Estados de carregamento específicos para produto/aula. Páginas prontas preservadas.
- `vercel.json` prepara execução em São Paulo (`gru1`) no próximo deploy.

Nenhum cache foi adicionado a sessão, cliente, pedidos, ofertas, permissões, produtos, módulos ou itens. Nenhuma migração, dependência de produção, alteração de dados reais, DNS ou ambiente remoto.

## Comparação controlada

Build de produção Next.js 16.3.5, mesmo fixture sintético e 100 ms de latência por chamada Auth/REST. Baseline de código `2f89ff1`; final de código `44f1326`. Mediana de três amostras após uma primeira amostra separada, usando a mesma sessão/dataset. Tempo até receber o corpo completo da resposta HTTP. As amostras chamadas `first` nos JSONs são as primeiras do protocolo após login; não representam necessariamente cache vazio nem cold start da função.

| Rota | Antes | Depois | Chamadas Auth/REST antes → depois |
| --- | ---: | ---: | ---: |
| Login, cache aquecido | 122,0 ms | 9,1 ms | 1 → 0 |
| Vitrine | 434,2 ms | 431,9 ms | 8 → 7 |
| Produto | 648,9 ms | 539,1 ms | 9 → 7 |
| Aula de vídeo | 650,0 ms | 539,8 ms | 9 → 8 |
| Página de recurso | 541,6 ms | 539,9 ms | 8 → 7 |
| Abrir arquivo | 541,2 ms | 541,0 ms | 8 → 7 |

Login aquecido reduziu aproximadamente 93%; produto e vídeo, 17%. Vitrine e recursos não tiveram redução relevante no tempo total: a consulta de loja deixou de acontecer, mas outras etapas ainda determinam a espera. O teste de abrir arquivo mede o redirecionamento autorizado, não o download completo.

Esses números isolam o efeito do código em condições controladas; não são uma promessa para produção e não incluem o possível ganho geográfico. O primeiro carregamento com cache vazio continua precisando consultar a loja. Alterações diretas no banco fora do painel dependem da revalidação de 300 segundos; essa revalidação pode servir o valor anterior enquanto busca a atualização em segundo plano e não é uma garantia rígida de atualização em cinco minutos.

## Infraestrutura

Vercel inspect confirmou o deploy publicado `dpl_5T5tZH4ZbqmUesP6TtzFveki69HT` em `iad1` (EUA). DNS do endpoint do banco resolveu para `2600:1f1e:b2a:a301:c879:17f4:a2b6:52f5`. O [arquivo oficial de faixas da AWS](https://ip-ranges.amazonaws.com/ip-ranges.json), versão `2026-09-23-18-47-06`, mapeia esse IP para `2600:1f1e::/36`, região e network border group `sa-east-1`, São Paulo. Isso sustenta a configuração local `regions: ["gru1"]`, seguindo a [orientação de aproximar funções e banco](https://vercel.com/docs/functions/configuring-functions/region).

O JSON foi validado contra o schema oficial da Vercel. Ajv 6 exigiu desabilitar a validação do próprio schema contra o meta-schema por uma incompatibilidade Draft 4; a validação do documento continuou ativa, e uma lista de regiões vazia foi rejeitada no teste negativo. `gru1` foi conferido na lista oficial de regiões.

A configuração regional só terá efeito no próximo deploy. Nenhum deploy, push ou mudança no painel da Vercel foi realizado nesta rodada. O site publicado permanece na versão anterior.

## Verificações de código

- `npm test`: 62 arquivos, 491 testes aprovados.
- `npx tsc --noEmit --incremental false`: saída 0.
- `npm run lint`: saída 0; somente aviso preexistente de variável `loja` não utilizada em `scripts/trocar-admin-e-aluno.mjs`.
- `npm run build`: saída 0, build de produção concluído no worktree com ambiente sintético.
- TDD observado: cache/invalidação, consulta relacional, concorrência e loading. Testes usam transporte Supabase real com respostas simuladas e promessas controladas.
- Consulta relacional mínima com filtros/ordem em ambos os níveis também verificada somente por leitura no PostgREST real: HTTP 200, relação `items` presente. Nenhum dado de conteúdo foi impresso ou modificado.
- Revisões independentes por tarefa aprovadas. Aviso anterior do Vitest/Vite sobre ESM/CommonJS preservado, sem supressão.

## Navegador e evidências

Agent-browser da Vercel 0.38.1 em build real, desktop 1440×1000 e mobile 375×812. Capturas de login, produto, vídeo e recurso são idênticas por SHA-256 entre baseline e final nas duas resoluções. Vitrine foi inspecionada visualmente; imagens e estrutura permanecem compatíveis. Nenhum overflow horizontal ou erro JavaScript nas capturas registradas.

Invalidação comprovada pela UI administrativa com o cache real do Next:

- Editar o nome refletiu imediatamente no login: primeira leitura após salvar consultou `stores` uma vez; a seguinte fez zero consultas.
- Renomear loja não padrão invalidou o slug aquecido: antigo retornou 404 e novo retornou 200 com os dados corretos. Renomear a loja padrão continuou sendo recusado.
- URL de loja inexistente retornou 404 duas vezes com uma consulta total; após criar a loja no painel, passou imediatamente a 200 com uma consulta, seguida de 200 com zero consultas. Isso valida invalidação de resultado negativo.

Navegação por clique vitrine → produto não gravou acesso a aula; produto → vídeo gravou um acesso. Próxima aula, voltar, abrir arquivo sintético e fechar/reabrir modal funcionaram.

O fixture antigo de autenticação não incluía `session_id` no JWT, campo exigido pelo login administrativo já existente. O suporte sintético foi corrigido para concluir os testes do painel; não houve correção de autenticação no produto. Essa correção ocorreu após as medições comparáveis e não altera sua latência/dataset de aluno.

Guardas verificadas em novas requisições: produto/item ocultos e de outra loja exibiram página não encontrada; produto sem compra abriu o modal bloqueado; aluno bloqueado foi levado ao login; reembolso retirou acesso ao produto e ao vídeo. Na abertura de arquivo, outra loja retornou 404, bloqueio redirecionou ao login e reembolso redirecionou ao modal de compra. Nenhuma tentativa negada criou registro de acesso. Os controles sintéticos de bloqueio/pagamento foram restaurados.

Revisão final ampla concluída sem achados acionáveis; as condições de invalidação e segurança exigidas pelo revisor foram satisfeitas pelo QA. Navegações por clique foram verificadas funcionalmente; não há comparação numérica controlada do tempo percebido de clique nem medição de cold start de produção.

Evidências fora do Git: `C:/Users/arqal/.codex/visualizations/2026/09/23/01a0cff0-d2e8-7822-a447-9b5470319792/carregamento-real/`. Arquivos principais: `baseline-routes.json`, `final-routes.json`, `baseline-screens.json`, `final-screens.json`, capturas PNG e scripts do fixture/protocolo. Estados de autenticação nesse diretório são exclusivamente sintéticos e não fazem parte do commit.

## Processo e decisões

Usuário autorizou brainstorming, aprovação autônoma de design/plano, execução sem perguntas, subagentes e paralelismo. Implementações de cache e conteúdo ocorreram em arquivos disjuntos; commits e integração ficaram com o controlador. O cache usa a API documentada para o modelo atual sem `cacheComponents`, evitando uma migração ampla. A região foi incluída somente depois de obter evidência do endpoint do banco. A aprovação de código e o teste local não substituem a medição pós-deploy.
