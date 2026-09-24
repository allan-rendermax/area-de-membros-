# Revisão e integração de Básico/Completo — 24/09/2026

A implementação de uma capa por produto foi integrada às entregas recentes de login/item aprovados, progresso sincronizado, cupom para alunos, suporte e email de acesso. O trabalho anterior de níveis estava isolado em `87f9ac7`; a versão recente de `main` era `cb065f6`. O merge revisado está em `ba57a4c`, na branch `codex/integracao-niveis-produtos`.

A versão validada foi incorporada por fast-forward à `main` local, na pasta original do projeto. Os dois documentos que já tinham alterações locais foram preservados e seus hashes SHA256 permaneceram iguais. Na pasta original, os 675 testes passaram novamente e o build concluiu com sucesso. Nenhum push foi realizado.

## Correções da revisão

- A ação de concluir ou desfazer conclusão agora verifica o nível do módulo antes de qualquer escrita. Comprar o Básico não permite alterar progresso dos extras do Completo por chamada direta.
- IDs de progresso antigo são filtrados antes de chegar ao componente de navegação no navegador. Um reembolso mantém o histórico no banco, mas não envia referências dos extras bloqueados ao cliente.
- `role`, `studentCheckoutUrl` e `upgradeCheckoutUrl` coexistem nas consultas, formulários e persistência. O checkout promocional para comprar outro produto e o checkout para liberar o Completo continuam independentes.
- A migration de categoria do produto recebeu uma versão única: `20260924000003_product_role.sql`. Ela é reaplicável caso a coluna tenha sido criada manualmente. As migrations de progresso e cupom já publicadas mantêm seus nomes e conteúdo.
- Os seletores de capa e banner no admin agora respeitam a largura da coluna, corrigindo o texto nativo que avançava sobre os demais campos (`a260290`).

## Verificação

- Suíte integrada: **675 testes em 87 arquivos aprovados**.
- TypeScript e build de produção aprovados.
- ESLint no worktree: zero erros e o aviso anterior de variável não utilizada em `scripts/trocar-admin-e-aluno.mjs`. Na pasta original também terminou com zero erros; apresentou 189 avisos ao incluir os scripts locais não versionados da skill Impeccable em `.agents/`. Esses scripts de terceiros foram preservados.
- Simulações de cadastro legado e com Básico/Completo aprovadas, sem rede ou gravação remota.
- O teste SQL verifica a reaplicação da migration de categoria; outra regressão verifica que todas as versões de migrations são únicas.
- Testes novos cobrem conclusão/desmarcação negadas para Básico em extra e filtragem de progresso histórico no componente enviado ao navegador.

As evidências de navegador desta integração ficam em `docs/qa/integracao-niveis/`. Os relatórios anteriores em `docs/qa/niveis-produtos/` documentam a validação de upload privado, pagamento e reembolso da implementação original.

A revisão independente da integração não encontrou defeitos pendentes. No agent-browser, o Básico concluiu e desfez a conclusão do material permitido, com persistência após recarregar; o Completo concluiu o extra. O cupom de produto não comprado manteve seu destino distinto do upgrade. Capturas em 390px e 1440px preservam as telas aprovadas, sem overflow horizontal nos cenários verificados. O teste usa um provedor local sintético, sem operações reais de compra, email ou banco remoto.

## Ativação

Nenhuma alteração de banco real, catálogo, push ou deploy foi feita nesta revisão. A ordem atual das migrations de 24/09 é:

1. `20260924000001_member_progress.sql` — já publicada na entrega anterior.
2. `20260924000002_student_checkout.sql` — já publicada na entrega anterior.
3. `20260924000003_product_role.sql` — categoria comercial do produto.
4. `20260924010000_product_access_levels.sql` — níveis, RPCs e bucket privado.

Antes da publicação, conferir o histórico do ambiente e aplicar somente as pendentes. Não usar a antiga numeração `20260924000001_product_role.sql`: ela colidia com a migration de progresso. As novas colunas precisam existir antes de publicar o código que as consulta.

Os produtos e pedidos reais não são reunidos ou recategorizados automaticamente. Use `docs/niveis-basico-completo.md` para configurar ofertas e módulos deliberadamente. Links públicos já compartilhados exigem limpeza própria no provedor caso precisem ser revogados.
