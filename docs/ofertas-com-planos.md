# Ofertas com planos

Em **Admin → Ofertas → Nova oferta**, informe o nome da oferta uma única vez. O cadastro sugere os planos Básico e Completo. Use **Adicionar plano** para Upgrade, Combo ou qualquer outro nome; remova os planos que não precisar antes de salvar.

Em cada plano:
1. Informe nome e ID do produto na Payt (o mesmo código enviado no webhook).
2. Em **O que este plano libera**, clique em **+ Adicionar produto**. Na coluna **Produto**, abra o menu e busque o produto pelo nome. Na coluna **Plano**, escolha **Básico** ou **Completo**.
3. Adicione uma linha para cada produto liberado. Use **×** para remover uma liberação. Produtos que não foram adicionados ficam sem acesso por esse plano; o mesmo produto não pode aparecer duas vezes dentro dele.
4. Selecione pelo menos um produto em cada plano e preencha ou remova as linhas vazias. Ao editar, aparecem apenas os produtos já liberados. Um combo pode liberar vários produtos, cada qual em Básico ou Completo.

Clique em **Salvar oferta** para gravar todos os planos juntos. Em caso de erro, nenhum plano é parcialmente salvo e o preenchimento permanece na tela. Um plano com nome Upgrade concede os produtos/níveis escolhidos quando a compra for confirmada, seguindo as regras de acesso já existentes.

Ao remover um plano existente, a alteração só será aplicada ao salvar. Use **Restaurar plano** para desfazer a remoção sem perder o restante do preenchimento, inclusive se houver bloqueio por pedidos.

IDs Payt precisam ser únicos. Após o cadastro, o ID é fixo; para usar outro, adicione um plano. Alterar as liberações afeta compradores anteriores daquele plano. A exclusão é bloqueada se houver qualquer pedido, inclusive cancelado, teste, reembolsado ou pendente. Excluir uma oferta remove seus planos sem excluir produtos ou conteúdos. Para liberar acesso manual, a ficha do cliente identifica a oferta e o plano.

## Aplicação da mudança

Aplicar `supabase/migrations/20260925030000_offer_groups.sql` antes de publicar a aplicação. A migração adiciona agrupamentos às ofertas existentes, mantendo códigos Payt, UUIDs, pedidos e liberações. Cadastros da mesma loja que liberam exatamente o mesmo conjunto de produtos são reunidos, independentemente de serem Básico ou Completo. Nomes antigos de planos são preservados; o nome inicial do grupo vem dos títulos dos produtos e pode ser editado.

Cadastros sem produtos recebem um grupo próprio. A migração permite que o código antigo continue criando ofertas durante a publicação. Endereços antigos de edição redirecionam ao grupo correspondente. Os webhooks e o cálculo de acesso continuam consultando os códigos originais.

O novo cadastro verifica uma versão do grupo para evitar que uma aba desatualizada sobrescreva a edição salva por outra. Se receber esse aviso, copie as alterações desejadas e recarregue antes de salvar.
