# Complementos contextuais na área de membros — especificação

Data: 24/10/2026. Estado: especificação aprovada pelo usuário, incluindo capas 2:3 nas fileiras e 1:1 nas ofertas; implementação e publicação não iniciadas.

## 1. Objetivo e entendimento aprovado

Organizar a área de membros de Arquitetura para crescer com vários produtos principais e seus complementos, preservando a aparência Netflix existente. O comprador deve encontrar rapidamente tudo que adquiriu e continuar descobrindo outros produtos principais. As ofertas dos complementos aparecem somente dentro do respectivo produto principal. Compra avulsa é permitida e não depende de possuir o principal para acessar o material pago.

O usuário aprovou a segunda versão do piloto, com banner original, capas verticais e carrosséis horizontais. Rejeitou a primeira versão com cartões horizontais e grade de mockups. A referência é `artifacts/piloto-complementos-20261024/index.html` com `netflix.css`, `netflix.js` e capturas em `netflix-screenshots/`. `screenshots/` documenta a versão rejeitada e não serve como referência.

O piloto é demonstrativo: titularidade, ofertas e cliques simulados não comprovam integração ou entrega reais. Seus scripts não devem ser incorporados à aplicação. Reimplementar o comportamento aprovado com os componentes e verificações de acesso do projeto.

## 2. Escopo inicial

| Principal | Complementos desta implantação |
|---|---|
| Atlas Visual de Paisagismo Tropical | Guia da Planta Certa para Jardins Tropicais; Orçamento de Jardins na Prática; Biblioteca Visual dos Mestres do Paisagismo |
| Atlas Visual das Patologias na Construção Civil | Kit Gestão de Obras; Orçamento de Obras na Prática; Kit Captação e Atendimento de Clientes |

Os seis complementos permanecem produtos independentes, com conteúdo, checkout, pedidos, acesso e endereço próprios. A associação é editorial, não uma nova forma de conceder acesso.

O Protocolo Anti-Retrabalho é um upsell já associado a Patologias pelo vínculo singular existente. Não integra os três order bumps. Preservar seu cadastro, acesso e comportamento comercial atual; não removê-lo ou migrá-lo implicitamente. A página de Patologias pode continuar exibindo esse upsell além dos três complementos. O piloto focou os bumps e não representa a retirada do Protocolo.

Fora do escopo: reformulação de outros produtos, revisão de preços, alteração de planos Payt existentes, novo motor de autorização, recomendações automáticas, disparos promocionais, redesign de login/admin e reorganização automática de outras lojas.

## 3. Experiência da página inicial

Preservar o hero atual, suas artes, identidade escura, Barlow Condensed, laranja/amarelo, capas 2:3, fileiras com rolagem horizontal e setas de navegação já corrigidas. Não substituir o catálogo por uma grade de cartões comerciais.

### Meus materiais

- Exibir produtos publicados aos quais o cliente tem acesso, agrupando somente os complementos configurados neste modelo.
- Um principal adquirido ocupa uma capa. Logo abaixo, mostrar um controle discreto como “2 complementos adquiridos”, somente quando houver complementos adquiridos e publicados.
- Esse controle expande links com os títulos completos. Cada link abre diretamente o material correspondente. Não incluir ofertas de não adquiridos nessa expansão.
- Um complemento adquirido sem principal elegível adquirido aparece com capa própria e acesso direto. Não exigir que o cliente compre o principal.
- Se posteriormente adquirir o principal, agrupar o complemento sob ele; manter URLs e links recebidos por e-mail válidos.
- Se perder o acesso ao principal, mas ainda possuir o complemento por compra válida, o complemento volta a ter capa própria. Não alterar o direito de acesso por causa do agrupamento.
- Contagens consideram somente complementos efetivamente acessíveis e publicados, nunca o total à venda.

### Descoberta e continuidade

- “Explore outros produtos” conserva as trilhas editoriais existentes, como Atlas Visuais e Softwares e IA. Não limitar o catálogo aos exemplos do piloto.
- Produtos com visibilidade contextual não aparecem como ofertas em nenhuma trilha geral, hero comercial ou recomendação da home.
- Produtos adquiridos não precisam ser repetidos na descoberta. Preservar regras explícitas do vínculo legado Atlas → Protocolo como exceção de compatibilidade, sem estendê-las aos seis bumps.
- Preservar “Continuar” quando houver histórico. Para um complemento agrupado, o atalho pode usar a capa do principal, com o título do material retomado e URL direta do último item autorizado. Deduplicar por grupo. Avulso continua com sua capa. Nunca transformar um produto não adquirido em acesso de continuidade.
- Produto sem compra e sem histórico não cria fileira vazia. Nenhuma compra liberada mantém o estado de orientação e suporte existente, seguido da descoberta dos principais.

