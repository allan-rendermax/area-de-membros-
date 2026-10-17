# E-mail de acesso: clareza transacional

## Objetivo e evidência

O usuário relatou que o e-mail de acesso foi classificado em Promoções no Gmail e pediu ajustes preservando a identidade visual. A mensagem de 17/10 está em INBOX/CATEGORY_PROMOTIONS, com SPF, DKIM e DMARC aprovados. O domínio está verificado no Resend, com open_tracking=false e click_tracking=false. Há partes HTML e texto simples e os links não são redirecionados pelo rastreador.

Um envio de 23/09, com o mesmo remetente e assunto e um corpo mais simples, está em CATEGORY_PERSONAL. As mensagens não constituem um experimento controlado: data, conteúdo e sinais de destinatário variam. Nenhum elemento visual pode ser apontado como causa comprovada.

O Gmail recomenda não misturar promoções com mensagens transacionais e permite que cada destinatário ensine suas preferências de categoria. Confirmações automáticas também podem ir para Atualizações. Não há garantia de Principal.

Fontes: https://support.google.com/mail/answer/81126 e https://support.google.com/mail/answer/3094499?hl=pt-BR.

## Decisão de design

Mudança limitada no template existente. Apenas trocar o título manteria dois convites com peso visual forte. Um e-mail exclusivamente em texto perderia a identidade solicitada. A alternativa escolhida mantém a marca e uma ação visual principal, com linguagem factual e o grupo como recurso secundário.

- Preservar cabeçalho escuro, detalhe laranja e botão amarelo na Arquitetura; preservar o tema das demais lojas.
- Títulos: acesso_novo = "Seu acesso está disponível."; produto_novo = "Novos materiais disponíveis."; reenvio = "Seu link de acesso.".
- Título em 28px no desktop e 24px no celular, sem quebra de linha forçada.
- Manter o link do WhatsApp no e-mail, após as instruções: prefixo "Grupo do projeto: " e link "Entrar no grupo do WhatsApp", verde escuro #127443, sublinhado. Sem fundo colorido de botão ou formato pill no e-mail.
- Preservar assunto, remetente, destinatário, URL de acesso e fallback, produtos, explicação de login sem senha e motivo transacional do rodapé.
- Preservar validação/escape de URLs e omissão do bloco quando não houver grupo válido.
- Não alterar a área de membros, banco, DNS, tracking, regras de acesso ou dependências.

## Validação e publicação

Executar os testes existentes de e-mail, build e revisão independente. Renderizar as três variantes com dados sintéticos em desktop e celular usando agent-browser da Vercel. Publicar apenas a alteração delimitada usando a autorização anterior de publicação. Um único reenvio de validação para a caixa do próprio usuário pode confirmar recebimento, autenticação, conteúdo e categoria observada; não enviar campanha nem mover mensagens de categoria. Reportar a categoria real, inclusive se continuar em Promoções. A investigação não promete causalidade ou taxa de melhoria.
