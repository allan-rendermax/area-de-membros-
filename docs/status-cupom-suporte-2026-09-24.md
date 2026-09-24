# Cupom e suporte: entrega local

24/09/2026. Branch codex/cupom-suporte-membros baseada na publicação 61df1b5. Implementação no worktree C:/Users/arqal/.codex/worktrees/cupom-suporte-membros/Area de membros. Original preservado; nenhuma publicação ou mudança de dados de produção.

## Entregue

- Texto Clique aqui para download e layouts de home/produto/item preservados.
- Oferta com botão Resgatar meu cupom de 10% e segundo modal de checkout. Campo novo no admin de produtos: Checkout de aluno com 10% de desconto. Colar o link completo do provedor com cupom aplicado. Sem esse campo, continua checkout normal ou indisponibilidade, sem promessa de desconto.
- WhatsApp de suporte usa campo opcional já existente em Admin > Lojas. Vazio não cria botão quebrado.
- E-mail grupoelevamax@gmail.com na ajuda do login e dos materiais, sempre disponível.
- Região main no login, sem mudar aparência.

## Evidência

542 testes/74 arquivos passaram; lint zero erros e um aviso preexistente; build exit0; agent-browser mobile/desktop; axe login zero violações, contraste sobre gradiente inconclusivo. Revisões independentes aprovadas. [Relatório completo](qa/cupom-suporte/relatorio.md).

## Para publicação futura

Aplicar supabase/migrations/20260924000002_student_checkout.sql ANTES de publicar, pois as consultas selecionam a coluna nova. Depois configurar links reais e conferir desconto no checkout do provedor; preencher telefone quando disponível. O código não cria cupom no provedor. Não há migração ou checkout real ativado nesta entrega.

Decisões: usar URL promocional completa para não inventar parâmetro de provedor; se houver outro mecanismo desejado, precisará de ajuste de integração. Entrega local preservada sem deploy; ativação depende da migração e publicação. Nenhum canal foi acionado para enviar mensagens.