### Complemento associado a vários principais

A associação deve permitir reutilização. Dentro de cada principal adquirido, listar o complemento relacionado. Na home, escolher um único agrupador: primeiro principal publicado e adquirido pela ordem editorial (`sort_order`, desempate por ID). Sem agrupador elegível, mostrar avulso. Essa regra evita duplicar a mesma compra na biblioteca e independe da ordem de consulta.

## 4. Página do principal e página do complemento

No principal, a ordem é:

1. Cabeçalho com identificação, nível real de acesso e ação para os materiais adquiridos.
2. Conteúdo do produto e bônus incluídos na compra.
3. Fileira “Seus complementos”, somente com os adquiridos.
4. Fileira “Complemente seu material”, somente com complementos opcionais ainda não adquiridos e publicados.

As fileiras internas também usam capas verticais. Exibir “Adquirido” ou “Vendido separadamente” fora da arte. Não sobrepor CTAs ao título da capa no hover. Preservar foco visível e realce discreto.

O produto Básico mostra o que seu nível permite e mantém a experiência existente de upgrade. Não usar os textos “Completo” ou “bônus incluídos” do piloto indiscriminadamente. O produto Completo continua significando somente seu pacote contratado: bumps não passam a integrar os bônus por associação visual.

Complementos opcionais são acessíveis à descoberta contextual para compradores de qualquer nível válido do principal. Seus arquivos só são liberados pela compra correspondente.

“Conhecer complemento” apresenta a oferta dentro do contexto do principal, com imagem quadrada, descrição, itens prometidos confirmados e checkout cadastrado. Usar `student_checkout_url` válido quando existir; caso contrário, `checkout_url`. Ausência de checkout válido resulta em informação de indisponibilidade, sem botão quebrado ou concessão de acesso.

Após confirmação real da compra e atualização dos acessos, o produto sai das ofertas e entra nos adquiridos. Não liberar por retorno do checkout, parâmetro de URL ou clique de botão. Pagamento pendente mostra orientação para atualizar/conferir ou suporte; não exibir sucesso antecipado. Não requer integração de pagamento em tempo real nova nesta entrega.

A página própria do complemento mantém seus arquivos e endereço atuais. O botão voltar leva ao principal quando ele for elegível para o cliente; caso contrário, leva a Meus materiais. Não apresentar outras ofertas de complementos na página do avulso. O aluno não vê o termo técnico “order bump”.

Aplicar a composição também à página de item: o fluxo atual de produto pode renderizar diretamente `item-content.tsx`. A experiência não pode depender apenas do fallback de produto sem itens.

## 5. Capas e imagens comerciais

**Decisão aprovada pelo usuário:** capas verticais 2:3 nas fileiras; imagens quadradas 1:1 nos detalhes comerciais e checkout.

| Uso | Formato | Campo existente |
|---|---|---|
| Meus materiais, avulso e fileiras internas | 2:3 | `cover_url` |
| Detalhes da oferta / modal de compra | 1:1 | `purchase_image_url` |
| Hero global | Arte atual, recorte atual | Tema existente |

O comparativo `artifacts/piloto-complementos-20261024/comparacao-capas.html` usa as imagens existentes de Patologias. O quadrado reduz a altura da fileira, mas muda sua leitura para uma vitrine de pacotes. Usar 2:3 preserva o estilo aprovado e a identidade do mesmo material quando aparece avulso. Não misturar proporções na mesma fileira, esticar imagens ou cortar um mockup quadrado para preencher 2:3.

### Produção das novas artes

