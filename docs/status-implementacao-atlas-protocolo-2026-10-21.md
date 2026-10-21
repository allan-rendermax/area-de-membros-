# Atlas e Protocolo — implementação e validação

Concluído localmente em 21/10/2026. Produção não foi alterada nesta entrega.

## Comportamento entregue

- A trilha com um vínculo válido passa à primeira linha. Atlas e Protocolo ocupam as duas primeiras posições, inclusive quando o Protocolo não foi comprado; o complemento não fica duplicado em outra trilha.
- A capa do comprador abre os materiais do Protocolo. A capa de quem não possui abre diretamente o checkout cadastrado.
- O Atlas mostra um cartão de Protocolo no painel Conteúdos. No celular ele permanece visível com o painel recolhido.
- O bloco abaixo dos arquivos usa a mesma verificação de acesso: quem comprou vê acesso aos materiais, sem oferta de recompra.
- Links antigos `?comprar=` continuam mostrando uma chamada de compra. Os demais produtos bloqueados conservam o modal existente.
- Direitos de compra, níveis, progresso, pedidos, Payt e downloads protegidos foram preservados. A associação editorial não libera materiais.

## Configuração

O cadastro do produto de origem tem o campo **Produto complementar**, com opções da mesma loja. O cadastrador por pasta aceita `complemento: protocolo-anti-retrabalho`; o alvo deve estar cadastrado. Omitir a chave preserva o vínculo existente; `complemento: nenhum` remove o vínculo.

A migration `20261021010000_product_complement.sql` cria o campo opcional, protege autorreferência/vínculos entre lojas e preenche apenas o vínculo vazio Atlas → Protocolo na loja arquitetura. Não altera ofertas, pedidos ou liberações atuais.

## Evidência final

Código funcional: `0bf5cad`, com revisão geral e re-revisões concluídas sem achados abertos. A evidência visual está no commit `086d704`; alterações posteriores afetaram somente validação administrativa e testes.

| Verificação | Resultado |
|---|---|
| `npx vitest run --maxWorkers=2 --reporter=dot` | 132 arquivos, **1.039 testes aprovados**, 63,01 s |
| `npx tsc --noEmit` | Aprovado |
| `npm run lint` | Sem erros; um aviso anterior em `scripts/trocar-admin-e-aluno.mjs` sobre variável `loja` não usada |
| `next build --webpack` | Aprovado com ambiente fictício isolado, sem credenciais de produção |
| Vercel `agent-browser@0.38.1` | Desktop 1440×1000 e celular 390×844; comprador e não comprador; cliques reais de capa/cartão/CTA; links antigos; sem overflow nem erros de página |
| Banco e acesso | Testes cobrem mesma loja, autorreferência, exclusões, alvo oculto/ausente, checkout inválido, reembolso/compra válida e prévia |

Os avisos anteriores de Vite CommonJS e de dimensões de Next Image no happy-dom permanecem; não representam falhas de teste. A concorrência de testes foi limitada a dois workers para evitar saturação nos testes PGlite.

[Relatório do navegador e nove capturas](qa/atlas-protocolo/validation.md). O teste de checkout usou somente páginas locais fictícias; não houve compra real, disparo de e-mail ou alteração na Payt.

## Decisões de execução

1. Um complemento opcional por produto atende ao funil solicitado e mantém o cadastro reutilizável. Vários complementos para a mesma origem exigiriam uma extensão futura.
2. As alterações anteriores do usuário foram preservadas em um snapshot numa branch isolada. Somente o delta desta entrega é levado de volta ao projeto original. Custo: espaço local adicional do worktree/snapshot.
3. Não foi feito push, deploy ou alteração do banco de produção. Para ativar no site público, aplicar a migration antes de publicar a aplicação. Custo: o comportamento novo ainda não aparece em produção.

Worktree preservado: `C:/Users/arqal/.codex/worktrees/atlas-protocolo/Area de membros`, branch `codex/atlas-protocolo`. Ele permite reproduzir o fixture sem carregar o `.env.local` do projeto original.

## Integração para publicação — 21/10/2026

A publicação usa `codex/atlas-protocolo-prod`, baseada na produção `b56dc4c`, aplicando somente o delta funcional desta entrega. Foram preservados o inbox durável da Payt, cron, recibos de imagens, validação de publicação, isolamento das mutações, retomada dos materiais e simulações administrativas.

O complemento foi adaptado ao `PreviewContext` atual; o seletor permanece no editor com estado e uploads individuais. A revisão independente da integração não deixou achados abertos.

Validação da versão integrada: **1.168 testes em 145 arquivos aprovados**, TypeScript e build otimizado webpack aprovados. ESLint sem erros e três avisos preexistentes de variáveis não usadas. Testes adicionais cobrem prévias Básico/Completo/bloqueado, rascunhos e o seletor no editor atual. O registro final de publicação e conferência do domínio deve ser acrescentado após o deploy.
