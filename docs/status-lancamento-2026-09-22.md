# Revisão funcional para lançamento — 22/09/2026

## Estado de publicação

Esta revisão foi integrada de `codex/prontidao-lancamento` para `main` por fast-forward e publicada após autorização explícita do usuário. As migrações `20260922150000_order_payment_identity.sql` e `20260922210000_admin_atomic_mutations.sql` foram aplicadas antes do deploy. A Vercel confirmou o commit `dd54b5b` como Ready / Production, com o domínio público atribuído.

Não é uma certificação de “100% pronto”: compra real com bump/reembolso e confirmação de entrega pelo provedor continuam pendentes de validação operacional.

## Auditoria e decisões

Foram revisados login, sessão, autorização de aluno/admin, catálogo, produto/item, trilhas, CRUD administrativo, upload, ofertas, cliente/acesso manual, webhook, e-mail, PWA e navegação. Login só por e-mail e os riscos aceitos no documento de conferência foram preservados.

- Formulários vinculados à loja original: trocar loja em outra aba não pode gravar/enviar no contexto novo.
- Avisos da Payt usam titular/status persistidos e não o endereço de um payload antigo.
- Oferta sem conteúdo publicado gera diagnóstico explícito; seleção vazia passa a ser recusada.
- Salvamento de oferta e atualização de dados públicos de e-mail usam transações; Auth permanece operação externa com compensação e reconciliação.
- Diálogos de compra/instalação têm portal, foco contido/restaurado, Escape e rolagem própria.
- Páginas de erro/404 em português oferecem recuperação sem exibir detalhes internos.

## Evidência real, somente leitura

Consulta realizada nesta sessão usando a configuração local existente, sem imprimir chaves, alterar ambiente ou gravar dados remotos:

- 1 loja (`arquitetura`), 2 produtos publicados, 3 módulos, 7 itens e 2 ofertas.
- As 2 ofertas têm produtos publicados; nenhum item publicado usa example.com/org/net.
- Os 7 arquivos responderam HTTP 200 a HEAD: quatro PDFs e três ZIPs. Isso verifica disponibilidade e tipo anunciado; não inspeciona o conteúdo completo de cada arquivo.
- A loja não tem suporte configurado; os dois produtos não têm checkout configurado. Para suporte e compra adicional dentro da área, cadastrar os endereços reais no admin.
- A tela de login pública abriu no agent-browser. Não foi solicitado código nem enviado e-mail real.
- Axe no login público identificou contraste insuficiente no botão de entrada e cinco verificações inconclusivas sobre imagem/fundo. Paleta existente preservada conforme restrição; não afirmar conformidade WCAG completa.

## Reproduções do navegador antes da correção

Agent-browser Vercel 0.38.1, build de produção anterior e backend HTTP/Auth sintético:

- Compra com descrição extensa em 1440×600: título y=-1162 e CTA y=1946, fora do viewport.
- Tab após Fechar saiu do diálogo e alcançou o body.
- Instalação em emulação iPhone 15: diálogo 393×78, preso ao cabeçalho, com viewport 393×852.

Capturas e fixture: `C:/Users/arqal/.codex/visualizations/2026/09/22/01a0cac0-9d43-71d3-a285-20fb7f70f43a/lancamento/`. Dados e contas são fictícios.

## Pendências operacionais e limites

1. **Concluído:** aplicar as duas migrações no Supabase, na ordem dos timestamps. Backup das definições anteriores guardado; detalhes e verificações abaixo.
2. **Deploy concluído:** revisão publicada depois do SQL. Smoke remoto de login aluno, vitrine, produtos, arquivos e bloqueio do admin confirmado. Login admin com OTP, gravação de oferta e correção de e-mail real não foram repetidos em produção; os testes anteriores desses fluxos usaram ambiente sintético.
3. Conferir códigos de oferta com a Payt e executar compra autorizada com bump, reembolso só do bump e chargeback. Confirmar que o principal permanece acessível quando só o bump é reembolsado; o contrato real não é demonstrado pelo fixture.
4. Confirmar recebimento do acesso e do código administrativo em uma caixa de teste do proprietário. O documento de e-mail anterior registra entrega, mas esta revisão não envia mensagens.
5. Configurar suporte e checkout, se a intenção é permitir essas ações dentro da área.

Reentregas simultâneas podem duplicar e-mails; os pedidos continuam únicos. Não foi prometida entrega exactly-once. Auth e Postgres são sistemas separados; falha de rede ambígua requer leitura de reconciliação e não admite compensação cega. Duas correções concorrentes de identidade continuam exigindo cuidado operacional; não há transação distribuída.

## Validação final do código

Código validado: `9734282`. Na revisão inicial, nenhuma migração havia sido aplicada remotamente. As duas foram aplicadas posteriormente conforme registro abaixo. Nenhuma mensagem real foi enviada e nenhum deploy/push foi executado nesta revisão.