- Produzir seis capas editoriais verticais: uma para cada complemento da tabela de escopo. As capas tipográficas provisórias de Paisagismo do piloto não são finais.
- Usar título literal do cadastro, sem Básico/Completo, preços, descontos, contagens, certificações ou promessas não confirmadas.
- Mesma família visual dos Atlas: campo azul-marinho para título condensado, branco, laranja e diagonal amarela discretos; cena/objetos pertinentes e legíveis. Não copiar a patologia de uma capa para outros temas.
- Guia da Planta Certa: seleção de espécies e jardim tropical; Orçamento de Jardins: planejamento e orçamento de implantação; Mestres do Paisagismo: composição de jardins e linguagem de projeto, sem inventar retratos ou autoria de uma obra específica.
- Gestão de Obras: cronograma, acompanhamento e obra; Orçamento de Obras: quantitativos e planejamento; Captação e Atendimento: briefing, proposta e atendimento profissional. Texto secundário em interfaces/planilhas ilustradas não deve simular dados reais.
- Arquivo final 1000 × 1500 ou 1024 × 1536, WebP, abaixo de 2 MiB; meta de até aproximadamente 500 KB quando a legibilidade permitir. Revisar título, acentos, margens e leitura em miniaturas de 150–200 px.
- Guardar originais, versão otimizada e relatório fora das pastas importáveis; preservar capas existentes. Não mudar o hero.
- Para 1:1, reaproveitar os mockups de Patologias quando coerentes com o conteúdo atual. Produzir imagens 1024 × 1024 para Paisagismo quando ausentes, depois de confirmar os entregáveis. Não exigir doze novas imagens se três quadradas já atendem.
- A geração é uma etapa de produção de arte posterior; esta especificação e o comparativo não afirmam que as seis novas imagens já foram geradas ou aprovadas. Substituição no catálogo somente com os arquivos finais revisados.

## 6. Modelo de dados e configuração

Adicionar estrutura própria para os múltiplos complementos contextuais, mantendo o campo singular legado:

- `product_complements`: `store_id`, `parent_product_id`, `complement_product_id`, `sort_order`. Par único por loja; chaves estrangeiras compostas garantem mesma loja. Impedir autorreferência, duplicatas e cadeias/ciclos: nesta versão um principal contextual não pode ser alvo contextual. Relação muitos-para-muitos, sem limite fixo de três.
- `products.catalog_visibility`: `catalog` ou `contextual`, padrão `catalog`. A visibilidade editorial não modifica autorização. Para esta implantação, somente os seis bumps ficam contextuais. Não derivar essa regra globalmente de `role` e não ocultar todos os upsells.
- `stores.member_library_mode`: `legacy` ou `grouped`, padrão `legacy`. Ativar o modelo agrupado somente na loja alvo após validar cadastros. Outras lojas conservam sua experiência. O isolamento não depende de nome de produto fixado no código.

O vínculo legado `complementary_product_id` e seu importador continuam operacionais. Se um mesmo par estiver presente nas duas estruturas, não renderizar duas chamadas; preferir a associação contextual para o par explicitamente configurado. Não criar esse conflito durante a ativação inicial e não migrar vínculos legados automaticamente.

No admin, permitir selecionar/remover/reordenar vários complementos da mesma loja, configurar visibilidade e pré-visualizar os estados de compra. Avisar quando um produto contextual não tem principal publicado; quem já possui continua acessando-o como avulso. Publicar oferta contextual sem principal não deve fazer o produto aparecer automaticamente no catálogo geral.

Salvar produto e lista de relações atomicamente, validando referências e concorrência para evitar substituição silenciosa de uma edição mais recente. Remover relação não exclui produto nem conteúdo. Exclusão de principal remove apenas suas relações; o complemento adquirido permanece avulso. Exclusões continuam seguindo as proteções existentes de produtos com compras.

O cadastrador por pasta aceita `complementos: slug-a, slug-b, slug-c` em ordem editorial e `visibilidade_catalogo: catalogo|contextual`. Omitir cada chave preserva seu valor; `complementos: nenhum` limpa somente a nova lista. Chave singular `complemento:` mantém sua semântica legada. Rejeitar duplicatas e vínculos inválidos antes de uploads/escritas. Alvos devem existir; usar cadastro em duas etapas quando ambos forem novos, sem fingir suporte a importação arbitrária em lote.

Carregar relações por loja em lote, junto ao catálogo e aos direitos do cliente. Separar as funções puras que montam biblioteca/ofertas das consultas e componentes. Evitar uma consulta de acesso por capa. Aplicar as mesmas regras na home, produto, item, prévia e links diretos.

## 7. Acesso, Payt e compatibilidade

