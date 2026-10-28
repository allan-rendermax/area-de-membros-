# Meus materiais — design aprovado

O usuário aprovou em 28/10/2026 o piloto `artifacts/piloto-meus-materiais-20261028` e autorizou implementação, testes, backup e publicação, com decisão autônoma do plano e execução por subagentes. Mudança delimitada ao fluxo de biblioteca existente, com plano escrito por solicitação expressa.

## Resultado

Na biblioteca agrupada, uma única seção **MEUS MATERIAIS** mostra o produto principal seguido pelas capas dos complementos adquiridos. Cada capa abre o próprio produto. Remover a seção Continuar, o título Tudo pronto para você criar e o cabeçalho intermediário Explore outros produtos; as categorias vêm imediatamente abaixo da biblioteca. Manter banner, proporção das capas, carrosséis, links e proteção de acesso existentes.

Aplicar genericamente a todos os produtos principais e seus vínculos cadastrados; não codificar produtos específicos. Complemento comprado avulso continua visível. Complementos compartilhados aparecem uma vez, respeitando a projeção existente. Falha na leitura de relações não pode esconder compras.

## Restrições globais

- Trabalhar a partir da produção e189232843f47771476fd77c231152e5606cbe5b em branch isolada.
- Salvar backup antes de modificar código; registrar deployment anterior e rollback antes de publicar.
- Usar `catalogVisibility` e vínculos existentes; não alterar pedidos, liberações, Payt, esquema ou credenciais de clientes.
- Os três produtos Kit Captação e Atendimento de Clientes, Orçamento de Obras na Prática e Kit Gestão de Obras permanecem com `catalog_visibility=catalog` e categoria Prática Profissional.
- Os nove demais order bumps atuais permanecem com `catalog_visibility=contextual`; não aparecem no catálogo geral.
- Preservar o comportamento de descoberta existente: produtos já adquiridos ficam em Meus materiais; ofertas não adquiridas aparecem nas categorias conforme sua configuração.
- Aplicar a todas as frentes da loja em modo agrupado; lojas no modo legado mantêm a interface atual.
- Testar frontend com Vercel agent-browser em desktop e mobile, sem compras, e-mails ou alterações em clientes reais.

Consulta de leitura ao banco em 28/10 confirmou que as configurações dos 12 bumps já correspondem às restrições. Nenhuma atualização de banco é necessária.

## Validação e entrega

Cobrir links independentes, ausência de lista expansível, preservação de prévia, compras avulsas, agrupamento sem duplicatas, todos os produtos principais, seções removidas e visibilidade por configuração. Executar testes focados, suíte, lint, TypeScript/build e revisão independente. Validar interface real em prévia administrativa autenticada e proteger páginas sem sessão. Publicar somente o commit revisto e verificar deployment READY, domínio e interface após publicação.