| Verificação | Resultado observado |
|---|---|
| `npm test` | 49 arquivos, 370 testes passando |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0, zero erros; um aviso preexistente em scripts/trocar-admin-e-aluno.mjs:20 |
| `npm run build` | exit 0; compilação, TypeScript e rotas concluídos com ambiente sintético |
| `npm audit --omit=dev --audit-level=moderate` | zero vulnerabilidades conhecidas |
| `git diff --check` | sem problemas |
| Revisão independente | tarefas e correções aprovadas; revisão final sem achado adicional |

Aviso anterior do Vitest/Vite sobre ESM/configLoader permanece. Regressões TypeScript tiveram RED/GREEN observado. Os testes SQL executam a migração real em PGlite; o primeiro run do arquivo SQL já foi GREEN, sem RED anterior registrado. Eles demonstram rollback/validação/permissões, mas não concorrência com duas sessões PostgreSQL independentes. O bloqueio FOR UPDATE foi revisado no SQL.

## Navegador — resultados depois das correções

Foram aprovadas 31 verificações do aluno em `qa-members.json` e 22 do admin em `qa-admin.json`, usando agent-browser Vercel 0.38.1 no aplicativo Next real em build de produção, com backend HTTP/Auth sintético. O QA de aluno usa o build c1f499d (mesmo código frontend de 9734282); o QA administrativo e o smoke final usam 9734282.

| Fluxo | Resultado |
|---|---|
| Login aluno → vitrine → produto → arquivo | Funcionou; destino de arquivo sintético atingido |
| Vídeo | Iframe do provedor correto; reprodução externa não é critério deste teste |
| Item oculto/de outra loja | 404 em português, sem entregar conteúdo |
| Reembolso e bloqueio | Produto volta a compra; cliente bloqueado volta ao login |
| Aluno tentando admin | Entrada administrativa, sem acesso ao painel |
| Compra longa em 375×812 e 1440×600 | Painel dentro do viewport, rolagem interna e CTA alcançável |
| Teclado e fechar | Tab/Shift+Tab contidos; Escape devolve foco; query/hash preservados |
| Instalação iPhone emulado | Portal cobre viewport, instruções e Entendi acessíveis; foco retorna ao acionador |
| Falha de dados e recuperação | Erro amigável sem detalhes internos; Tentar novamente recupera após backend restaurado |
| Manifesto/ícone/sw/offline | Recursos públicos HTTP 200 |
| OTP administrativo | Login com código fictício; oito listas administrativas abriram |
| Duas abas/troca de loja | Produto novo não é gravado; edição existente de produto/oferta mostra aviso na lista, sem 404 |
| Produto → módulo → arquivo → oferta | Cadastro completo e persistência no fixture confirmados |
| Acesso manual → revogação | Pedido manual cancelado; compra paga separada preservada |
| Correção de e-mail | Cliente e pedidos atualizados; login com novo e-mail e Atlas funcionaram no smoke final |
| Admin mobile | Sem overflow horizontal do documento; tabelas têm rolagem própria |
| Webhook local inválido | JSON malformado 400; chave errada 401 |

A emulação iPhone roda em Chromium; o fallback de instalação foi exercitado após simular dispensa do prompt Chromium. Não substitui teste em Safari/iPhone físico. Happy-dom é usado somente nos testes DOM. O fixture da RPC testa a ligação da UI com o contrato; semântica transacional real é coberta pelos testes SQL separados. O QA não valida configuração privada/RLS nem a infraestrutura remota.

As capturas `after-install-iphone.png`, `after-long-modal-375.png` e `after-admin-mobile.png` foram inspecionadas visualmente. Falhas iniciais do harness (primeiro lançamento do daemon e conexão local reutilizada) foram corrigidas antes das execuções concluídas. O erro de backend injetado produziu o log esperado; a rodada administrativa encerrou sem erros de runtime do navegador.

## Decisões de execução

- Aprovação autônoma do desenho/plano conforme pedido; se o escopo estiver incorreto, o custo é revisão dos commits.
- Código integrado em `main` e publicado no acompanhamento abaixo; worktree preservado com os registros locais de revisão.
- Deduplicação durável de mensagens não foi incluída sem definir reserva/recuperação; o custo é possível aviso duplicado em reentrega simultânea.
- Tarefas com arquivos independentes executadas em paralelo e commits coordenados; o custo de eventual conflito é reconciliação antes da entrega.
- Happy-dom foi adicionado somente como dependência de desenvolvimento para testes reais de foco/portal; o custo é uma instalação de desenvolvimento maior, sem dependência de produção nova.
- O limite de agentes impediu retomar o primeiro implementador; seu revisor fez uma correção delimitada e outro agente a revisou. O custo foi menor isolamento de contexto nessa correção, compensado pela nova revisão independente.
- A paleta foi preservada e o achado de contraste registrado; o custo é manter essa limitação de acessibilidade até ajuste visual autorizado.

