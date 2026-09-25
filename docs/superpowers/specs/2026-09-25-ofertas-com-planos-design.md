# Ofertas com vários planos

Pedido aprovado: cadastrar uma oferta e, dentro dela, vários planos com nome livre, ID Payt próprio e produtos liberados exclusivamente nos níveis Básico ou Completo. A instrução posterior foi implementar usando writing-plans; execução segue nesta sessão.

## Comportamento
- A listagem mostra uma oferta por grupo, com resumo dos planos e suas liberações.
- O formulário permite editar o nome da oferta e adicionar/remover planos. Cada plano exige nome, código Payt único e ao menos um produto com nível basic ou complete.
- Novas ofertas começam com Básico e Completo, mas é possível manter apenas um ou acrescentar Upgrade, Combo e outros nomes. O nome não cria um novo nível de acesso.
- Erros retornam no próprio formulário, preservando o preenchimento. O envio bloqueia novos cliques enquanto salva.
- Códigos de planos existentes são imutáveis. Remover plano com qualquer pedido é bloqueado. Excluir oferta exige seu nome e falha integralmente se algum plano tiver pedidos.
- Planos existentes marcados para remoção podem ser restaurados antes de salvar, inclusive após um bloqueio por pedidos, preservando as demais alterações.
- Editar liberações afeta compradores anteriores, como no cadastro atual; mostrar essa informação.

## Persistência e compatibilidade
Criar offer_groups com id, store_id, name e version. offers permanece como tabela de planos, vinculada ao grupo por group_id, preservando seus IDs, códigos Payt, pedidos e offer_products. Não alterar webhook nem algoritmo de acesso. As RPCs são restritas ao service_role e salvam todos os planos em uma transação, com verificação de loja, grupo, códigos e versão para evitar sobrescrever outra edição.

A versão é um token crescente, não a contagem de salvamentos. Triggers também atualizam o token quando o cadastro antigo modifica um plano ou suas liberações, preservando a detecção de abas desatualizadas durante a transição.

Migrar cadastros existentes da mesma loja com exatamente o mesmo conjunto não vazio de produtos para um grupo comum, independentemente dos níveis. O nome inicial é a composição dos títulos desses produtos. Registros sem produtos recebem grupos próprios. Preservar nomes de planos antigos. URLs antigas resolvem para o grupo. A liberação manual continua selecionando um plano individual com contexto do grupo.

## Verificação e entrega
Testes executáveis PostgreSQL/PGlite para migração, atomicidade, isolamento entre lojas/grupos, remoção com pedidos e edições concorrentes. Testes de validação, Server Actions e interação do formulário. Executar suite completa, ESLint src/tests e build. Implementação local, migração versionada e guia de operação; publicação não faz parte deste pedido.
