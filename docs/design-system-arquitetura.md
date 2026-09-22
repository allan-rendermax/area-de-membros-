# Design system — Arquitetura

Direção aprovada em 22/09/2026: energia, alegria e recursos práticos de arquitetura. Base no segundo piloto (laranja vivo, amarelo, fotografia rica e títulos fortes). Aplicação exclusiva à loja cujo slug é `arquitetura`.

## Identidade

| Token | Valor | Aplicação |
| --- | --- | --- |
| Fundo | #111214 | Navegação, páginas, contraste com as capas |
| Superfície | #1C2024 | Formulários, menus e diálogos |
| Superfície elevada | #272D33 | Hover, seleção e controles secundários |
| Borda | #434B54 | Campos e separadores funcionais |
| Texto | #F8F9FA | Leitura principal |
| Texto secundário | #BDC5CF | Metadados, descrições |
| Marca | #FF5A16 | Assinatura visual e destaques |
| Ação | #FFD53D | Ação principal com texto #171717 |
| Ação hover | #FFE477 | Hover da ação principal |
| Erro | #FFB4AB sobre #381A19 | Mensagens de falha, sem confundir com marca |

Barlow Condensed 700/800 para títulos de impacto; Inter existente para interface e leitura. Títulos fortes com caixa alta somente no banner e nas artes. Botões com verbo explícito. Foco visível amarelo; links de texto com sublinhado quando necessário. Estados não dependem apenas da cor. Redução de movimento respeitada.

## Dimensões preservadas

- Pôster 2:3, arte 1000 × 1500; largura 40% mobile, 26% small, 20% medium, 15% desktop.
- Banner 21:9 desktop / 16:9 mobile; limite atual de altura mantido.
- Itens 16:9; mesma grade, espaçamento e navegação de conteúdos existentes.
- Textos reais em HTML, sem texto de interface embutido no banner.

## Imagens

Hero fotográfico com casa contemporânea, plantas e pôr do sol laranja. Capas dedicadas ao Atlas Visual das Patologias e Bônus do Atlas. São artes ilustrativas; os arquivos entregues, produtos, módulos e direitos de acesso existentes não mudam.

Arquivos públicos em `public/themes/arquitetura/`, WebP. Imagem cadastrada no painel sempre tem prioridade sobre os padrões do tema. As duas capas padrão são associadas a slugs exatos e somente dentro de arquitetura. Produtos futuros recebem composição automática temática até terem imagem própria.

Prioridade de banner: banner cadastrado → capa cadastrada → hero padrão. Prioridade de pôster: capa cadastrada → arte do slug conhecido → composição automática.

Artes criadas com a ferramenta integrada ImageGen, sem dependência de serviço externo em execução. Prompts e origem registrados em [arquitetura-artes.md](arquitetura-artes.md).

## Componentes e isolamento

Tema aplicado por `data-member-theme="arquitetura"` no layout da loja. Tokens globais conservam exatamente os valores padrão como fallback. Nenhum estilo global de body é trocado. Portais de modais recebem o tema via contexto React, inclusive ajuda de instalação e oferta bloqueada.

Início: hero de marca + acervo real organizado por trilha; nenhum curso fictício ou percentual inventado. Produto: banner próprio ou padrão + módulos reais. Login: mesma autenticação, nova apresentação. Itens, conta, suporte, instalação e ofertas conservam seus fluxos.

## Validação

Testar resolução por slug exato, outras lojas, prioridade de arte cadastrada, portais, contraste de textos/ações, navegação entre temas e responsividade. Rodar Vitest, TypeScript, ESLint e build. Prévia local com dados sintéticos isolados, sem modificar banco de produção.
