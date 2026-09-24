# Correção local da sessão administrativa — 24/09/2026

Registro da implementação e validação local, anterior à publicação.

## Causa reproduzida

Admin e aluno usavam a mesma chave de armazenamento Supabase. Um login de aluno em outra aba substituía a identidade usada pelo painel; a próxima chamada de `salvarProduto` redirecionava para `/admin/entrar`, mesmo com o marcador de confiança de sete dias presente.

Além disso, `requireStoreSession` executava `signOut()` global ao encontrar usuário sem cadastro de cliente ou bloqueado. Uma leitura/prefetch da loja podia revogar as sessões desse usuário. O logout de aluno também removia incondicionalmente o marcador administrativo.

O teste de dois salvamentos seguidos, sem outra interação, passou antes da correção. Portanto, o relato de logout ao salvar isoladamente não foi reproduzido de maneira independente; o teste reproduziu o salvamento depois da substituição de sessão.

## Alteração

- Cookie Supabase administrativo exclusivo, usado pelo login, autorização e proxy. Cookies existentes de alunos preservados.
- Logout direcionado à área escolhida, com escopo `local`; sair como aluno preserva a confiança administrativa.
- Acesso de cliente ausente/bloqueado continua negado, sem executar logout durante renderização.
- Confiança continua assinada e vinculada ao usuário/sessão, com prazo absoluto de sete dias. Não é estendida pela renovação do token.

Na primeira entrada após publicar, administradores precisarão confirmar um código para criar o novo cookie e marcar novamente a opção. Sessões antigas não são migradas automaticamente.

## Evidências

- Teste de integração usa os clientes Supabase e os adaptadores de cookies reais, com apenas o provedor HTTP e o banco substituídos por dados fictícios.
- Sete regressões de conflito entre áreas falharam antes da separação e passaram depois. Também foi reproduzido e corrigido o logout global provocado pelo cookie administrativo antigo.
- Cobertura: salvamentos consecutivos, login nas duas ordens, acesso à loja, logout das duas áreas, separação no proxy, renovação no sexto dia e expiração no sétimo.
- Suíte completa: 776 testes, 100 arquivos, aprovados com `npm test -- --maxWorkers=2`.
- A primeira execução junto ao build teve sete timeouts de 5 segundos em testes SQL: customer-deletion-sql, deletion-integrity-sql, product-deletion-sql, product-levels-sql, product-role-sql, student-checkout-persistence e payment-identity-sql. A repetição integral com dois workers passou sem alterar esses testes ou seus limites.
- Build/TypeScript e ESLint dos arquivos alterados aprovados.
- Validação visual local não executada: revisão automática bloqueou iniciar Next com variáveis do provedor fictício, retornando apenas `blocked by policy`. O servidor do provedor foi encerrado.
- Nenhuma alteração em produção, banco, contas ou configuração de autenticação externa.
