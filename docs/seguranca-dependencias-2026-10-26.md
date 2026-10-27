# Segurança das dependências: 26/10/2026

## Escopo e estado da entrega

Atualização das dependências sinalizadas pela auditoria npm, autorizada para correção dos alertas de segurança. Este registro reúne as verificações anteriores à publicação; não confirma que a versão já esteja em produção.

Base de comparação: `73914bbecdcb2b0348480968ee6210886134bf4f`, com a interface de acesso/compra já integrada. Correção: `ef144f2`, na branch `codex/security-dependency-updates`. O diff funcional dessa correção contém somente `package.json` e `package-lock.json`; este relatório e o link no README são documentação adicional.

Nenhum arquivo de `src/`, `supabase/`, `scripts/` ou `next.config.*` foi alterado pela correção. Não há migração de banco, alteração de cadastros, checkouts, regras Payt, níveis ou concessões de acesso. As [diretrizes da plataforma](diretrizes-da-plataforma.md) continuam válidas.

## Versões resolvidas

As versões abaixo são as efetivamente fixadas no `package-lock.json`, comparadas com a base. Faixas declaradas em `package.json` podem ter um mínimo diferente da versão resolvida.

| Pacote | Antes | Depois | Papel na aplicação |
| --- | --- | --- | --- |
| `next` | 16.3.5 | 16.4.3 | Framework de produção |
| `eslint-config-next` | 16.3.5 | 16.4.3 | Configuração de lint alinhada ao framework |
| `zod` | 4.6.5 | 4.6.7 | Validação de dados |
| `happy-dom` | 20.14.5 | 21.0.4 | DOM simulado dos testes |
| `vitest` | 5.0.1 | 5.0.5 | Executor de testes |
| `@vitest/mocker` | 5.0.1 | 5.0.5 | Dependência de testes |
| `vite` | 8.3.0 | 8.3.5 | Dependência das ferramentas de desenvolvimento/testes |
| `sharp` | 0.35.4 | 0.35.5 | Processamento de imagens |
| `source-map-js` | 1.2.1 | 1.2.2 | Dependência transitiva de mapas de código |

Além dos pacotes listados, o lockfile registra as atualizações transitivas necessárias à resolução. A atualização do `eslint-config-next` mantém o alinhamento de versão; ele não era um dos oito pacotes sinalizados no baseline.

## Auditoria antes e depois

| Severidade agregada por pacote no npm audit | Antes | Depois |
| --- | --- | --- |
| Crítica | 1 | 0 |
| Alta | 5 | 0 |
| Moderada | 2 | 0 |
| Baixa/informativa | 0 | 0 |
| Total de pacotes sinalizados | 8 | 0 |

O resultado completo, incluindo dependências de desenvolvimento, ficou em zero. A verificação com `--omit=dev` também ficou em zero. O total acima conta pacotes sinalizados, não avisos individuais: um mesmo pacote pode reunir vários advisories.

Evidências preservadas localmente na pasta operacional `artifacts/seguranca-area-membros-2026-10-26/`: `audit-before.json` e `audit-after.json`. Os arquivos completos não são incorporados a esta documentação pública.

## Verificações antes da publicação

| Verificação | Resultado |
| --- | --- |
| Suíte completa de testes após integrar a interface atual | 181 arquivos e 1.469 testes passaram; 90,78 s |
| `npm run build` | Passou com Next.js 16.4.3 |
| `npx tsc --noEmit` | Passou |
| `npm run lint` | Zero erros; três avisos preexistentes |
| `npm ls --all --omit=optional` | Saída 0, sem erro na árvore verificada |
| Revisão independente do diff de dependências | Aprovada; alterações restritas aos dois arquivos de pacotes, conferidas contra as bases da revisão |

Os avisos de lint permanecem em `trocar-admin-e-aluno.mjs`, `locked-product-fields.tsx` e `upgrade-fields.tsx`. Os testes e a compilação verificam compatibilidade local; não comprovam uma compra, login ou liberação real em produção.

## Publicação e retorno

Domínio de produção: [members.grupoelevamax.com](https://members.grupoelevamax.com). Projeto Vercel: `area-de-membros-`, equipe `rendermax`.

Ponto de retorno registrado antes desta publicação: deploy `dpl_vFevUZDJsdw9NusyUNXGhsiJGnuT`, commit `73914bb`, [URL do deploy anterior](https://area-de-membros-33h93u5uq-rendermax.vercel.app).

A confirmação posterior deve registrar commit e deploy efetivamente publicados, estado Ready/Production, domínio atribuído, verificações HTTP e limites dos testes realizados. Essas evidências ficam no relatório operacional local da rodada. Este documento não substitui essa confirmação.

## Limites

Zero alertas no npm audit significa que a árvore consultada não recebeu alertas conhecidos daquela base no momento da consulta. Não é uma auditoria de todas as falhas possíveis nem comprova ausência de exploração anterior. Os avisos dos fornecedores descrevem condições específicas; sua presença na árvore não demonstra, por si só, que cada condição era explorável nesta aplicação. Novos advisories podem alterar o resultado de consultas futuras.

Os [registros anteriores de downloads e Speed Insights](downloads-speed-insights-2026-10-26.md) preservam o estado daquela entrega, inclusive os alertas então pendentes. Esta rodada trata a atualização de dependências separadamente.

## Referências dos avisos

URLs registradas no baseline da auditoria npm, agrupadas pelo pacote afetado:

- Next.js: [ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), [Draft Mode e cache](https://github.com/advisories/GHSA-3w37-wq28-93x7), [SSG/ISR em hospedagem própria](https://github.com/advisories/GHSA-4jqv-mc3x-m676), [MCP de desenvolvimento](https://github.com/advisories/GHSA-39w2-rjm5-chcv), [rotas de imagens de metadados](https://github.com/advisories/GHSA-f87g-xv8r-7p7x), [substituição de conteúdo e negação de serviço em cache](https://github.com/advisories/GHSA-mcj8-r9mp-w47p), [SSRF na otimização de imagens](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [execução de código com SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [negação de serviço em Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), [cache entre parâmetros raiz](https://github.com/advisories/GHSA-h694-7cp9-m8p3) e [execução de código com typed arrays no cache](https://github.com/advisories/GHSA-673q-mjm6-r5xr). Publicação do fornecedor: [Next.js 16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3).
- Zod: [consumo de memória ao validar coleções](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Happy DOM: [alias de importação e execução de código no host](https://github.com/advisories/GHSA-834v-8h66-3h79).
- Vitest / `@vitest/mocker`: [registro de mocks sem autenticação](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) e [travessia com barras invertidas no Windows](https://github.com/advisories/GHSA-xp26-3454-mjgp).
- Vite: [escape de comandos no Windows](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [interpretação de flags do editor](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [checagem de existência de arquivos no Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [scripts entre origens](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), [arquivos fora de server.fs.allow](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) e [leitura parcial por vite-wasm-instance](https://github.com/advisories/GHSA-vfpm-58rq-9qcg).
- Sharp: [vulnerabilidade na dependência librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).
- source-map-js: [negação de serviço por offsets de mapas indexados](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