- Direitos continuam calculados pelo fluxo autenticado de pedidos/ofertas em vigor. Relação editorial e `catalog_visibility` nunca concedem acesso nem substituem validação de módulo/item/download.
- Compra avulsa e compra como bump concedem acesso ao mesmo produto quando seus identificadores comerciais estiverem corretamente associados. Não criar cópias do conteúdo por canal de venda.
- Preservar os códigos legados e os códigos de bumps já regularizados de Patologias. O registro de 26/09 relaciona Gestão `47ZEA3`/`LYZDA4`, Captação `LJANBP`/`RDG68R` e Orçamento `RK3NAB`/`RB67ER`; são referências históricas a conferir, não instrução para sobrescrever produção.
- Para Paisagismo, confirmar produto, código de bump, checkout avulso e identificadores presentes nos eventos autenticados antes de ativar liberações. Não inferir por título, valor, UTM ou código do principal. Não inventar códigos na especificação.
- Não migrar automaticamente os planos atuais para identificação por checkout. A diretriz permanente registra intenção futura; o relatório de publicação de Paisagismo descreve uma versão mais recente que este checkout local. O plano de implementação deve partir da versão publicada e reconciliar essa diferença antes de alterar a aplicação.
- Reembolso do principal não elimina uma compra válida do complemento; reembolso do complemento não elimina o principal. Compras válidas adicionais prevalecem conforme as regras existentes. Cliente bloqueado continua bloqueado.
- Links antigos de materiais permanecem válidos para quem possui acesso. Para `?comprar=<complemento-contextual>` sem acesso: se possuir um principal elegível, direcionar à oferta dentro dele; senão, voltar à biblioteca com mensagem de material não liberado e suporte, sem oferta de bump na home. A compra avulsa continua disponível pelos checkouts externos existentes.
- Não enviar campanhas ou reprocessar eventos históricos como efeito de organizar a vitrine. Eventuais compras de Paisagismo ainda sem entrega devem ser auditadas e regularizadas explicitamente no trabalho de publicação, com comparação de acesso antes/depois e sem mensagens duplicadas.

## 8. Conteúdo real e condições para publicação

A organização visual pode ser desenvolvida com fixtures, mas publicar cada complemento exige conferir seu material real. As pastas locais de Paisagismo mostram o Guia da Planta Certa e arquivos de Orçamento de Jardins. Para Mestres existem uma pasta `02 - Biblioteca...` com nota de produção em andamento e uma pasta `03 - Biblioteca...` sem arquivos na inspeção desta sessão. Isso não prova ausência em outro local; impede afirmar que o PDF final já foi verificado.

Antes de publicar: localizar a versão final de cada entrega, conferir título e promessa, validar/otimizar PDFs conforme `docs/diretrizes-da-plataforma.md` e skill `otimizar-pdfs`, conferir planilhas/documentos, destino específico da pasta e permissão de acesso. Não apontar para a raiz compartilhada que contém outros produtos. Preservar a convenção dos pacotes atuais; não transformar o Completo em um pacote que inclui bumps.

Se um complemento ainda não estiver pronto, manter rascunho fora das ofertas e registrar o bloqueio de publicação. Caso existam compradores pagos, tratar sua entrega como pendência operacional explícita; não aparentar que a liberação foi concluída por mostrar uma capa.

## 9. Erros e estados

| Situação | Resposta esperada |
|---|---|
| Relação ausente, removida ou principal indisponível | Complemento pago publicado aparece avulso |
| Complemento rascunho/não publicado | Não ofertar nem contar como disponível; manter regras atuais de publicação de conteúdo |
| Checkout inválido/ausente | Exibir indisponibilidade; nunca link vazio |
| Falha ao carregar relações | Preservar acesso às compras via lista avulsa; omitir ofertas contextuais até recuperar |
| Falha ao carregar autorização | Não presumir propriedade; mostrar erro recuperável e suporte |
| Capa ausente/erro de imagem | Fallback existente com título; não esconder o produto |
| Todos os complementos adquiridos | Omitir fileira de ofertas e seus espaços vazios |
| Nenhum complemento adquirido | Omitir contagem/expansão e fileira adquirida |

No celular, manter rolagem nativa das fileiras e links alcançáveis sem hover. Teclado opera expansão e navegação; foco permanece previsível ao abrir/fechar detalhes. Respeitar redução de movimento. Evitar títulos cortados sem alternativa legível e overlays sobre textos das capas.

