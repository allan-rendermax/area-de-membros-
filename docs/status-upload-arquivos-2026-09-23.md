# Upload de arquivos no admin — 23/09/2026

Implementado e validado localmente. Sem commit, push ou deploy. Alterações preexistentes do workspace preservadas.

## Arquivos desta tarefa

- Alterados: `src/app/admin/(painel)/produtos/actions.ts`, `src/app/admin/(painel)/produtos/content-editor.tsx`, `src/lib/data/products-admin.ts`.
- Criados: `src/app/admin/(painel)/produtos/item-fields.tsx`, `src/lib/admin/item-upload.ts`, `tests/admin/item-upload.test.ts`, `tests/admin/item-upload-ui.test.ts`.
- Documentação: `docs/superpowers/plans/2026-09-23-upload-arquivos.md` e este relatório.

O botão Enviar arquivo fica ao lado do Link no desktop e abaixo no mobile. A action exige `requireOwnProduct`, recebe apenas nome/tamanho/productId e assina um caminho UUID/nome-sanitizado no bucket público `arquivos`, sem sobrescrita. O navegador usa `uploadToSignedUrl`; o arquivo não integra o FormData de salvar. O Link continua editável. Preparação/envio têm progresso indeterminado acessível e mensagens em português. Falhas preservam a URL anterior e permitem nova tentativa.

Capas, entrega ao aluno, visibilidade do bucket, banco, migrações, email, webhook e limite das Server Actions não foram alterados.

## TDD: RED e GREEN observados

- Servidor: 17 testes falharam antes de existirem a action e a validação. Teste adicional do helper falhou por permitir tamanho excessivo. Após implementação, 18 passaram. A revisão encontrou nomes Unicode recusados; 3 falhas em 21 casos foram observadas antes da correção, e depois 21/21 passaram.
- Tela: 4 testes falharam porque o formulário ainda não tinha seletor de arquivo; após implementação e casos adicionais de tamanho/preparação, 6/6 passaram. Novo teste observou mensagem de sucesso antiga e retry inadequado após seleção inválida (2 falhas em 7 casos); após a correção, 7/7 passaram.
- Revisões independentes de servidor, UI e integração concluídas sem achados pendentes.

## Comandos obrigatórios na pasta original

Executados após integrar os mesmos arquivos verificados no worktree:

```text
npm test
Test Files  57 passed (57)
Tests       453 passed (453)
Exit code   0

npx tsc --noEmit
Sem saída / sem erros
Exit code   0

npm run lint
scripts/trocar-admin-e-aluno.mjs
20:15 warning 'loja' is assigned a value but never used
0 errors, 1 warning
Exit code   0
```

O aviso do lint é de arquivo preexistente não alterado. Vitest também emite o aviso preexistente de compatibilidade futura do Vite `configLoader: native` com a configuração CommonJS/ESM.

## Frontend: agent-browser da Vercel 0.38.1

Next.js real em localhost com fixture local de autenticação/REST/Storage, sem chamadas a produção. SDK Supabase real no navegador.

- Arquivo de 10,5 MiB (11.010.048 bytes) selecionado no formulário.
- Instrumentação do fetch: POST da action com 65 bytes e nenhum File; PUT direto ao endpoint de upload assinado com File de 11.010.048 bytes.
- Fixture recebeu 11.010.339 bytes no PUT (arquivo mais multipart), retornou sucesso e o Link recebeu a URL pública.
- Link editado manualmente para URL externa; salvamento de item confirmou persistência na fixture e mensagem Item salvo.
- Falha de rede simulada mostrou erro em português, preservou o Link e permitiu retry com sucesso e novo caminho.
- Novo item salvo novamente na mesma rota: formulário seguinte com título e URL vazios, descartando suspeita de estado antigo após salvar.
- Desktop: botão adjacente ao Link. Mobile 390 px: largura da página 390 px, sem overflow horizontal. Nenhuma exceção JavaScript não tratada no navegador.

## Riscos residuais

- O Storage de produção não foi exercitado. A action valida tamanho declarado e o navegador valida o File; a limitação física dos bytes depende das configurações existentes do Storage, que não foram alteradas. [Limites do Supabase Storage](https://supabase.com/docs/guides/storage/uploads/file-limits).
- Upload concluído cujo item não seja salvo pode deixar arquivo sem referência. Limpeza automática não faz parte deste escopo.
- Progresso é por etapa, sem percentual de bytes, pois `uploadToSignedUrl` não oferece callback de progresso.
