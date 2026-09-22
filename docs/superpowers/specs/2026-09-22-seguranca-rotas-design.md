# Revisão de segurança e rotas — 22/09/2026

## Objetivo e autorização

Avaliar e corrigir falhas demonstráveis de segurança, roteamento e entrega da área multi-loja existente. O usuário autorizou brainstorming, planejamento, implementação por subagentes, trabalho paralelo e validação com agent-browser, sem novas perguntas. A revisão e aprovação técnica deste documento e do plano são delegadas ao executor; não representam aprovação para aplicar SQL.

## Restrições

- Preservar visual, login do aluno só por e-mail, acesso calculado e riscos aceitos em `docs/conferencia-gpt-cuspidora.md`.
- Windows/PowerShell, Select-String, Next.js 16: consultar documentação local antes de editar APIs.
- Não alterar `.env.local`, variáveis Vercel, DNS ou serviços privados de produção para testar.
- TDD em correções; testes, TypeScript, lint, build e navegador ao final.
- Criar migração com timestamp, avisar e NÃO aplicar. Código publicado deve funcionar no schema atual.
- Commit e push em português ao final; mudanças isoladas em worktree e branch `codex/seguranca-rotas`.

## Alternativas consideradas

1. Correções pequenas sobre os controles existentes, com regressões que reproduzem os problemas: escolhida por preservar comportamento e permitir publicação independente do SQL.
2. Reestruturar autenticação e permissões: recusada por reabrir decisões aceitas e ampliar risco sem bypass confirmado.
3. Apenas relatório: insuficiente diante do pedido de entrega implementada.

## Achados e comportamento desejado

### Rotas e autenticação

`startsWith('/admin')` captura lojas válidas `admin-loja` e `administracao`. O painel deve corresponder somente ao segmento `admin`, com exceção exata para a página de entrada. Logins e manifestos dessas lojas permanecem públicos; vitrine, produto e item continuam exigindo sessão. Testar o proxy real com Supabase simulado.

O login público de admin revela a allowlist por estados e mensagens distintos. E-mails não autorizados devem receber o mesmo estado público de solicitação de código e o mesmo erro de código inválido, sem enviar OTP ou chamar verificação para esses e-mails. Falha de envio não deve revelar a allowlist; o formulário mantém o passo de código, e o usuário pode solicitar novo código. Sucesso verificado de admin continua redirecionando ao painel.

### Entrega de e-mails

O retry de uma compra nova não pode ser suprimido por aviso de produtos antigos na mesma loja. Verificar cobertura dos IDs de produtos liberados usando `email_log.product_ids`, limitado ao cliente e loja. Qualquer status já registrado representa tentativa recuperável, preservando comportamento atual de `pendente` e `falhou`; este trabalho não cria uma máquina de recuperação de envios pendentes. Não considerar registro vazio como cobertura de produtos desconhecidos. Guardar IDs conhecidos no fallback de falha do envio. Leitura com falha deve permitir retry ou registro explícito, nunca sucesso silencioso.

No lote, cliente bloqueado/reembolsado sem produtos deve ser contado como ignorado, sem gastar cota de tentativa e sem impedir os próximos elegíveis. No máximo 100 tentativas reais por execução e respeitar a cota diária. Não apagar falhas inelegíveis.

### Preservação de ofertas

Código Payt identifica pedidos históricos. Torná-lo imutável após cadastro, com validação no servidor antes de qualquer escrita e campo readonly na edição (sem mudança estética). Novas ofertas continuam aceitando código. Nome e produtos vinculados permanecem editáveis. Código errado exige cadastrar uma nova oferta; isso evita a corrida existente em verificar se já há pedidos antes de trocar o código.

### Titularidade do pedido — SQL pendente

Na primeira transição pendente → pago, usar o e-mail normalizado e nome recebidos no pagamento. Em duplicatas, eventos atrasados e estados finais, preservar titularidade existente, inclusive correção manual feita pelo admin. Reembolso/chargeback continua localizado por transação e código e continua revogando acesso sem retroceder status. Manter assinatura, retorno e privilégios da função `apply_order_status`. Não transferir compras já pagas automaticamente com base em um aviso de mesmo status.

A migração não corrige dados históricos automaticamente, porque não há evidência suficiente para escolher o titular correto. Sem aplicação pelo usuário, esse cenário permanece pendente em produção. Nenhum código novo exige essa migração.

## Verificação

Cada correção terá teste vermelho antes da implementação e teste verde após. SQL será executado em PostgreSQL embutido local (PGlite, apenas devDependency) com fixtures isoladas, nunca no Supabase. Navegador usará o aplicativo real com backend HTTP simulado local e credenciais fictícias, sem alterações de produto para modo de teste. Validar 375px e 1440px, login aluno, isolamento entre lojas, produtos bloqueados, item inválido/despublicado, acesso a arquivo/vídeo, admin sem sessão e aluno tentando painel. Registrar limitações: simulação local não valida configuração privada de produção nem formato real de reembolso parcial da Payt.

## Auto-revisão

Escopo limitado aos cinco achados reproduzidos; sem redesign, nova autenticação, alteração de riscos aceitos ou aplicação de migração. Contratos atuais de banco preservados. Plano executado por subagentes com arquivos separados, revisão independente e validação integrada.
