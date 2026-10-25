# Telegram suporte — plano de implementação

**Objetivo:** suporte móvel privado com consulta e correção/reenvio confirmados.
**Spec:** ../specs/2026-10-25-telegram-suporte-design.md
**Execução:** nesta sessão, conforme autorização “pode montar”. Isolamento em worktree para preservar alterações existentes. Skills: writing-plans, executing-plans e test-driven-development.

## Restrições

- Sem dependências novas, IA ou mudança nas regras comerciais.
- Não enviar mensagens reais a clientes durante testes.
- Configuração ausente desativa o webhook; nenhuma chave no Git.
- Revalidar destinatário e acesso antes de qualquer efeito.
- Preservar mudanças alheias e código publicado além do HEAD.

## Etapas

1. [x] Contratos/configuração/cliente HTTP e motor de interação.
   - Testes em `tests/telegram/handler.test.ts` com repo em memória e operações fake.
   - Primeiro executar teste que importa módulo inexistente e verificar falha; implementar autorização, consulta, ações e repetição.
   - Exercitar replay e callbacks concorrentes; `Promise.all` deve produzir somente um envio.
2. [x] Persistência e operações reais da plataforma.
   - Criar migração `20261025010000_telegram_support.sql` e `src/lib/telegram/repository.ts`.
   - Testes PGlite: tabelas privadas, tokens por operador/chat, expiração e exclusão mútua por cliente.
   - Adapter `operations.ts` reaproveita funções existentes e protege remetente/destino.
   - Cliente do Resend consulta ID; traduzir eventos sem prometer leitura.
3. [x] Webhook e ferramentas de ativação (ativação externa pendente das credenciais).
   - Testes em `tests/telegram/webhook.test.ts`: segredo ausente/incorreto, grupo, operador desconhecido, corpo inválido, tamanho máximo.
   - Criar route handler e script `scripts/telegram-support.mjs` com comandos `info`, `users`, `activate`.
   - Documentar variáveis, rotina de reconciliação de ação incerta e instalação.
4. [x] Verificação e entrega dos arquivos (ativação externa pendente).
   - `npm test -- tests/telegram tests/admin/customer-email.test.ts tests/email --maxWorkers=2`.
   - `npx tsc --noEmit`; `npx eslint src/lib/telegram src/app/api/webhooks/telegram tests/telegram scripts/telegram-support.mjs`; `npm run build`.
   - Revisar autorização, replay, timeout e isolamento; corrigir falhas com regressões.
   - Copiar somente arquivos novos do bot e alteração documentada de `.env.example` para a pasta principal. Guardar implementação isolada; não misturar mudanças alheias num deploy.

## Foco da revisão

Callbacks de outro operador; resposta de novo e-mail enviada a prompt antigo; dois botões para o mesmo cliente; Auth divergente; provedor aceitou mas resposta se perdeu. Cada caso tem teste no motor, operações ou SQL.

## Registro

- 25/10: usuário aprovou consulta e botões, informou @suporteelevamaxbot e está criando token. Worktree criada a partir de 0454fcd; alterações existentes da pasta principal preservadas.
- Baseline: 884 testes/111 arquivos aprovados. Testes relacionados após implementação: 80 aprovados. Build final, TypeScript e ESLint aprovados.
- Revisão independente encontrou perda do callback por falha de ACK e descarte da precondição do e-mail esperado; ambos reproduzidos em testes falhos e corrigidos. Revisor confirmou resolução e reexecutou 58 testes sem falha.
- Ajuste delimitado à API existente: `changeCustomerEmail(id,newEmail,expectedEmail?)` aceita precondição opcional, preservando chamadas existentes. Necessário aplicar esse pequeno diff também no runtime publicado; não substituir a implementação comercial por código antigo.
- Configuração privada `.env.telegram.local` foi criada na pasta principal e aberta no editor. Token e IDs ainda vazios na última conferência; não houve aplicação da migração, deploy, registro de webhook ou envio a compradores.
- Verificação final: 933 testes em 116 arquivos aprovados, build de produção aprovado, TypeScript e ESLint aprovados. Dezenove arquivos novos copiados para a pasta principal com verificação byte a byte; alterações existentes receberam apenas patches delimitados.
