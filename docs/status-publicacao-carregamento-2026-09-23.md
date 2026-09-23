# Publicação das melhorias de carregamento — 23/09/2026

- Autorização explícita: “pode implementar e fazer deploy”.
- Commit publicado por push normal em `main`: `f7ca4b78f4de27569373d9b4c822c4b67064e440`.
- Deploy: `dpl_6CMYzWBsiEe1sNzv1SvhTUwganJS`, Ready / Production.
- URL: https://area-de-membros-cfs2ixjdt-rendermax.vercel.app.
- Domínio oficial confirmado por `vercel inspect`: https://members.grupoelevamax.com.
- Funções executadas em São Paulo (`gru1`), confirmadas na listagem do deploy e em `X-Vercel-Id: gru1::gru1::…`. O build foi realizado em `iad1`; região de build e região de execução são distintas.
- Deploy anterior preservado para eventual rollback: https://area-de-membros-dbrypfi2z-rendermax.vercel.app (`dpl_5T5tZH4ZbqmUesP6TtzFveki69HT`).

## Validação

Antes do push, 491 testes passaram em 62 arquivos; TypeScript retornou saída 0; lint retornou saída 0, com o aviso preexistente sobre `loja` não utilizada em `scripts/trocar-admin-e-aluno.mjs`. Build remoto de produção concluído com sucesso em 24 segundos, incluindo compilação, TypeScript e geração das páginas. Os logs confirmam o commit `f7ca4b7`.

No domínio oficial, `/arquitetura/entrar` e `/admin/entrar` retornaram HTTP 200. Sem sessão, `/arquitetura`, `/admin`, uma rota de aula e sua rota `/abrir` retornaram HTTP 307 para o respectivo login.

Agent-browser da Vercel verificou as quatro rotas de login/área protegida em 375×812 e 1440×1000: oito cenários, nenhum erro JavaScript, nenhum overflow horizontal, imagens carregadas e redirecionamentos corretos. A captura do login mobile também foi inspecionada pelo controlador. Não houve envio de código por e-mail nem login real de aluno/admin nesta publicação; os fluxos autenticados completos foram validados anteriormente no ambiente local sintético.

Evidências: `C:/Users/arqal/.codex/visualizations/2026/09/23/01a0cff0-d2e8-7822-a447-9b5470319792/carregamento-real/deploy-producao/`, incluindo `smoke.json` e oito capturas PNG.

## Medição pontual em produção

Cinco requisições `curl` por rodada para `/arquitetura/entrar`, da mesma máquina, antes e depois da publicação. Valores abaixo são TTFB, em milissegundos, incluindo estabelecimento da conexão; não são tempo visual de página pronta.

| Rodada | Amostras | Mediana |
| --- | --- | ---: |
| Antes | 1341,940; 480,083; 702,266; 669,186; 685,590 | 685,590 |
| Depois | 136,594; 263,212; 126,849; 132,232; 121,971 | 132,232 |

A mediana das cinco amostras caiu aproximadamente 81%. A rodada posterior ocorreu após as verificações HTTP, com a aplicação já acessada. Não há isolamento de cold start, cache ou variabilidade de rede, nem benchmark de navegação autenticada em produção. As medições sintéticas anteriores continuam documentadas em `status-carregamento-2026-09-23.md`.

Os arquivos preexistentes modificados e não rastreados permaneceram locais. Nenhuma alteração em DNS, dados reais, schema ou variáveis de ambiente. A mudança de região foi aplicada pelo `vercel.json` já aprovado.
