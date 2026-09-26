# Termos no primeiro acesso — 26/09/2026

Implementação autorizada após aprovação do piloto. A frase “Uma única vez...” foi removida.

## Comportamento

Na loja Arquitetura, sessões de alunos sem aceite são direcionadas a `/arquitetura/boas-vindas` antes de carregar acervo, produto, item ou destino de download. A tela mostra o modal aprovado sobre fundo neutro, sem materiais por trás. Aceitar salva o registro e abre o acervo. “Sair da conta” permite encerrar o acesso sem aceitar.

O registro em `member_terms_acceptance` usa chave `(customer_id, store_id)`, data do banco e versão do texto. Envios repetidos preservam o primeiro registro. A consulta não depende de cookies, localStorage, plano, produto, dispositivo ou prazo. Não se exige novo aceite por alteração de versão. Alunos já existentes, sem registro anterior, verão os termos no próximo acesso.

A identidade vem da sessão autenticada e validada no servidor. Alunos bloqueados continuam sem acesso. Falha de leitura não libera conteúdo; falha de escrita mantém a tela com mensagem para tentar novamente. Prévia administrativa em `/arquitetura/boas-vindas?previa=1` exige administrador, não grava aceite e indica isso na tela. Outras lojas permanecem como estavam.

## Dados e texto

Migration aditiva: `20260926010000_member_terms_acceptance.sql`. RLS ativa, sem políticas públicas e sem leitura/gravação por anon/authenticated; escrita via servidor. FKs acompanham a exclusão de aluno/loja. Não se preenche aceite automaticamente nem se altera dados comerciais.

A cláusula de identificação dos arquivos foi mantida por solicitação expressa do usuário. Esta entrega implementa o registro de aceite, não um novo sistema de marcação ou rastreamento de PDFs.

## Validação

- RED antes da implementação: dois testes mostraram acesso indevido sem aceite e em falha de consulta.
- 16 testes novos de guard, ação, renderização, persistência e SQL passaram.
- Suíte completa: 1.070 testes em 128 arquivos passaram com dois workers.
- ESLint dos arquivos alterados e `git diff --check` passaram.
- Build com TypeScript passou.
- Revisão independente sem achados materiais.
- Navegador com backend sintético local: login levou às boas-vindas, link de abertura de PDF também redirecionou antes do aceite; clique de aceite liberou o acervo; reload e mesma conta em outro navegador entraram direto.
- Migration aplicada ao projeto de produção antes de publicar código: RLS ativa, zero políticas públicas, zero aceites criados e registro de migration confirmado.

Rollback do aplicativo pode voltar ao commit anterior `e2be2f6`, preservando a tabela e os aceites coletados. Não remover registros de aceite durante rollback.
