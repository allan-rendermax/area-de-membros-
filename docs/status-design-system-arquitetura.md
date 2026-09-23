# Implementação — design system Arquitetura

## Entrega

Tema laranja/amarelo isolado pelo slug exato arquitetura; tipografia de impacto, hero fotográfico, capas do Atlas e Bônus, composição automática para itens, login, cabeçalho, botões, ofertas e suporte de tema nos portais.

Medidas e larguras responsivas anteriores preservadas. Produtos, pedidos, ofertas, arquivos, autenticação e permissões não foram alterados. Imagens já cadastradas têm prioridade.

## Verificação em 22/09/2026

- Vitest: 377 testes passando em 51 arquivos.
- ESLint: 0 erros; 1 aviso já existente em scripts/trocar-admin-e-aluno.mjs.
- Build Next 16.3.5 e TypeScript: concluídos.
- Navegador com backend sintético local: login, vitrine, produto, modal de produto bloqueado, foco ao fechar, 375px e 640px, desktop.
- Vitrine a 375px: banner 16:9, capas 2:3, sem overflow horizontal.
- Ação do modal: fundo rgb(255,213,61), texto rgb(23,23,23); tema arquitetura transmitido pelo contexto, sem tema no body.
- Outra loja: botão rgb(225,29,46), texto rgb(245,245,245), body rgb(11,11,12), zero elementos com tema arquitetura e zero imagens do tema.
- Revisão independente: corrigidas a prioridade da capa cadastrada como fallback de banner e a resolução de slugs coincidentes com propriedades de Object. Testes falharam antes e passaram depois das correções.
- Corrigida largura do hero limitada pela interação entre aspect-ratio e max-height; width:100% mantém a largura original.

## Limites

QA visual autenticado executado em desenvolvimento local. Build de produção validado separadamente. Nenhuma migração ou alteração no banco de produção. A publicação posterior autorizada está registrada abaixo.

Prévia local: http://127.0.0.1:3105/arquitetura. Dados e sessão fictícios; não representa os acessos de clientes reais. Worktree mantido enquanto a prévia estiver aberta.

## Publicação autorizada — 22/09/2026

- Commit publicado: a456e18, enviado por push normal de main ao repositório já conectado à Vercel. Sem force-push, alterações de DNS ou variáveis de produção.
- Loja confirmada por consulta somente leitura: Arquitetura, slug arquitetura, ID 8e2a9eb3-8b06-4b8b-9d98-bac3c9d0b234.
- Endereço: https://area-de-membros-taupe.vercel.app/arquitetura.
- Login de arquitetura retornou HTTP 200 com data-member-theme="arquitetura" e a nova apresentação. Conferido visualmente no navegador de produção.
- hero.webp, atlas.webp e bonus.webp retornaram HTTP 200; SHA-256 de cada resposta coincide com o arquivo local aprovado.
- A rota /arquitetura sem sessão segue redirecionando ao login (307).
- /admin/entrar retornou HTTP 200 sem o atributo de tema nem o novo título. O tema permanece restrito ao slug exato arquitetura; os testes anteriores verificaram outra loja sem alterações visuais.
- Não houve novo login de aluno nem navegação autenticada em produção nesta etapa; catálogo, produto e modal haviam sido validados com fixture local. Não foram modificados clientes, compras ou permissões.

## Domínio oficial — 22/09/2026

- Endereço autorizado: https://members.grupoelevamax.com/arquitetura.
- Domínio conectado ao ambiente Production do projeto Vercel existente `area-de-membros-`.
- Cloudflare: criado somente CNAME `members` → `514df50633f09a6b.vercel-dns-016.com`, TTL Auto, Somente DNS, conforme recomendação exibida pela Vercel. Os seis registros anteriores, incluindo raiz, www e e-mail, foram preservados.
- `APP_URL` atualizado para `https://members.grupoelevamax.com` nos ambientes já associados à variável (Production e Preview). O `.env.local` continua apontando para localhost.
- Redeploy do mesmo commit `a456e18`: `dpl_DgK9NDnuKysPavigL6L2dmxPqM3T`, estado Ready, domínio atribuído. Painel: https://vercel.com/rendermax/area-de-membros-/DgK9NDnuKysPavigL6L2dmxPqM3T.
- DNS confirmado em 1.1.1.1 e 8.8.8.8. Durante a verificação, o resolvedor padrão local ainda mantinha resposta negativa; a checagem HTTPS utilizou resolução pública em 1.1.1.1 com validação TLS normal, sem ignorar certificados.
- Certificado TLS autorizado, SAN `members.grupoelevamax.com`, validade até 21/12/2026, emitido e gerenciado pela Vercel.
- Novo domínio: `/arquitetura` sem sessão retorna 307 para `/arquitetura/entrar`; login retorna 200 com o tema arquitetura; `/admin/entrar` retorna 200 sem esse tema.
- As três artes do tema retornaram 200 no novo domínio, com SHA-256 igual aos arquivos locais aprovados.
- Nenhum e-mail de teste enviado e nenhuma compra, permissão ou cliente alterado. Propagação do DNS pode variar entre redes.
