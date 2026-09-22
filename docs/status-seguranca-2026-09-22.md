# Segurança e rotas — revisão de 22/09/2026

## Escopo

Revisão do código de autenticação, sessão, autorização administrativa, isolamento de lojas, produtos/itens, webhook, e-mails, ofertas e PWA. Preservados login de aluno só por e-mail, visual e riscos aceitos no documento de conferência. O status de e-mail de 22/09 foi considerado vigente; não foi alterado DNS, Resend ou Vercel.

Spec: `docs/superpowers/specs/2026-09-22-seguranca-rotas-design.md`.
Plano: `docs/superpowers/plans/2026-09-22-seguranca-rotas.md`.

## Correções

| Achado | Correção |
|---|---|
| Lojas `admin-loja`/`administracao` eram confundidas com painel | Guard compara o segmento completo `/admin` |
| Formulário público revelava e-mails da lista de admins | Solicitação e erros de código têm resposta neutra, inclusive falha do provedor; somente allowlist chama OTP; reenvio disponível sem preencher token |
| Editar código Payt de oferta retirava acesso dos compradores | Código imutável no servidor; readonly na edição; novas ofertas continuam aceitando código |
| Retry após falha parcial podia perder aviso de compra nova | Cobertura de aviso verificada por produto, cliente e loja, usando coluna existente `product_ids` |
| Primeiro grupo inelegível podia travar reenvio em lote | Somente tentativas de envio consomem slots; cliente sem acesso é ignorado e o próximo é processado |

## Migração pendente — NÃO aplicada

Arquivo preparado: `supabase/migrations/20260922150000_order_payment_identity.sql`.

Corrige o e-mail e nome do titular quando o pedido muda de pendente para pago. Mantém titularidade em avisos duplicados/atrasados, correções administrativas e reembolsos. Assinatura, retorno e permissões da RPC permanecem iguais.

**O usuário deve aplicar esse SQL no Supabase.** Nenhuma chamada ao Supabase para aplicar a migração foi feita. O código desta entrega funciona com o banco atual e não depende da migração. Até sua aplicação, a falha de e-mail diferente entre pendente e pago continua existente em produção.

Não há alteração automática de pedidos históricos. E-mail diferente em aviso de compra já paga não transfere titularidade: correções desse tipo continuam sendo administrativas. A validação local do SQL não confirma a situação das migrações no banco remoto.

## Decisões tomadas

- Execução autônoma dos documentos e plano conforme pedido explícito. Os artefatos e commits permitem revisão posterior.
- Todo código de oferta existente é imutável, mesmo sem pedidos: impede corrida entre checagem e pagamento. Custo: corrigir um código digitado errado exige criar outra oferta.
- Migração entregue separadamente, sem dependência no código publicado. Custo: o cenário de titularidade só estará corrigido em produção após aplicação manual.
- `pendente`/`falhou` continuam sendo tentativas registradas de e-mail; não foi alterado o mecanismo de recuperação de pendências nem reabertos riscos aceitos.

## Testes de navegador

Usado **agent-browser da Vercel 0.38.1**, no aplicativo real em desenvolvimento e em build de produção local, com backend HTTP/Auth fictício. Não foram usados clientes reais, chaves privadas ou envio de e-mail.

| Cenário | Resultado observado |
|---|---|
| Login → vitrine → produto, 375px/1440px | Fluxo funcional; sem overflow horizontal do documento |
| Produto bloqueado | Janela de compra; URL direta direciona para `?comprar=` |
| Item de arquivo e vídeo | Redirecionamento correto e iframe do provedor; registro de acesso e Continuar |
| Item de outra loja, despublicado e loja inexistente | Página 404 |
| Loja sem compra | Estado vazio; produtos permanecem bloqueados |
| Pedido reembolsado | Arquivo antes liberado passa a redirecionar para compra |
| Cliente bloqueado | Vitrine volta ao login |
| Visitante/aluno tentando admin | Redirecionado para `/admin/entrar` |
| Admin com OTP fictício válido | Painel de produtos acessível |
| Reenvio de OTP com token vazio | Botão funciona e mantém resposta neutra; login seguinte continua válido |
| `admin-loja` | Login completo funciona; manifesto público HTTP 200 |
| Oferta existente / nova | Código readonly / editável, respectivamente |
| URLs dos arquivos e chave de serviço no HTML | Ausentes na vitrine/produto e painel inspecionados |
| Webhook local com JSON inválido / chave incorreta | HTTP 400 / HTTP 401 |

Limites: backend simulado não valida RLS/configuração privada do Supabase, entrega real de OTP/Resend ou contrato real de reembolso parcial da Payt. Vídeo validado pelo iframe e endereço, sem exigir reprodução externa. A revisão não encontrou bypass de autorização demonstrável nos fluxos inspecionados; isso não constitui certificação de ausência de vulnerabilidades.

## Validação e revisão

Baseline: 204 testes em 31 arquivos. Cada correção teve regressão observada falhando antes da implementação. Testes SQL executados apenas em PostgreSQL embutido PGlite, como dependência de desenvolvimento.

Auditoria das dependências de produção: `npm audit --omit=dev --audit-level=moderate` retornou zero vulnerabilidades conhecidas.

Resultados finais na worktree:

| Comando | Resultado |
|---|---|
| `npm test` | 248 testes passando em 36 arquivos |
| `npx tsc --noEmit` | exit 0, sem erros |
| `npm run lint` | exit 0; 0 erros e 1 aviso preexistente em `scripts/trocar-admin-e-aluno.mjs:20` (`loja` sem uso) |
| `npm run build` | exit 0; compilação e geração das rotas concluídas |

Vitest também avisa sobre futura mudança de `configLoader` e ESM em `vitest.config.ts`; aviso já presente no baseline, sem falha associada.

Commits de implementação: `8accb71` (rotas/login), `f81a33c` (ofertas), `8b94517` (e-mails), `b467d36` (reenvio de OTP), `3ae97b2` (migração e testes SQL).

Revisão independente por tarefa e revisão final do conjunto **aprovadas**, sem achados acionáveis restantes. O único ajuste exigido na revisão foi acrescentar o controle explícito de reenvio de OTP; foi corrigido, coberto por regressão e reavaliado. Integração por fast-forward em `main`, com push autorizado pelo usuário.

Ao retomar com Claude: informar “o Codex mexeu no projeto” e ler este documento e o histórico. **A aplicação da migração continua sendo uma ação manual pendente.**
