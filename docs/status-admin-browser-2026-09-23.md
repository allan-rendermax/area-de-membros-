# Publicação: navegador confiável por sete dias

- Autorização explícita do usuário: “publique”.
- Commit publicado por push normal em `main`: `54edb968682bbec1ae1d41797a8e9ba7bef1145d`.
- Deploy Vercel confirmado `Ready / Production`: `dpl_DP3Td59api7MnwoaYeR4ikHdSz8p`.
- Painel do deploy: https://vercel.com/rendermax/area-de-membros-/DP3Td59api7MnwoaYeR4ikHdSz8p.
- Domínio oficial atribuído: https://members.grupoelevamax.com.
- Admin: https://members.grupoelevamax.com/admin/entrar.
- Deploy anterior preservado: https://area-de-membros-jvwlcekjc-rendermax.vercel.app, commit `e74ee4d7d335a6b42d360ee7d6a065fd22ab6c68`.

## Verificação

Antes do push, os 23 arquivos do escopo foram comparados por hash com a revisão aprovada. A suíte completa passou novamente: 425 testes em 55 arquivos. Build e TypeScript aprovados na etapa anterior com o mesmo código; build remoto Vercel concluído em produção.

Após o deploy, HTTPS `/admin/entrar` e `/arquitetura/entrar` retornaram 200; `/admin` sem sessão retornou 307 para `/admin/entrar`, e `/arquitetura` retornou 307 para `/arquitetura/entrar`.

O agent-browser 0.38.1 confirmou o formulário novo no domínio oficial, incluindo rótulos e “Confiar neste navegador por 7 dias”. Um e-mail fictício não autorizado permitiu conferir o estado neutro do formulário sem envio real. Código inválido continuou recusado e a escolha marcada foi preservada após erro e reenvio. Console e lista de erros vazios. Sessão de navegador de teste encerrada.

A presença de `LOGIN_GUARD_SECRET` e `ADMIN_EMAILS` em Production foi confirmada por metadados; seus valores não foram lidos nem alterados. Nenhuma mudança em DNS, banco, clientes, compras, permissões ou variáveis de produção. Login administrativo válido em produção e entrega real de e-mail não foram executados; o fluxo completo havia sido validado com o provedor local.

No primeiro acesso após esta publicação, o administrador valida o código e marca a opção. As sessões anteriores sem o novo marcador exigem essa confirmação inicial. O prazo é absoluto de sete dias; saída explícita ou remoção de cookies exige nova confirmação.
