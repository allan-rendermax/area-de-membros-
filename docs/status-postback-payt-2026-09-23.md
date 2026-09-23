# Correção do timeout no teste de postback — 23/09/2026

## Diagnóstico

Quatro eventos reais do botão Testar URL da Payt chegaram autenticados, marcados com `test: true` e cinco códigos fictícios. A diferença entre `received_at` e `processed_at` foi de 4,314 a 6,060 segundos. O fluxo anterior consultava e gravava cada produto, criava cliente e só então respondia; os eventos terminavam como `codigo_desconhecido`. O painel Payt mostrava “Tempo de requisição excedido”. O limite exato de espera do provedor não foi documentado nesta investigação.

## Mudança

Depois da validação da chave e do payload, um evento marcado como teste registra o resultado `teste` e retorna HTTP 200, sem consultar ofertas, criar/atualizar pedidos ou clientes, alterar acessos ou enviar e-mails. O admin apresenta “Teste recebido”. As duas gravações do evento continuam sendo aguardadas: falha no registro retorna 500, permitindo nova tentativa.

Os formatos `true`, `"true"`, `1` e `"1"` seguem a normalização já existente. Essa regra vale também para testes com códigos conhecidos ou status de reembolso. Eventos reais, incluindo produto de nome TESTE_01 comprado normalmente com `test: false` ou ausente, mantêm o fluxo anterior. Os pedidos fictícios antigos permanecem preservados.

## Verificação local

- TDD: cinco casos falharam no código anterior, reproduzindo criação indevida de pedidos/clientes e envio para códigos conhecidos; passaram depois da correção.
- Suíte completa: 394 testes em 52 arquivos passaram, incluindo compra, bumps, reembolso separado, chave inválida, payload inválido e falhas de persistência.
- Testes da rota usam o handler e processador reais com repositório/notificador de teste; não medem latência remota.
- Build de produção e TypeScript concluídos.
- ESLint: zero erros; um aviso preexistente em `scripts/trocar-admin-e-aluno.mjs:20`.
- Revisão independente sem achados bloqueantes; `git diff --check` sem erros.
- Sem migração, alteração de credenciais ou configuração da Payt.

## Publicação

- Commit `e74ee4d7d335a6b42d360ee7d6a065fd22ab6c68` enviado por push normal a `main`.
- Vercel confirmou Ready / Production: https://vercel.com/rendermax/area-de-membros-/Cs2jgjgbAr7epKdwoeBj3y71PqKM.
- Às 14:40:51 BRT, acionado Testar URL na tela de cadastro já preenchida pelo usuário, mantendo URL, tipo, produtos e eventos selecionados.
- A Payt substituiu Testar URL pelos botões Salvar e Salvar e Voltar, confirmando aceitação do teste. O cadastro ficou aberto para o usuário concluir; não foi acionado Salvar.
- Evento recebido às `17:40:51.699347Z`, finalizado às `17:40:51.793Z`: aproximadamente 94 ms entre registro e conclusão, `key_valid=true`, `outcome=teste`, sem erro. Esse intervalo não inclui todo o trajeto de rede entre Payt e Vercel.
- Comparação antes/depois de contagens e hashes dos registros vinculados ao destinatário fictício confirmou pedidos e cliente anteriores inalterados, e nenhum registro de e-mail novo.
- Compra real e confirmação de entrega na caixa do comprador não foram executadas nesta correção. Os fluxos reais foram cobertos pela suíte local.
