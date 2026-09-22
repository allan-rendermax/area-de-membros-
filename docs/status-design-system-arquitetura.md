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

QA visual executado em desenvolvimento local. Build de produção validado separadamente. Nenhuma migração ou alteração no banco de produção. Nenhuma publicação realizada nesta tarefa.

Prévia local: http://127.0.0.1:3105/arquitetura. Dados e sessão fictícios; não representa os acessos de clientes reais. Worktree mantido enquanto a prévia estiver aberta.