## Aplicação das migrações — acompanhamento de 22/09/2026

Aplicação autorizada pelo usuário e realizada pelo SQL Editor no Chrome autenticado, no projeto `area-de-membros` (`tujtwlrxpetpiatlbrps`), branch `main / PRODUCTION`.

- Antes da execução, somente `apply_order_status` existia entre as três funções. A definição e a ACL anteriores foram consultadas e guardadas em `C:/Users/arqal/.codex/visualizations/2026/09/22/01a0cac0-9d43-71d3-a285-20fb7f70f43a/migracoes/pre-migration-functions.sql`. É backup das funções afetadas, não backup completo do banco.
- Os dois scripts foram executados na ordem, dentro de uma transação com `BEGIN`/`COMMIT`. Foi emitido `NOTIFY pgrst, 'reload schema'`.
- As versões `20260922150000` (`order_payment_identity`) e `20260922210000` (`admin_atomic_mutations`) foram registradas em `supabase_migrations.schema_migrations`, com o SQL correspondente. Consulta posterior confirmou os dois registros.
- As três funções permitem execução ao `service_role`; `anon` e `authenticated` retornaram `false` para `has_function_privilege`. ACLs contêm apenas `postgres` e `service_role`. `search_path` vazio confirmado em todas; somente `apply_order_status` usa `SECURITY DEFINER`.
- O MD5 de cada corpo remoto foi comparado ao corpo do arquivo local com as quebras CRLF inseridas pelo editor: `apply_order_status = 8a4b25e811a3f0ef68287c00dec4fb9e`, `save_offer_atomic = 49ffea6677fe86f34a5dcf4da4257386`, `change_customer_email_atomic = c295cab0789d4a2b0c40f074c539c269`. Todos coincidem.
- Testes no banco remoto confirmaram a rejeição de oferta sem produtos e de correção de e-mail para cliente inexistente, com as mensagens esperadas. A transação de verificação foi encerrada com `ROLLBACK`; nenhum dado de teste ficou persistido.
- Esta etapa não executou compra, envio de e-mail, alteração de cliente real, deploy ou push. O próximo passo operacional é publicar a revisão validada e realizar os smokes descritos acima.

## Deploy e smoke de produção — 22/09/2026

- Revisão publicada: `dd54b5bf6543f979aff80c22b23bff2680ee2114`, por push normal de `main` após fast-forward. Nenhum conflito ou force-push.
- Deploy confirmado Ready / Production: https://vercel.com/rendermax/area-de-membros-/B9qWbjRfQV749cq7cvP9h1SpUabL. Domínio público: https://area-de-membros-taupe.vercel.app/arquitetura. Deploy anterior preservado para rollback: `7xMK5Xz7evYmUsFRGWYRwvH8Eyn5` (`c5e222f`).
- Verificação local repetida antes do push: 370 testes / 49 arquivos, TypeScript e build concluídos, lint sem erros e com um aviso preexistente. O primeiro build não tinha ambiente no worktree; a tentativa com `--env-file` encontrou incompatibilidade com os workers do Next. O build final passou carregando o ambiente existente em memória e iniciando um processo filho. Nenhum arquivo `.env.local` ou variável da Vercel foi alterado.
- Agent-browser Vercel 0.38.1: conta de aluno de teste existente entrou, abriu vitrine, Atlas e Bônus. Acesso aos sete itens confirmado pela sessão autenticada: quatro respostas PDF e três ZIP, todas HTTP 200 com bytes iniciais corretos. O comando automático de download não capturou o arquivo aberto em outra aba; a verificação alternativa confirmou o redirecionamento HTML e a resposta do arquivo, sem prometer validação de salvamento completo em disco.
- Vitrine em iPhone 15 emulado sem overflow horizontal. Captura inspecionada: `C:/Users/arqal/.codex/visualizations/2026/09/22/01a0cac0-9d43-71d3-a285-20fb7f70f43a/lancamento/producao-vitrine-mobile.png`. O clique de instalação não abriu o diálogo HTML nessa execução; a cobertura de foco/portal permanece a dos testes anteriores, sem afirmar nova validação em Safari físico.
- O aluno acessando `/admin` foi redirecionado a `/admin/entrar`. Tela administrativa abriu, sem solicitar OTP. Nenhum erro de página foi reportado pelo navegador.
- Smoke HTTP: `/` e `/admin` redirecionam como esperado; login aluno/admin, manifesto, ícone 192, service worker e página offline retornam 200.
- O login de teste registrou tentativa/dispositivo; o acesso aos itens registrou progresso normal da conta de teste. Nenhuma compra, e-mail, correção de identidade ou edição de oferta real foi efetuada.
- Este acompanhamento altera apenas documentação; o código da aplicação permanece idêntico ao commit publicado e testado acima.
