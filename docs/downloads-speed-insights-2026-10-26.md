# Downloads e Speed Insights — 26/10/2026

## Escopo

Correção autorizada dos downloads e integração do Speed Insights já contratado. Base publicada: `914f1f64f384b0dd6ef996b5a7545c8d1c4e19b7`. Trabalho isolado das alterações locais em `codex/ofertas-com-planos`.

- URLs assinadas de arquivos privados passam de 60 para 900 segundos (15 minutos).
- O redirecionamento 307 não pode ser armazenado em cache (`private, no-store`).
- Falha temporária ao assinar um arquivo canônico retorna HTML 503 com nova tentativa pela mesma rota protegida e retorno ao material. Não expõe erro interno ou URL assinada. Prévia, simulação e complementos são preservados.
- Arquivos abrem em nova aba, mantendo a página de origem disponível. A orientação para abrir em outro navegador pede o link da página do material.
- `@vercel/speed-insights/next` é montado uma vez no layout raiz, por um componente cliente. `beforeSend` remove query, fragmento e credenciais de URL; descarta admin, API e prévias/simulações administrativas. O SDK usa a configuração de ingestão fornecida pela Vercel.

Não há mudança de schema, bucket, publicação de conteúdo, sessão, compra, nível Básico/Completo, Payt, concessão de acesso ou cadastro. Uma nova tentativa repete os mesmos controles existentes antes de assinar o arquivo. Os arquivos continuam sendo servidos diretamente pelo Storage, sem proxy de conteúdo pela Vercel.

## Evidências e testes antes da publicação

O diagnóstico anterior identificou tokens expirados em Safari móvel, uma assinatura malformada e acessos de robôs de prévia. Os 58 arquivos privados atuais existiam no Storage. Aumentar a validade reduz a expiração durante abertura/troca de navegador; não torna permanentes links assinados antigos. Links antigos salvos/compartilhados devem ser substituídos pelo link da página do material.

- Baseline: 175 arquivos, 1.431 testes passando.
- Resultado da alteração: 176 arquivos, 1.443 testes passando, com `npm test -- --maxWorkers=2 --testTimeout=30000`.
- Cobertura específica: TTL, assinatura permitida/bloqueada, isolamento de loja, rascunhos, níveis, retry com assinatura nova e sessão revalidada, falha 503 sem dados sensíveis, navegação em nova aba e filtragem de telemetria.
- `npm run build`: passou, carregando o ambiente local existente apenas no processo de build e usando a URL pública. A primeira execução sem ambiente falhou por ausência de `DEFAULT_STORE_SLUG`; não foi uma regressão de código.
- `npx tsc --noEmit`: passou.
- `npm run lint`: sem erros; três avisos preexistentes em `trocar-admin-e-aluno.mjs`, `locked-product-fields.tsx` e `upgrade-fields.tsx`.
- Revisão independente: nenhum achado crítico/importante; autorização permanece anterior à assinatura e ao 503.
- Probe prévio sem cookie: `/_vercel/speed-insights/script.js` responde 200 JavaScript diretamente, sem ser interceptado pelo Proxy de sessão. Nenhuma alteração de autenticação foi necessária.

## Operação

Projeto Vercel: `area-de-membros-`, equipe `rendermax`. Domínio: <https://members.grupoelevamax.com>.

Deploy anterior para rollback: `dpl_HtVYHPs37h22rK5p73Bte6ppUC7U`, <https://area-de-membros-5whcf0lvz-rendermax.vercel.app>.

O Speed Insights Plus já estava ativo, mas sem dados e sem SDK. Esta integração não contrata pacote, não muda cobrança/configuração e não garante métricas instantâneas: os eventos dependem de navegação real e processamento no painel. Prévia administrativa é deliberadamente excluída.

O audit de dependências identificou alertas preexistentes no Next 16.3.5, sharp, source-map-js e zod. Não foram introduzidos pelo SDK. Uma atualização de dependências deve ser avaliada com os avisos oficiais e testes próprios; esta entrega mantém o framework para limitar o escopo à correção autorizada.

As evidências posteriores à publicação ficam no relatório operacional local da auditoria, com o identificador do deploy, respostas HTTP e limites do teste com navegador.
