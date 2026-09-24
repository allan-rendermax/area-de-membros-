# Task 3 — área de membros e downloads

## Entrega

- As páginas de produto e item consultam o nível concedido. O Básico vê título e quantidade dos módulos Completo bloqueados, sem títulos de itens, URLs, embeds ou links de navegação desses módulos.
- Item extra aberto diretamente redireciona para o produto com aviso antes de registrar acesso. A rota `/abrir` aplica a mesma autorização antes de resolver o destino.
- O produto mostra o badge de acesso. O checkout de upgrade aparece apenas para Básico com extras publicados e URL HTTP(S) válida. Sem checkout, orienta contato com suporte. “Já paguei, atualizar acesso” faz uma navegação normal para recarregar a permissão no servidor.
- Arquivos do bucket privado recebem URL assinada por 60 segundos com `download: true`, somente após autorização. Referência privada com query/hash ou assinatura falha encerra sem registrar clique ou redirecionar. Links externos e arquivos públicos legados seguem o fluxo anterior.

## Verificação

- Testes novos de bloqueio na página, navegação, acesso direto, assinatura autorizada/falha e referência privada inválida passaram em RED/GREEN.
- `npm test`: 74 arquivos, 618 testes passaram.
- `npx tsc --noEmit`: passou.
- `npm run lint`: 0 erros; aviso preexistente de variável não usada em `scripts/trocar-admin-e-aluno.mjs`.
- `git diff --check`: sem problemas de whitespace; avisos de normalização LF/CRLF do Git.

Sem alterações de produção, push ou deploy.
