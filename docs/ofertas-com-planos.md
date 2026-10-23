# Ofertas com planos

Em **Admin → Ofertas → Nova oferta**, informe o nome da oferta uma única vez. O cadastro sugere os planos Básico e Completo. Use **Adicionar plano** para Upgrade, Combo ou qualquer outro nome; remova os planos que não precisar antes de salvar.

Em cada plano:
1. Informe nome e ID do produto na Payt (o mesmo código enviado no webhook). Em **Identificar compra por**, escolha **ID do produto Payt** para o modelo existente, **Link do checkout** para compra comum ou **Código de upsell** para o recurso de upsell.
2. Em **O que este plano libera**, clique em **+ Adicionar produto**. Na coluna **Produto**, abra o menu e busque o produto pelo nome. Na coluna **Plano**, escolha **Básico** ou **Completo**.
3. Adicione uma linha para cada produto liberado. Use **×** para remover uma liberação. Produtos que não foram adicionados ficam sem acesso por esse plano; o mesmo produto não pode aparecer duas vezes dentro dele.
4. Selecione pelo menos um produto em cada plano e preencha ou remova as linhas vazias. Ao editar, aparecem apenas os produtos já liberados. Um combo pode liberar vários produtos, cada qual em Básico ou Completo.

Clique em **Salvar oferta** para gravar todos os planos juntos. Em caso de erro, nenhum plano é parcialmente salvo e o preenchimento permanece na tela. Um plano com nome Upgrade concede os produtos/níveis escolhidos quando a compra for confirmada, seguindo as regras de acesso já existentes.

Ao remover um plano existente, a alteração só será aplicada ao salvar. Use **Restaurar plano** para desfazer a remoção sem perder o restante do preenchimento, inclusive se houver bloqueio por pedidos.

Planos com o mesmo ID Payt devem pertencer à mesma oferta e loja, usar checkout/upsell e ter aliases sem sobreposição dentro de cada modo. Um plano identificado apenas por produto exige código exclusivo. Os modos não são inferidos pelo nome ou preço.

Para checkout/upsell, informe a referência administrativa opcional do checkout e os identificadores confirmados nos eventos autenticados, um por linha. Checkout aceita HTTPS apenas em `payt.site` e `checkout.payt.com.br`; cadastre explicitamente tanto o link curto quanto o final se ambos puderem ser enviados. Query, fragmento e barras finais são removidos; o caminho diferencia maiúsculas. Não há consulta ou redirecionamento desses links. Upsell usa `upsell_code` sem espaços e diferencia maiúsculas. A referência administrativa sozinha não identifica a compra.

Após salvar, modo, ID Payt e referência são fixos; para outra identidade, adicione um plano. Aliases salvos devem ser mantidos e podem receber novos aliases. Alterar as liberações afeta compradores anteriores daquele plano. A exclusão é bloqueada se houver qualquer pedido para o código, inclusive cancelado, teste, reembolsado ou pendente; isso também protege planos irmãos com código compartilhado. Excluir uma oferta remove seus planos sem excluir produtos ou conteúdos. Para liberar acesso manual, a ficha do cliente identifica a oferta e o plano.

O botão de upgrade dentro da área de membros usa `upgrade_checkout_url` (campo `checkout_upgrade` na ficha por pasta): ele deve cobrar a diferença de quem já tem Básico. Uma compra integral promocional do Completo pode ser outro plano de checkout, sem configurar esse botão. Cadastrar planos compartilhados não exige botão de upgrade.

Compras específicas com identificador ausente/desconhecido ficam registradas sem acesso. Confira **Pedidos → Problemas e identificação** e **Avisos da Payt → Erros e identificação**, revise o cadastro e reprocese o evento correto. Um pedido já vinculado preserva seu plano quando eventos posteriores omitem o identificador ou trazem conflito; reembolsos ainda atualizam seu status. Os avisos mostram a identificação recebida e a explicação do problema. O código bruto permanece no detalhe do evento.

## Aplicação da mudança

Aplicar `supabase/migrations/20260925030000_offer_groups.sql` antes de publicar a aplicação. A migração adiciona agrupamentos às ofertas existentes, mantendo códigos Payt, UUIDs, pedidos e liberações. Cadastros da mesma loja que liberam exatamente o mesmo conjunto de produtos são reunidos, independentemente de serem Básico ou Completo. Nomes antigos de planos são preservados; o nome inicial do grupo vem dos títulos dos produtos e pode ser editado.

Cadastros sem produtos recebem um grupo próprio. A migração permite que o código antigo continue criando ofertas durante a publicação. Endereços antigos de edição redirecionam ao grupo correspondente.

Para identificação por checkout, aplicar também `supabase/migrations/20261023010000_checkout_plans.sql` antes do código correspondente. A migração é aditiva: ofertas existentes continuam em modo `product`, e pedidos antigos não são convertidos automaticamente. A aplicação usa o plano persistido nas novas compras; pedidos legados sem vínculo consultam somente ofertas por produto. Não ativar código compartilhado até migração e aplicação estarem disponíveis.

O novo cadastro verifica uma versão do grupo para evitar que uma aba desatualizada sobrescreva a edição salva por outra. Se receber esse aviso, copie as alterações desejadas e recarregue antes de salvar.