## 10. Critérios de aceite e verificação

1. Comparação visual com a segunda versão aprovada em desktop 1440px e celular 390px; teste de largura mínima 320px. Banner, capas 2:3 e carrosséis preservados.
2. Principal Básico/Completo com zero, um e três bumps: conteúdo correto, contagem correta, compras visíveis e nenhuma recompra ofertada.
3. Avulso sem principal abre diretamente por capa, URL de produto, item e link de e-mail; download continua autorizado pelo próprio produto.
4. Adquirir principal agrupa sem duplicar; perder principal devolve avulso; reembolso de um item não remove os demais direitos válidos.
5. Bump não adquirido não aparece em home, trilhas gerais, hero ou continuidade; sua oferta aparece somente dentro de principal adquirido e associado.
6. Complemento compartilhado entre dois principais tem agrupamento determinístico na home e acesso coerente dentro de ambos.
7. Admin/importador validam mesma loja, duplicatas, autorreferência, ciclos, ordem, preservação por omissão e limpeza explícita; rollback atômico em falha.
8. Compatibilidade de Protocolo, upgrades, modo `versions`, prévias, links antigos, conteúdo não publicado e bloqueio do cliente.
9. Nenhuma mudança em pedidos, planos, valores, permissões de outras lojas ou conteúdo atual por efeito da migração de apresentação.
10. Testar compra avulsa e linha de bump com payloads autenticados/fixtures representativos do fluxo real; nenhum pagamento fictício em produção.
11. Conferir capas finais em miniatura, proporção, texto e bytes; 1:1 em `purchase_image_url` nunca substitui involuntariamente a capa 2:3.
12. Testes unitários da montagem de biblioteca e seleção de ofertas; integração do banco/admin/importador; navegação real dos fluxos prioritários. Executar verificações existentes pertinentes sem espelhar detalhes internos em testes frágeis.

## 11. Aplicação e reversão

Depois da aprovação desta especificação, produzir plano de implementação sobre uma base compatível com a versão publicada, lendo a documentação local do Next antes de escrever código. O workspace atual tem muitas alterações preexistentes; não embuti-las implicitamente na entrega.

Entregar migração aditiva com defaults compatíveis, configuração/admin/importador, projeção de biblioteca, composição visual e verificações. A migração não cadastra nomes comerciais fixos como regra global.

Antes da ativação, capturar configuração dos dois principais e seis complementos, relações legadas, imagens e visibilidade. Preparar/verificar materiais e regras comerciais dos novos bumps; configurar as associações por cadastro. Ativar o modo agrupado somente na loja alvo após os testes e prontidão dos produtos.

Reversão visual: restaurar configuração de modo da loja, visibilidade e relações da fotografia anterior; restaurar URLs de imagens se trocadas. Não apagar novos produtos já vendidos, seus conteúdos ou pedidos. A reversão não retira compras legítimas nem exige desfazer a migração aditiva.

## 12. Fontes e status de aprovação

- Diretriz permanente: `docs/diretrizes-da-plataforma.md`.
- Referência aprovada: `artifacts/piloto-complementos-20261024/netflix-screenshots/` e `revisao-netflix.md`.
- Comparação de formatos: `artifacts/piloto-complementos-20261024/comparacao-capas.html`.
- Estado técnico inspecionado: `src/lib/access/access.ts`, `product-complement.ts`, `src/lib/data/products-admin.ts`, `src/components/membros/item-content.tsx`, admin/importador e migration de complemento singular.
- Registros históricos: `docs/status-regularizacao-orderbumps-2026-09-26.md`, `docs/status-implementacao-atlas-protocolo-2026-10-21.md`, relatório de publicação de Paisagismo em `artifacts/publicacao/atlas-visual-de-paisagismo-tropical/20261023/RELATORIO.md`.

O visual, a organização e esta especificação foram aprovados na conversa em 24/10/2026: “Aprovado, pode seguir com o plano de implementação mantendo esse visual Netflix e as capas 2:3 nas fileiras e 1:1 nas ofertas.” O plano correspondente está em `docs/superpowers/plans/2026-10-24-complementos-contextuais-netflix.md`. A aprovação autoriza preparar o plano; sua execução e a publicação ainda não foram iniciadas.
