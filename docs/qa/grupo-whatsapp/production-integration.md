# Integração do grupo do WhatsApp para produção

Integração local concluída em 17/10/2026 na branch `codex/publicar-grupo-whatsapp`, sobre `origin/main` em `d8b58de`. Este registro cobre código e verificações locais; aplicação da migration, publicação e conferência do ambiente real são etapas separadas.

## Escopo e preservação da produção

Foi aplicado somente o delta da funcionalidade entre `c961690` e `81193ff`, sem trazer o snapshot anterior do checkout de desenvolvimento. A aplicação direta encontrou sobreposição de contexto no formulário administrativo e na página de produto; o merge de três vias resolveu ambas sem marcadores de conflito.

A comparação final preserva o contexto de preview editorial/simulação, o registro de visitas no cliente, o `FormError.field`, a remoção de imagem de upgrade e todas as demais melhorias presentes em produção. Os manifests e o lockfile permaneceram sem alterações.

A fixture de QA do grupo reutiliza agora o RPC de login já disponível no provider atualizado, eliminando a interceptação antiga. O plano, a especificação e as evidências visuais da entrega local original foram preservados como histórico; essas capturas não representam uma visita a produção.

## Verificações nesta integração

| Comando | Resultado |
|---|---|
| `npm ci` | Exit 0; instalação a partir do lockfile existente |
| `npm test -- --maxWorkers=2` | Exit 0; **133 arquivos, 1.124 testes aprovados**, 68,14 s |
| `npm run lint` | Exit 0; zero erros e quatro avisos preexistentes |
| `npm run build` | Exit 0; Next.js 16.3.5, compilação, TypeScript e geração concluídos |
| Smoke HTTP da fixture local | Configuração das duas lojas e RPC atual de login aprovados |
| `git diff --check` | Exit 0 |

Testes, lint e build foram executados sequencialmente. O build usou apenas valores sintéticos em variáveis de ambiente, sem credenciais de produção. A única limpeza posterior à suíte completa removeu uma variável desestruturada não usada na fixture, conferida pelo lint e pelo smoke HTTP.

Os quatro avisos do lint são variáveis/imports não usados em `scripts/trocar-admin-e-aluno.mjs`, `src/app/admin/(painel)/produtos/locked-product-fields.tsx`, `src/app/admin/(painel)/produtos/upgrade-fields.tsx` e `tests/membros/content-routes.test.ts`. O Vite mantém o aviso preexistente sobre configuração CommonJS. O `npm ci` reportou oito vulnerabilidades nas dependências existentes (sete altas e uma crítica); dependências não foram alteradas nesta funcionalidade.

## Próxima etapa autorizada

Aplicar a migration aditiva `20261016010000_store_community_whatsapp.sql` antes do deploy, publicar este código integrado e conferir o convite no ambiente real. Não há reenvio automático de mensagens antigas nem mudança nas regras de acesso.
