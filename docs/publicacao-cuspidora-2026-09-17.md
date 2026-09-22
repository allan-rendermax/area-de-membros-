# Publicação da cuspidora — 17/09/2026

- Produção atualizada para o commit `6b0dfe3d4d05a4862221c56ba7bfe10368d367e7` por push de `main` ao repositório existente.
- Deploy Vercel confirmado **Ready / Production / Current**: https://vercel.com/rendermax/area-de-membros-/Bt7Hz9J7HrqRjdk3k7mT8Dfdj4TP
- Área: https://area-de-membros-taupe.vercel.app/arquitetura
- Admin: https://area-de-membros-taupe.vercel.app/admin/entrar
- `LOGIN_GUARD_SECRET` criado como Secret somente em Production. Preview ainda precisa de configuração própria para executar o novo login.
- `EMAIL_DAILY_LIMIT` usa o padrão do código (100); Turnstile não configurado nesta publicação.
- Supabase: confirmada a existência das seis tabelas novas; loja `arquitetura`, quatro produtos, quatro módulos e quatro itens. Nenhuma migração foi executada nesta sessão; a limpeza destrutiva foi preservada como pendente.
- Verificação local: 189 testes passaram, lint e build concluídos.
- Verificação pública: login da loja e admin HTTP 200; rotas protegidas redirecionam sem sessão; manifesto e service worker HTTP 200; webhook com chave deliberadamente inválida retorna 401 (gera um evento de diagnóstico).
- Login no navegador com o cliente de exemplo existente concluído; vitrine mostra Atlas liberado e três bônus bloqueados.

## Limites e pendências

- Resend: consulta de leitura retornou domínio `not_started`. Entrega de e-mails e entrada do administrador por código não foram validadas; nenhum e-mail foi solicitado nesta sessão.
- Materiais e links de exemplo permanecem. Não houve compra real, reembolso, chargeback ou alteração de ofertas.
- Os riscos da conferência independente não foram corrigidos nesta publicação. A autorização do usuário foi colocar a versão atual no ar.
- Alterações locais preexistentes em documentos foram preservadas e não incluídas no push.
