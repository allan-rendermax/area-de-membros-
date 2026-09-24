# Validação — uma capa, Básico e Completo

Implementação local na branch `codex/niveis-produtos`, baseada em `codex/cadastrador-produtos` (`e8e91fa`). O produto tem uma capa e uma página; o acesso Completo inclui os módulos Básico e os extras. Ofertas e pedidos determinam o maior nível atualmente pago.

## Verificação

- `npm test`: 74 arquivos e 622 testes aprovados após a correção final do importador (`2b32f56`).
- `npm run build`: compilação, TypeScript e geração das rotas aprovados em 24/09/2026.
- `npm run lint`: zero erros; permanece o aviso anterior de variável `loja` não utilizada em `scripts/trocar-admin-e-aluno.mjs:20`.
- Simulações dos exemplos `docs/exemplo-pasta-produto` e `docs/exemplo-pasta-produto-niveis`: aprovadas, sem operações remotas.
- O Vitest mantém o aviso anterior sobre a futura mudança do carregador de configuração do Vite.
- Revisões por tarefa concluídas e revisão final aprovada após correção específica: o importador verifica os itens que permanecerão em módulos Completo antes de qualquer upload ou escrita. Arquivos públicos próprios remanescentes e links públicos recebidos são recusados; substituir o mesmo item por um upload privado é permitido.
- QA de interface usa Vercel `agent-browser@0.38.1`, build de produção local e um provedor sintético. Evidências em `docs/qa/niveis-produtos/`.

## Ativação no ambiente real

Nenhuma migration, alteração de catálogo real, publicação, push ou merge foi executada. Antes de publicar esta versão, aplicar as migrations pendentes na ordem do repositório, incluindo:

1. `supabase/migrations/20260924000001_product_role.sql` (do cadastrador anterior).
2. `supabase/migrations/20260924010000_product_access_levels.sql` (campos de nível, RPC e bucket privado `arquivos-restritos`).

As migrations anteriores também precisam estar aplicadas. Não há uma segunda migration exclusiva do bucket: ele é provisionado na migration de níveis. Validar em homologação os perfis Básico, Completo, upgrade e reembolso antes de ativar as ofertas reais. O teste sintético de Storage não substitui a conferência do bucket e das permissões reais.

## Decisões e limites

- Um código pago de upgrade concede Completo diretamente. Exigir uma compra Básico ativa no futuro precisaria de regra adicional de elegibilidade; preço e cobrança ficam no checkout.
- Vínculos antigos recebem Completo por padrão e módulos antigos recebem Básico para preservar os acessos atuais. Converter o catálogo exige configurar conscientemente os níveis das ofertas existentes.
- O nível é definido por módulo. Conteúdos de níveis diferentes precisam ficar em módulos separados.
- Novos uploads administrativos e entregáveis do formato com níveis usam arquivos privados e links assinados por 60 segundos. O formato legado do importador mantém seu comportamento anterior.
- Arquivos públicos antigos não são movidos ou apagados automaticamente. Reenviar um arquivo como privado não revoga sua URL pública anterior; essa limpeza cabe ao responsável pelo catálogo.
- Vídeos e links externos continuam sujeitos às permissões de seus provedores.
- Produtos duplicados não são unidos automaticamente. O guia `docs/niveis-basico-completo.md` descreve uma conversão deliberada, preservando os pedidos.

## Uso

No administrador, informe o checkout de upgrade no produto, escolha o nível de cada módulo e configure o nível concedido por cada oferta. O cliente Básico verá os extras bloqueados e o botão de upgrade quando houver checkout configurado. Depois do pagamento, “Já paguei, atualizar acesso” consulta novamente as permissões. O reembolso do upgrade volta ao Básico se esse pedido continuar pago.

Para cadastro por pasta, use `docs/exemplo-pasta-produto-niveis/produto.txt` e o guia `docs/como-cadastrar-produto.md`.
