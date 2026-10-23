# Planos Payt por checkout e publicação do Urbanismo

## Pedido aprovado

Em 23/10/2026 o usuário autorizou adaptar a plataforma para identificar planos pelo checkout, manter os produtos atuais e finalizar a publicação do Atlas Visual de Urbanismo. Implementação, migração aditiva, integração e publicação fazem parte desse pedido; não há necessidade de pedir aprovação novamente para essas etapas.

## Comportamento

1. Ofertas atuais continuam com identificação por código de produto, sem converter cadastros, pedidos ou níveis antigos.
2. Novos planos podem compartilhar código Payt somente no mesmo grupo e loja, com identificação explícita por checkout ou upsell. Nunca misturar identificação só por produto e identificação específica para o mesmo código.
3. O código do checkout é uma referência administrativa. As regras de liberação usam aliases confirmados de link.url em eventos autenticados, ou upsell_code para upsells. Nenhuma inferência por preço, nome, UTM, hash parecido ou dados do navegador do comprador.
4. Ofertas guardam match_type (product|checkout|upsell), checkout_code opcional e match_values (aliases). Para checkout, links HTTPS dos hosts payt.site ou checkout.payt.com.br, sem query/hash e sem barra final; manter case do path. Não buscar/redirecionar URLs de webhooks em tempo de execução. Aceitar aliases de URL curta e final explicitamente cadastrados.
5. Persistir orders.offer_id e identificadores recebidos. Pedidos vinculados mantêm seu plano. Eventos posteriores sem identificador usam o vínculo persistido; identificador conflitante gera aviso e não troca o plano. Atualizações de status/reembolso continuam no pedido original, preservando titularidade e precedência de status.
6. Compra com código compartilhado e identificador ausente/desconhecido fica registrada sem acesso e com aviso administrativo. Reenvio válido pode resolver um pedido ainda não vinculado, inclusive sem alteração de status; não ressuscitar pedidos finais. Checkout desconhecido não pode herdar liberação por código.
7. Bumps/itens não herdam checkout ou upsell do principal. Usar identificadores próprios quando presentes; modos antigos continuam por seu próprio código. Duplicatas conflitantes do mesmo código em uma transação devem ser recusadas/registradas, nunca sobrescrever direitos silenciosamente.
8. Acesso, login, notificações, liberação manual, painéis de pedidos/avisos e sucesso do cliente devem respeitar o plano persistido. Pedidos antigos com offer_id nulo usam fallback apenas em ofertas product. Reembolsar Completo preserva Básico pago em outra compra.
9. FK/validação impede vínculo de pedido e oferta de lojas/códigos diferentes. Regras sem sobreposição, isolamento entre lojas e RPCs com execução restrita a service_role. Proteções de exclusão com histórico continuam.
10. Admin permite configurar modo, código de referência e aliases por plano, com validação clara. Modo/código de planos existentes permanecem estáveis; aliases podem ser complementados sem reatribuir pedidos já resolvidos. Cadastrador por pasta suporta os novos planos sem código específico de produto no programa.
11. Manter inbox/cron de webhooks, autenticação, downloads privados, níveis, pós-compra e visual atual. Sem refatorações alheias.

## Urbanismo confirmado na Payt em 23/10

Produto Payt LG5BGY. Produto da área de membros 1c90a301-3687-405d-bae4-11b6e671d716, loja arquitetura, slug atlas-visual-de-urbanismo. Rascunho já contém capa e cinco PDFs privados; versão Básico 1 item, Completo 5 itens, content_mode=versions.

| Plano | Código checkout | Link curto | URL final | Libera |
|---|---|---|---|---|
| Básico | R272NA | https://payt.site/8oClGKV | https://checkout.payt.com.br/bf9a56b000e84f756c369603b3685d84 | basic |
| Completo | LJPMZ2 | https://payt.site/zZC7Wyr | https://checkout.payt.com.br/4743cffb835703dfda2a66afec68bc1d | complete |
| Completo promocional | R6GZ2X | https://payt.site/oMC85v5 | https://checkout.payt.com.br/b06e76357558788e6a20187af8b4d525 | complete |

O último é compra integral promocional de R$27,90, não pagamento da diferença por aluno existente. Não usar como checkout de upgrade interno. Referência do produto/capa nos artefatos do checkout original.

## Provas e publicação

- Testes unitários de parser/normalização e cálculo de acesso; PGlite executando migração/RPCs reais; integração de processamento com e-mails falsos; admin e importação.
- Fluxos completos: novo pago, duplicata, pendente→pago, reembolso, upgrade separado reembolsado, evento final antes do pago, sem link, link desconhecido, conflito, URL com UTM, bumps, upsell, manual e duas lojas.
- Capturar IDs e níveis dos produtos atuais antes/depois. Nenhum backfill de compras antigas sem necessidade confirmada.
- Aplicar migração antes do deploy, mantendo produto compartilhado inativo até o código novo estar publicado. Criar planos e configurar postback de área de membros somente com os identificadores comprovados. Postback UTMify existente permanece.
- Verificar produção em navegador e leitura do banco, sem compra real ou disparo de campanhas. Teste Payt de conexão marcado test não concede acesso.
