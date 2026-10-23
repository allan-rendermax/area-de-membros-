# Conferência local de planos por checkout

O fixture é sintético, guarda alterações em memória e usa somente o backend localhost. Reiniciar limpa os dados. A autenticação é o mesmo fluxo OTP administrativo do fixture anterior.

No diretório do projeto, em um terminal:

```powershell
$env:QA_PROVIDER_PORT='3311'
node scripts/qa-admin-browser-fixture.mjs --checkout-plans
```

Em outro terminal, configure somente esse processo antes de iniciar Next:

```powershell
$env:SUPABASE_URL='http://127.0.0.1:3311'
$env:SUPABASE_PUBLISHABLE_KEY='fixture-publishable-key'
$env:SUPABASE_SECRET_KEY='fixture-service-key'
$env:APP_URL='http://127.0.0.1:3310'
$env:ADMIN_EMAILS='admin@example.test'
$env:DEFAULT_STORE_SLUG='teste'
$env:LOGIN_GUARD_SECRET='fixture-only-hmac-secret-32-chars-minimum'
$env:PAYT_INTEGRATION_KEY='fixture-payt'
$env:RESEND_API_KEY='re_fixture'
$env:EMAIL_FROM='fixture@example.test'
npm run dev -- --hostname 127.0.0.1 --port 3310
```

Abrir `http://127.0.0.1:3310/admin/entrar`; e-mail `admin@example.test`, código `123456`. Nenhum e-mail é enviado. Usar um perfil/cookies separados de outras sessões locais.

Roteiro desktop e mobile:

1. `/admin/ofertas`: identificação e referências aparecem em Básico/Completo para `QA-SHARED`.
2. `/admin/ofertas/00000000-0000-4000-8000-000000000201`: modo, código e referência fixos; aliases e níveis reabrem corretamente. Acrescentar um alias, salvar e recarregar preserva ambos.
3. Tentar remover alias salvo: erro no formulário sem perder os dados. Uma segunda aba com versão antiga recebe erro de concorrência.
4. Nova oferta: alternar produto/checkout/upsell; conferir campos condicionais, aliases por linha, identificação compartilhada com aliases distintos, mistura/sobreposição recusadas, seleção e níveis preservados após erro.
5. `/admin/pedidos?filtro=problemas`: pedido fictício pago com checkout desconhecido e explicação visível. `/admin/avisos` e detalhe mostram a mesma identificação; payload conserva o código bruto.

O fixture não implementa downloads, acesso de membro, remoção de ofertas nem o banco real. Ele auxilia a conferência visual e as Server Actions; as invariantes SQL e o acesso têm testes próprios. Encerrar os dois processos com Ctrl+C ao concluir. Não usar arquivos de ambiente de produção nem serviços externos.
