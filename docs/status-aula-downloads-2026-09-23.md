# UX de aulas, downloads e links — 23/09/2026

Implementado na pasta original, sem commit, push ou deploy. Preservadas as mudanças anteriores, inclusive upload direto ao Supabase.

## Comportamento

- Capa do produto abre sua página interna, com arquivos e links agrupados por módulo. Vídeos mantêm suas capas e player.
- Páginas de item de todos os tipos permanecem dentro da área de membros, com navegação entre itens e materiais do módulo.
- Linhas mostram nome do material, ícone e ação Baixar/Abrir link. Ícone de download move 2 px no hover/foco em 200 ms; reduced motion remove o movimento.
- Rota `/[loja]/item/[id]/abrir` exige sessão, compra, mesma loja e conteúdo publicado antes de registrar acesso e redirecionar. Nenhum arquivo passa pelo servidor do Next/Vercel.
- Arquivos do bucket público `arquivos` na origem Supabase configurada recebem `?download`, iniciando download. URLs externas mantêm seus parâmetros; itens Link externo abrem nova aba.
- Admin mantém os campos e upload; orientações deixam claros o nome visível, Arquivo para download e Link externo para Drive/sites/versões editáveis. Recursos da mesma aula/produto usam o mesmo módulo.
- Tema padrão e identidade Arquitetura preservados, sem novas fontes, dependências, schema ou migrações.

## Arquivos desta entrega

Novos:

- `src/lib/content/resource.ts`
- `src/app/[loja]/item/[id]/abrir/route.ts`
- `src/components/membros/resource-list.tsx`
- `tests/membros/resources.test.ts`
- `tests/membros/resource-open.test.ts`

Alterados:

- `src/components/membros/episode-card.tsx`
- `src/app/[loja]/produto/[slug]/page.tsx`
- `src/app/[loja]/item/[id]/page.tsx`
- `src/app/admin/(painel)/produtos/item-fields.tsx`
- `src/app/admin/(painel)/produtos/content-editor.tsx`
- `tests/membros/content-routes.test.ts`
- `tests/admin/item-upload-ui.test.ts`

Plano em `docs/superpowers/plans/2026-09-23-aula-downloads.md`.

## RED/GREEN e verificações

RED antes de implementar: página de produto sem seção de downloads, item arquivo ainda redirecionava externamente, helper/rota ausentes, admin sem as orientações. Casos de seção vazia também falharam antes da correção. GREEN focado final: 38 testes em quatro arquivos.

Browser RED: título com 113 caracteres sem espaços gerava largura 1579 px em viewport 390 px; corrigido para 390 px. Axe detectou três falhas de contraste nos rótulos das ações; corrigidas mantendo a cor de destaque nos ícones. Rechecagem da lista: zero violações nos dois temas. Revisão independente aprovada após essas correções.

Na pasta original, após integração e `npx next typegen`:

```text
npm test            → 59 arquivos, 472 testes aprovados; exit 0
npx tsc --noEmit    → sem saída/sem erros; exit 0
npm run lint       → 0 erros, 1 aviso preexistente; exit 0
```

Aviso lint: `scripts/trocar-admin-e-aluno.mjs:20:15`, variável `loja` não usada. Arquivo não alterado. Vitest conserva aviso preexistente sobre futura configuração nativa do Vite.

## Agent-browser da Vercel 0.38.1

Next real com fixture local de Supabase Auth/REST/Storage, sem clientes ou dados de produção:

- Clique na capa da vitrine abriu a página interna com lista de materiais.
- Clique normal em Baixar salvou PDF de 601 bytes; SHA-256 do download idêntico ao arquivo da fixture. Página de conteúdo permaneceu aberta. A fixture confirmou registro de acesso antes do GET do arquivo com Content-Disposition attachment.
- Comando específico `agent-browser download` cancelou a captura no ambiente Windows; uma sessão com pasta explícita e clique normal salvou o arquivo corretamente. Não foi necessária alteração no app para isso.
- Link externo abriu nova aba mantendo `?origem=qa`.
- Rota direta para item de outra loja respondeu 404.
- Mobile 390 px e desktop verificados; nomes extensos quebram linha sem overflow.
- Hover: translate `0px 2px`, duração `0.2s`; reduced-motion: translate `none`, duração `0s`.
- Paleta/arte de Arquitetura e loja padrão verificadas separadamente. Lista passou no axe em ambas.

## Limites

Download automático em produção depende da resposta do servidor que hospeda o arquivo. Para o Supabase público, foi usada a opção documentada em [Serving assets from Storage](https://supabase.com/docs/guides/storage/serving/downloads). Links de Drive e outros serviços preservam as regras desses serviços; não há tentativa de contornar autenticação nem converter URLs arbitrárias.

O Storage real e reprodução remota de vídeo não foram exercitados; a integração/local, permissões e renderização do player estão cobertas pelos testes. Nenhuma publicação foi feita.
