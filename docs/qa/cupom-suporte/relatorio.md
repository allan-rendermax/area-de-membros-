# QA: cupom de aluno e suporte

24/09/2026. Testes locais com Next real e dados fictícios, Vercel agent-browser 0.38.1, mobile 375×812 e desktop 1440×900.

## Verificado

- Login/ajuda sem WhatsApp: e-mail mailto:grupoelevamax@gmail.com visível; nenhum telefone inventado.
- Login contém main; axe 4.12.1: zero violações. Contraste de quatro nós sobre gradiente ficou inconclusivo, não é certificação integral WCAG.
- Oferta com student_checkout_url: detalhes → Resgatar meu cupom de 10% → Seu desconto de aluno. Apenas um diálogo ativo; Voltar retorna aos detalhes.
- Link do segundo estágio abriu nova aba local com URL exata: http://127.0.0.1:3332/reference?coupon=ALUNO10&utm_source=members#payment. Destino respondeu com conteúdo fictício. Não houve compra ou acesso a checkout externo.
- Tab/Shift+Tab contidos no diálogo e foco na ação principal; Escape fecha e restaura card.
- Entrada direta ?comprar=oferta-qa&utm_source=qa#materiais: Escape fecha, restaura card e mantém utm_source e hash, removendo apenas comprar.
- Oferta sem links informa indisponibilidade, sem anunciar 10%; checkout normal mantém Quero acessar.
- Sem overflow horizontal a 375px; capturas mobile e desktop inspecionadas visualmente. Captura desktop refeita após terminar animação.
- Suíte integrada: 542 testes em 74 arquivos passaram. Um teste antigo de igualdade foi atualizado para o novo campo após a primeira execução integrada detectar a expectativa desatualizada.
- Lint global: zero erros, um aviso preexistente em scripts/trocar-admin-e-aluno.mjs (loja não utilizada).
- Migração aplicada em PGlite preservou registro existente e inicializou campo null.
- Revisões independentes: suporte aprovado; cupom aprovado após corrigir foco em abertura direta. A correção teve RED/GREEN e confirmação no navegador.

## Reprodução

Iniciar node scripts/qa-coupon-support-fixture.mjs (127.0.0.1:3332). Configurar ambiente local com SUPABASE_URL=http://127.0.0.1:3332, SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key, SUPABASE_SECRET_KEY=fixture-service-key, APP_URL=http://localhost:3331, ADMIN_EMAILS=admin@example.test, DEFAULT_STORE_SLUG=arquitetura e LOGIN_GUARD_SECRET com string fictícia de 32+ caracteres. Demais chaves são fictícias como descrito em ../acervo-membros/activation.md. Não usar credenciais reais neste ambiente.

Executar npm run dev -- --port 3331. Login pela interface com aluno@example.test. Há uma oferta com cupom, uma sem links e uma normal. POST local /__qa/whatsapp alterna número sintético para inspeção do link, sem enviar mensagem. Alterar fixture diretamente não invalida cache da aplicação (300s); usar nova execução/build para conferir a configuração. O admin real invalida o cache ao salvar a loja.

## Configuração para ativação futura

1. Aplicar supabase/migrations/20260924000002_student_checkout.sql antes de publicar o código, pois as consultas passam a selecionar a coluna nova.
2. Admin > Produtos > produto > Checkout de aluno com 10% de desconto: colar o link completo gerado no provedor com cupom aplicado. O código não cria o cupom no provedor. Sem esse link, não se anuncia desconto.
3. Admin > Lojas > loja > WhatsApp de suporte: preencher DDI, DDD e número. Enquanto vazio, e-mail permanece disponível na ajuda.
4. Conferir manualmente preço/desconto no checkout real após cadastrar. Nenhum link real foi fornecido ou validado nesta entrega.

Sem publicação, migração remota, alteração de cadastros, envio de WhatsApp/e-mail ou mudança nos títulos de download. E-mail informado é suporte, não remetente transacional.
