# Cupom de aluno, suporte e acessibilidade

## Escopo confirmado em 24/09/2026

Manter literalmente Clique aqui para download e os títulos atuais. Preservar apresentação de home, produto mobile e item. Implementar fluxo de oferta bloqueada com cupom de aluno de 10%, suporte WhatsApp configurável depois e e-mail grupoelevamax@gmail.com, e região principal no login. Cabeçalho, produtos de teste e cadastros de produção não são alterados.

## Fluxo e configuração

Adicionar products.student_checkout_url, nullable. O admin cola nesse campo o link completo gerado no provedor de checkout com o cupom de aluno de 10% já aplicado. Não presumir nome de parâmetro de provedor nem criar cupom externo. Só apresentar promoção de 10% quando esse campo contiver URL HTTP(S) válida. Link normal existente permanece fallback sem promessa de desconto. Sem nenhum link, informar indisponibilidade momentânea.

Na oferta, Resgatar meu cupom de 10% abre um segundo diálogo, com título Seu desconto de aluno, identificação do produto, texto Você tem 10% de desconto neste material. e botão Ir para o checkout com 10% de desconto. O href é exatamente o link configurado, preservando parâmetros e fragmento. Preferir dois estágios sequenciais, um único diálogo ativo por vez, para evitar modais sobrepostos: Voltar retorna aos detalhes, Escape/fechamento encerra e restaura o foco ao card, reabrir começa pelos detalhes. Limpar comprar da URL somente ao encerrar. No preview administrativo não expor nenhum checkout.

Suporte usa support_whatsapp já existente no cadastro de loja, sem número inventado. MaterialHelp mantém orientações de arquivos e mostra sempre o contato fornecido via mailto. Se href validado for WhatsApp, rotular Falar pelo WhatsApp; outro HTTP(S) mantém Falar com o suporte. Contato opcional vazio ou inválido não cria botão quebrado. E-mail é constante de suporte desta instalação, não muda remetente de mensagens transacionais e não envia mensagem alguma. Admin explica onde preencher o número e que vazio esconde o WhatsApp.

No login trocar apenas o contêiner do painel principal de div para main, preservando classes, aside e aparência.

## Limites e validação

Implementação local em worktree; nenhuma migração, oferta, cupom ou publicação remota nesta etapa. Migração deve ser aplicada antes de eventual deploy. Link de cupom e número serão preenchidos pelo usuário posteriormente. Testes unitários de persistência/validação/fluxo, teclado/foco, fallback de suporte, migração local, suíte completa, lint/build e agent-browser com dados fictícios e checkout local. Não afirmar desconto conferido no provedor real sem URL real.
