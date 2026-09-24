# Acervo de materiais — design de implementação

## Intenção e autonomia
O usuário escolheu encontrar e baixar materiais como tarefa principal, pediu todas as melhorias em etapas, planejamento com writing-plans, execução por subagentes, paralelismo quando independente e teste de frontend com Vercel agent-browser. Delegou dúvidas e aprovação do plano ao agente, sem novas perguntas. Esta especificação registra as decisões tomadas nessa autorização.

## Abordagem escolhida
Evoluir o acervo existente preservando a identidade, com entrada compacta, materiais adquiridos separados das ofertas e retomada do item. Uma simples troca de cores não resolveria a navegação; reconstruir toda a aplicação aumentaria risco e escopo sem benefício necessário.

## Restrições globais
- Preservar identidade carvão/amarelo/laranja da Arquitetura e compatibilidade das demais lojas.
- Toda leitura e escrita de aluno deve validar sessão, loja, acesso atual ao produto e publicação de módulo/item; nunca confiar em customerId enviado pelo cliente.
- Nenhum dado, suporte, formato ou tamanho de arquivo será inventado; nenhum fetch remoto de arquivo será feito só para obter metadados.
- Não alterar e-mails, pagamentos, checkout, permissões de produção ou credenciais.
- Sem bypass de autenticação ou flags de teste nas rotas do produto. QA usa app real com provedor HTTP local fictício.
- Não publicar, aplicar migrações remotas ou fazer push nesta execução. Entregar implementação local completa, migração e instruções de ativação verificadas.
- Usar português claro e preservar fluxos de download autorizados existentes.

## Comportamento
1. Página inicial compacta com Meus materiais, recentes por item e ofertas explicitamente separadas. Coleções adquiridas em grade, não carrossel obrigatório; busca local por nome/categoria quando houver vários produtos. Busca não expõe materiais não adquiridos. Ofertas ficam em seção separada.
2. Acessados recentemente abre item para vídeo e rota autorizada /abrir para arquivos/links, sem expor URL de storage como atalho. Último item de cada produto determina Retomar material na página do produto. Itens removidos, inválidos, não publicados ou revogados não aparecem.
3. Conclusão sincronizada em tabela por aluno/loja/item, com controle explícito de falha e sem sucesso fictício. Marcas aparecem no sumário. Acesso e conclusão são distintos: abrir página de arquivo não registra download. Manter histórico item_access existente. Dados locais antigos não serão migrados automaticamente, pois importação em massa exigiria validação e decisões de conflito fora deste escopo.
4. Arquivos mostram formato derivado somente de extensão reconhecida; quando desconhecido, Arquivo. Não há tamanho confiável no modelo atual: omitir tamanho em vez de estimar. Rótulo visual Baixar PDF/ZIP quando conhecido; Abrir link para links; Conteúdo anterior/próximo na navegação heterogênea.
5. Ajuda contextual no login, produto e item. Canal configurado tem link seguro; sem canal, fornecer instruções úteis (e-mail da compra, pasta Downloads, contato no comprovante), sem botão morto ou contato fictício. Modal de oferta sem checkout explica indisponibilidade.
6. Produto apresenta uma lista de módulos sem sumário duplicado. Item mantém sumário lateral desktop e acesso recolhível Conteúdos antes do conteúdo no celular, com teclado e indicação de item atual. Botão Conta com alvo mínimo 44px e navegação claramente marcada.

## Arquitetura
Next 16.3.5 e React 19 existentes, Supabase server-side. Consultas de recentes relacionais limitadas; conclusão em tabela dedicada com RLS e sem políticas públicas, escrita via servidor autorizado. Migration SQL e testes PGlite não conectam ao banco remoto. Componentes pequenos: MaterialHelp, biblioteca cliente filtrável, sumário responsivo, helper de formato e progresso.

## Aceitação
Testes de autorização cruzada e revogação, recentes válidos, persistência/conclusão reversível, falha de escrita, metadados hostis e ajuda sem configuração. App em QA local hidratado testado com agent-browser em desktop e celular: login pela UI, busca, acesso ao material, sumário, teclado, conclusão persistida e isolada, ajuda, captura de tela e ausência de overflow/erros. npm test, lint e build devem passar, documentando avisos anteriores.
