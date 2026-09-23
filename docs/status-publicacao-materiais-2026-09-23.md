# Publicação: upload direto e materiais na aula

- Autorização explícita do usuário: “publique”.
- Commit enviado por push normal em main: `55f0239bcfda0077e68430bf37c5f7444a17917b`.
- Vercel: `dpl_BZChUQaS7JuPDz4ztFfSvUso4pyx`, confirmado Ready / Production.
- Deploy: https://area-de-membros-6fwd6uwo1-rendermax.vercel.app.
- Domínio oficial atribuído: https://members.grupoelevamax.com.
- Deploy anterior preservado para eventual rollback: https://area-de-membros-opy1oc20m-rendermax.vercel.app (`54edb968682bbec1ae1d41797a8e9ba7bef1145d`).

## Validação antes da publicação

Os 16 arquivos de código e testes foram comparados por SHA-256 com a revisão aprovada. Apenas os 20 arquivos do escopo (incluindo quatro documentos) entraram no commit; alterações preexistentes permaneceram locais.

- `npm test`: 59 arquivos, 472 testes passaram; saída 0.
- `npx tsc --noEmit`: sem erros; saída 0.
- `npm run lint`: zero erros, um aviso preexistente em scripts/trocar-admin-e-aluno.mjs:20:15 (loja não utilizada); saída 0.
- `npm run build`: compilação, TypeScript e geração de páginas concluídos; saída 0. Inclui a nova rota /[loja]/item/[id]/abrir.
- Build remoto Vercel concluído em 27 segundos.

## Verificação no domínio oficial

- /admin/entrar e /arquitetura/entrar: HTTP 200.
- /admin: HTTP 307 para /admin/entrar.
- /arquitetura e nova rota de abertura de material sem sessão: HTTP 307 para /arquitetura/entrar.
- Agent-browser da Vercel confirmou os formulários administrativo e de aluno; lista de erros JavaScript vazia. Sessão de teste encerrada.

O fluxo autenticado de upload/download foi validado anteriormente com fixtures locais, conforme os relatórios de upload e aula. Não foi feito upload real no Storage de produção nem enviado código de login nesta publicação. Continuam os limites documentados: arquivos não associados após abandonar o formulário e downloads externos sujeitos ao provedor. Nenhuma alteração em DNS, variáveis de ambiente ou configurações do Supabase.
