# Carregamento da área de membros

## Objetivo e autorização

Reduzir a espera no login, vitrine, produto e abertura de conteúdo sem alterar identidade visual, carrosséis ou regras de autorização. O usuário solicitou brainstorming, plano, execução com subagentes, paralelismo quando independente e validação com agent-browser. Autorizou resolver dúvidas e aprovar os documentos autonomamente. Sucesso significa menos consultas/etapas sequenciais e imagens adequadas à tela, comprovados por testes e comparação local antes/depois; não uma promessa de latência da Vercel.

## Diagnóstico

Baseline `5fd77d0`: 248 testes passando. Medição no build de produção local, backend fictício com 100 ms por requisição Auth/REST, três execuções aquecidas após uma primeira: vitrine 546 ms, produto 870 ms, arquivo 977 ms (medianas até receber o corpo completo da resposta). O streaming pode responder 200 com instrução de redirecionamento; estes tempos medem a resposta da rota, não o download externo. Requisições são registradas para separar trabalho real de variação do navegador.

- `requireStoreSession` espera loja antes de iniciar Auth, embora sejam independentes.
- Produto e item usam `loadStoreAccess`, que também busca catálogo completo. Verificar autorização não precisa dele.
- Produto/contexto do item e pedidos/ofertas são lidos em sequência depois de autenticar, embora independentes.
- Contexto do item percorre item → módulo → produto em três requisições.
- Vídeo busca módulos e itens de todo o produto para mostrar apenas irmãos do módulo atual.
- `AutoCover` usa imagens originais e `loading="lazy"` inclusive para a imagem principal; não há tamanhos responsivos.
- Fechar o modal vindo de `?comprar=` usa navegação do router e refaz a vitrine para remover um parâmetro visual.

## Alternativas consideradas

1. **Otimização direcionada, escolhida:** menos consultas e etapas, imagens responsivas e atualização local do endereço no fechamento do modal. Não requer migração, novas dependências de produção nem mudanças operacionais.
2. Cache persistente de permissões ou páginas: pode reduzir mais latência, mas exige invalidação confiável em bloqueios, reembolsos e alterações administrativas. Fora do escopo.
3. Apenas novas telas de espera: já existe skeleton; não reduz a duração do trabalho. Não será o foco.

## Desenho

### Dados e sessão

Executar busca da loja e `auth.getUser()` em paralelo, preservando validação de slug, 404 de loja inexistente, redirecionamento de visitante e signOut de cliente bloqueado. A leitura atual de cliente continua obrigatória em cada requisição protegida.

Adicionar `loadGrantedProductIds(storeId, customer)` para consultar apenas pedidos e vínculos de ofertas. A função recebe o cliente que acabou de ser validado no servidor e não cria cache. Cliente bloqueado retorna conjunto vazio. `loadStoreAccess` mantém compatibilidade com os chamadores por e-mail e aceita também o cliente validado na vitrine. Não filtrar pedidos por `store_id`: pedidos originalmente desconhecidos podem ter loja nula e o código da oferta continua determinando o acesso. Não mudar a semântica de múltiplas compras do mesmo código.

Produto e item carregam contexto e permissões em paralelo após sessão válida. 404 de conteúdo inexistente, oculto ou de outra loja continua prevalecendo antes de avaliar redirecionamento de compra. URLs de arquivos só são usadas depois da autorização.

### Contexto de conteúdo

`getItemWithContext` usa as FKs existentes `items.module_id → modules.id → products.id` em uma consulta PostgREST com projeção explícita. Pai ausente resulta em null e erro do banco continua sendo lançado. A checagem de loja/publicação permanece na rota.

Vídeo busca somente itens publicados do módulo atual, ordenados por `sort_order`, `created_at`; Anterior/Próximo continuam usando esse conjunto. Registro de acesso continua sendo aguardado, após autorização; não se usa prefetch em links de itens, pois essas rotas registram acesso. Fluxos administrativos que precisam de rascunhos continuam inalterados.

### Imagens e modal

Adicionar componente compartilhado de imagem de conteúdo usando `next/image` com `fill`, qualidade padrão 75 e `sizes` adequados ao layout existente. Otimizar somente imagens raster locais de caminho absoluto e imagens HTTPS de `*.supabase.co/storage/v1/object/public/covers/**`, sem query, fragmento, credenciais ou porta. A configuração do otimizador deve corresponder à política do componente. PNG/JPG/JPEG/WebP/AVIF são elegíveis; GIF, SVG, URLs assinadas, fontes externas ou outras pastas mantêm `<img>` direto. Nenhum acesso a service role no cliente.

Hero e banner de produto usam `loading="eager"` e `fetchPriority="high"`; demais capas ficam lazy/async. Preservar proporções, recorte, gradiente de fallback, opacidade, cores, textos e carrosséis. Os fundos de login podem usar o mesmo componente, com sizes considerando painel lateral desktop e viewport mobile. Logos de dimensões intrínsecas ficam inalterados.

Fechamento do modal remove somente `comprar` com `window.history.replaceState`, preservando demais parâmetros, hash, histórico de navegação e integração do Next com `useSearchParams`. Não recarrega dados do servidor. Abertura, Escape, botão Fechar e clique fora continuam funcionais.

## Restrições globais

- Não alterar .env.local, chaves, variáveis da Vercel, DNS, Resend ou dados remotos.
- Não alterar cores, tipografia, carrosséis, proporções ou regras de acesso existentes.
- Não adicionar cache persistente de sessão, cliente, pedidos ou permissões.
- Não adicionar migração nem dependência de produção; a migração de titularidade da sessão anterior continua pendente e independente.
- Não alterar riscos aceitos em docs/conferencia-gpt-cuspidora.md.
- TDD: observar falha da regressão antes de implementar e executar os testes após.
- Antes de concluir: npm test, npx tsc --noEmit, npm run lint, npm run build; commit e push em português.

## Validação e limites

Testes de comportamento de sessão, permissões, isolamento/publicação/registro nas rotas, consultas REST (projeção/relações/ordenação/erros) e HTML de imagens. Para concorrência usar promises controladas, sem limiares frágeis de milissegundos. Testar reembolso/bloqueio entre chamadas para evitar cache acidental, paid+refunded de transações distintas, cliente desconhecido e pedido com loja nula.

agent-browser em build local real, 375×812 e 1440×1000: login, vitrine, produto, arquivo, vídeo, produto bloqueado, item de outra loja e oculto, bloqueio/reembolso, modal, imagens, overflow e erros do navegador. Comparar três medições aquecidas com o mesmo backend/latência e medir bytes das imagens com fixture raster local. Teste de frontend usa dados sintéticos; não confirma latência da Vercel/Supabase em produção, entrega de OTP ou velocidade do provedor de vídeo/download.
