# Grupo do WhatsApp na jornada de Arquitetura

## Intenção e autorização
O aluno deve encontrar o convite do grupo junto com seu e-mail de acesso e novamente dentro dos módulos/aulas. O usuário forneceu o convite e pediu uma pill verde, centralizada pouco acima do rodapé, usando a identidade atual. Pediu planejamento, execução com subagentes, paralelismo quando independente e testes com Vercel agent-browser. Autorizou resolver as dúvidas e revisar/aprovar o plano sem novas confirmações.

## Decisão
A descoberta encontrou uma plataforma com várias lojas e suporte individual já configurável. Um link fixo no tema seria menor, mas exigiria mudanças de código por loja; um campo por produto repetiria a mesma configuração e geraria convites divergentes. Escolhemos um campo opcional por loja, distinto do suporte, consumido por e-mail e interface. Não muda compras, Payt, planos, permissões ou termos.

## Requisitos
- Convite inicial exclusivo da loja com slug `arquitetura`: `https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t`.
- Campo opcional `community_whatsapp_url` no banco e `communityWhatsappUrl` no domínio; configurável no admin de lojas. Limpar o campo desativa o convite. Outras lojas começam sem grupo e podem configurar o próprio.
- Aceitar somente HTTPS, host exato `chat.whatsapp.com`, sem credenciais/porta customizada/fragmento, e um único segmento de convite alfanumérico, hífen ou underscore. Preservar query string válida, inclusive `?mode=gi_t`; valores inválidos nunca viram links.
- E-mails `acesso_novo`, `produto_novo` e `reenvio` mostram convite secundário; o botão principal continua “Acessar meus materiais”. Não disparar envio retroativo nem e-mail real durante QA.
- E-mails automáticos da Payt, reenvio individual e lote precisam carregar a configuração da loja corretamente.
- Nas páginas de produto/módulo e item/aula, mostrar exatamente uma pill “Entrar no grupo do WhatsApp” centralizada após o conteúdo e antes do rodapé. Cobrir produto vazio. Não exibir no login, boas-vindas, admin ou página inicial do acervo.
- Usar o ícone WhatsApp existente, verde `#25d366`, texto escuro, borda arredondada, foco visível e área de toque mínima de 44px. Abrir em nova aba com `rel="noopener noreferrer"`. Não flutuar nem cobrir conteúdo.
- Preservar rodapé ElevaMAX, upsell existente e WhatsApp individual de suporte. Respeitar autenticação e autorização atuais.
- Sem novas dependências do produto. Ler os guias locais do Next 16.3.5 antes de alterar componentes.

## Dados e ativação
Migration aditiva e reaplicável cria a coluna e preenche apenas Arquitetura quando o campo estiver vazio. Não altera configurações já existentes. A migration precisa preceder o deploy que consulta a nova coluna. Não aplicar migration em serviço externo nem publicar como parte desta implementação local.

## Verificação
Testes de validação, persistência, isolamento de lojas, propagação Payt/reenvio, renderização dos três e-mails e componente. Migration exercitada em PGlite. Executar suíte, lint e build. Navegador Vercel agent-browser contra Next real e backend sintético: produto e aula, produto vazio, loja sem grupo, login sem convite, desktop 1440px e celular 375px, href exato, teclado, ausência de overflow/erros e capturas inspecionadas. Renderizar também uma prévia HTML real do e-mail para inspeção.

## Preservação do trabalho existente
Implementar em worktree gerenciada com cópia das mudanças locais relevantes como baseline, sem publicar o snapshot. Ao concluir, transportar somente o diff desta funcionalidade para o diretório original após conferir aplicabilidade. Documentos e evidências seguem junto; arquivos preexistentes do usuário permanecem intactos.
