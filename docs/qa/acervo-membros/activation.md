# Ativação do acervo de materiais

Esta entrega altera código local e inclui migration. Não aplica mudanças no Supabase remoto nem publica a aplicação.

## Ordem de ativação

1. Aplicar `supabase/migrations/20260924000001_member_progress.sql` pelo processo de migrations do projeto, após revisar o destino e o histórico de migrations aplicadas.
2. Conferir `public.member_progress`: chave primária `(customer_id, store_id, item_id)`, índice por aluno/loja/produto, chaves estrangeiras e RLS habilitada. Não criar políticas públicas de escrita: a ação do servidor valida a sessão e o acesso antes de usar o cliente administrativo.
3. Publicar o build revisado. A migration é aditiva e pode preceder a aplicação; a versão anterior não depende da tabela.
4. Usar uma conta de aluno autorizada para conferir um material adquirido, um produto não adquirido, download, conclusão/desmarcação e atualização em outro dispositivo. Não usar dados da fixture para essa conferência.

Se a tabela ainda não existir ou ficar indisponível, a interface deve comunicar indisponibilidade de progresso e manter acesso aos materiais; não deve indicar conclusão salva quando a escrita falha.

## Dados anteriores

O histórico de acessos existente em `item_access` é reaproveitado. Marcas antigas de conclusão que existiam apenas em localStorage não são importadas automaticamente: cada novo estado sincronizado é gravado depois da validação de acesso. Não apagar o armazenamento local do usuário como parte desta ativação.

O modelo atual não armazena tamanho confiável dos arquivos. A interface informa somente formatos reconhecidos no caminho da URL; não mede arquivos remotos nem estima tamanhos. Uma URL de arquivo externo pode abrir no navegador conforme a resposta do servidor de origem; os downloads do storage configurado mantêm a transformação de URL existente.

## Reversão

Reverter a versão da aplicação para o build anterior, preservando a tabela aditiva e seus dados. Não remover a tabela para um rollback de interface. Uma eventual remoção de dados requer uma decisão própria, backup e autorização.

## Reproduzir QA local

Iniciar `node scripts/qa-members-browser-fixture.mjs` na pasta do projeto. O provedor fica em `127.0.0.1:3312` e armazena apenas dados fictícios em memória.

Em outro processo PowerShell:

```powershell
$env:SUPABASE_URL='http://127.0.0.1:3312'
$env:SUPABASE_PUBLISHABLE_KEY='fixture-publishable-key'
$env:SUPABASE_SECRET_KEY='fixture-service-key'
$env:APP_URL='http://127.0.0.1:3310'
$env:ADMIN_EMAILS='admin@example.test'
$env:DEFAULT_STORE_SLUG='arquitetura'
$env:LOGIN_GUARD_SECRET='fixture-only-hmac-secret-32-chars-minimum'
$env:PAYT_INTEGRATION_KEY='fixture-payt'
$env:RESEND_API_KEY='re_fixture'
$env:EMAIL_FROM='fixture@example.test'
$env:TURNSTILE_SITE_KEY=''
$env:TURNSTILE_SECRET_KEY=''
npm run dev -- --hostname 127.0.0.1 --port 3310
```

Abrir `/arquitetura/entrar` e usar `aluno@example.test`; para acervo vazio, `vazio@example.test`. Seguir a UI normal de login. A fixture responde ao mesmo contrato HTTP do provedor; nenhuma rota do aplicativo contém bypass de teste. Controles de falha existem somente na fixture em `/__qa/completion-failure`.

Automação: Vercel agent-browser 0.38.1 em sessão nomeada e isolada. Exemplo `npx --yes agent-browser@0.38.1 --session acervo-qa open http://127.0.0.1:3310/arquitetura/entrar`. Encerrar essa sessão e os dois processos de QA ao terminar.

QA local não comprova a entrega de e-mail, o estado do banco remoto, configurações de atendimento ou reprodução dos provedores externos de vídeo.
