# Preparação para lançamento — desenho
Data: 2026-09-22

## Intenção e critérios
Revisar a plataforma multi-loja existente para lançar ao público, preservando visual, login simples por e-mail e melhorias anteriores. Sucesso significa corrigir falhas reproduzidas, validar aluno e administração com agent-browser da Vercel e distinguir testes locais de evidência real de pagamentos, banco e entrega.
O usuário pediu aprovação autônoma dos documentos e execução com subagentes. A migração 20260922150000_order_payment_identity.sql NÃO foi aplicada, confirmado pelo usuário nesta sessão.

## Abordagem escolhida
Correções incrementais com regressões, sem reconstrução. Alternativas descartadas: só checklist deixaria falhas confirmadas; reescrita ampliaria risco sem necessidade. Quatro unidades independentes: contexto da loja, identidade das notificações, diálogos frontend, persistência administrativa.
Usar worktree codex/prontidao-lancamento. Documentos aprovados autonomamente conforme autorização.

## Restrições globais
- Next.js 16.3.5, React 19, TypeScript, Supabase, Resend; ler guias locais Next antes de alterar rotas.
- Preservar cores, tipografia, carrosséis, login só e-mail e os riscos explicitamente aceitos em docs/conferencia-gpt-cuspidora.md.
- Não alterar .env.local nem variáveis remotas; não enviar e-mails reais nem usar compradores reais em testes.
- Migrações são arquivos locais testados; não aplicar Supabase nem publicar código dependente antes de aplicação manual.
- Não guardar permissões em cache entre requisições.
- Sem dependência nova de produção.

## Comportamento
1. Formulários de produto, oferta e ações de cliente dependentes da loja carregam store_id. Servidor compara com loja atual antes de qualquer escrita/envio e informa recarregar caso outra aba tenha mudado contexto. Rejeitar valor ausente/inválido. Identidade global do cliente/bloqueio não depende de loja.
2. Depois de apply_order_status, ler titular/status persistidos do pedido usando orderId. Agrupar linhas pagas por titular e loja. Cliente, nome e destino dos avisos vêm dos dados persistidos, nunca do payload atrasado. Falha de leitura aborta para retry. Nenhuma alteração na assinatura SQL anterior. Pedido sem produtos publicados deve gerar diagnóstico explícito em vez de fingir que o acesso foi entregue.
3. Compra e instalação usam diálogo acessível fora de ancestrais com backdrop-filter; foco inicial, Tab contido, Escape, retorno ao acionador, bloqueio de rolagem do fundo e conteúdo rolável no viewport. Preservar semântica de URL comprar e navegação existente. Testar descrições extensas em 375x812 e viewport baixo. Páginas de erro/404 oferecem recuperação em português e não revelam detalhes técnicos.
4. Oferta salva em uma transação SQL serializada por oferta: valida loja, código imutável e produtos; cria/atualiza e substitui vínculos integralmente. Rejeitar seleção vazia. Correção de e-mail mantém orders e customers na mesma transação com comparação do e-mail esperado. Auth continua pelo SDK; compensar para e-mail anterior se transação de banco falhar; falha de compensação retorna orientação explícita de reconciliação. Não afirmar atomicidade distribuída entre Auth e Postgres. Nova migração aditiva com execução só service_role, sem acesso anon/authenticated. Código dependente permanece sem publicação até aplicação manual.

## Auditoria operacional
Reentregas simultâneas ainda podem causar e-mails duplicados (não acesso duplicado). Não implementar garantia exactly-once sem persistência/reserva e política de recuperação; registrar como risco operacional de confiabilidade, não alegar resolvido.
Confirmar dados publicados, ofertas com conteúdo, links e suporte por leitura quando houver configuração disponível; não emitir transações financeiras. Compra real com bump/reembolso parcial e entrega real devem constar como pendentes se não houver evidência desta sessão.

## Validação e entrega
Baseline 323 testes em 44 arquivos, npm audit produção sem vulnerabilidades conhecidas.
TDD por correção, revisão independente por tarefa, revisão final. npm test, tsc --noEmit, lint e build. agent-browser com backend sintético: login, vitrine, compra, produto/arquivo/vídeo, revogação/bloqueio, admin CRUD/contexto, mobile, erros/404/PWA. Relatório aponta cobertura e limitações, SQL necessário e ordem de publicação. Não declarar 100% pronto com dependências externas pendentes.
