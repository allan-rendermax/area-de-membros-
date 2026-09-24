# Produto único com Básico e Completo — design
Data 2026-09-24. Base e8e91fa, branch codex/niveis-produtos.
O usuário aprovou produto único, Completo = Básico + extras, e delegou planejamento/aprovação/execução sem perguntas.

## Modelo escolhido
Uma linha products, uma capa e um endereço por produto. Básico/Completo são permissões, não novos produtos nem valores de role. role front/orderbump/upsell permanece independente.
AccessLevel = 'basic' | 'complete'. offer_products.grant_level default complete; modules.required_level default basic; products.upgrade_checkout_url nullable.
Grant é o maior nível dos pedidos pagos para códigos vinculados ao produto. Cliente bloqueado não recebe nenhum nível. Complete inclui basic. Reembolso/cancelamento/revogação afeta apenas aquele pedido; outro pedido pago continua concedendo seu nível.
Código de upgrade concede complete como uma compra do Completo. Não há dependência obrigatória de outra compra nem cálculo de diferença de preço na aplicação; o dono configura um checkout próprio para upgrade.
Legado: ofertas atuais continuam liberando tudo, módulos atuais continuam basic, fichas antigas id continuam funcionando.

## Experiência
Vitrine continua com uma única capa por produto e mesmos filtros/ordenação. Dentro do produto, indicar Seu acesso: Básico/Completo; mostrar módulos completos bloqueados para Básico com título e quantidade, sem URLs privadas, embeds ou links de itens.
CTA Desbloquear versão completa aparece somente para Básico com extras publicados e upgrade_checkout_url HTTP(S) configurado. Sem checkout, mensagem de extras bloqueados e suporte, sem link inventado. Completo não recebe CTA. Link Já paguei, atualizar acesso solicita novamente página dinâmica.
Rotas de item e abrir verificam nível antes de renderizar, assinar, redirecionar ou registrar acesso. Básico tentando extra volta ao produto com aviso. Usuário sem produto mantém retorno à vitrine. Anterior/próximo/primeiro conteúdo e sidebar não navegam para itens bloqueados.

## Arquivos
Bucket novo arquivos-restritos privado, criado apenas por migration pronta para aplicação manual. Novos uploads do admin usam esse bucket, com URLs de referência HTTP(S) estáveis, resolvidas no servidor após autorização em links assinados de 60 segundos.
Novo formato de cadastro por níveis envia entregáveis para arquivos-restritos; imagens permanecem públicas em arquivos. Ficha antiga id mantém destino arquivos para compatibilidade.
Módulo marcado complete não pode manter arquivo do bucket público legado arquivos: admin pede reenvio privado. Também recusa salvar novo arquivo público próprio num módulo complete. Links/vídeos externos seguem proteção do provedor, mas app não os revela para Básico.
Não mover/apagar objetos públicos já existentes automaticamente. Links públicos previamente distribuídos só deixam de funcionar se o dono os retirar no provedor; isso fica documentado na conversão do catálogo.

## Administração e ofertas
Produto: URL de checkout para upgrade. Módulo: Incluído no Básico / Exclusivo do Completo. Oferta: por produto selecionado, nível liberado Básico/Completo, default complete preservando legado e bundles.
Nova RPC save_offer_levels_atomic(... p_grants jsonb) valida todos IDs/loja/níveis/código imutável e escreve oferta/vínculos em transação. RPC antiga save_offer_atomic deve preservar grant_level existente ao editar seleção antiga, para não promover Básico silenciosamente.
Editor avisa que mudanças de oferta valem também para compras existentes. Acesso manual escolhe ofertas existentes e herda níveis sem novo fluxo.
Webhook Payt existente continua processando pedidos; níveis são calculados dinamicamente. Não há novo email específico de upgrade neste escopo.

## Cadastrador
Legacy: id: CODE permanece aceito e produz oferta complete; módulos default basic.
Tiered: id_basico obrigatório; id_completo e/ou id_upgrade (ao menos um) obrigatórios; checkout_upgrade obrigatório; id legado é mutuamente exclusivo. Códigos distintos em toda pasta/lote. checkout continua sendo checkout de entrada.
Pasta:
entregaveis/basico/01 Material principal/Guia.pdf
entregaveis/completo/02 Extras/Modelo.zip
Arquivos soltos dentro de basico/completo usam Material básico / Extras do Completo. Também permitir módulos antigos diretos como basic em ficha tiered, com títulos únicos globalmente. links.txt suporta terceira coluna opcional basico|completo, default basico; grupos Conteúdo online / Conteúdo online — Completo. Legacy links duas colunas preservados.
Plano acrescenta ofertas:[{codigo,nivel,nome}], modulos[].requiredLevel e arquivos[].bucket. Novos campos opcionais no contrato para compatibilidade de consumidores/fakes anteriores; executor efetivo sempre grava valores explícitos.
Preflight valida schema/códigos/conflitos/arquivos do lote antes de envio; protege downgrade de uma oferta paga existente apenas através de edição deliberada, não faz merge automático de outros produtos. Reexecução atualiza grant_level sem duplicar.
Imagens públicas; referência privada usa /storage/v1/object/authenticated/arquivos-restritos/<caminho codificado>. /abrir assina apenas origem/bucket configurados; não assina origem externa ou caminhos inválidos.

## Conversão e implantação
Nenhuma mudança em produção, migration remota, push ou deploy. Migration role anterior deve preceder a nova. Conteúdo existente separado não será fundido por heurística: guia manda reimportar/recriar extras no produto principal, reconfigurar ofertas com níveis deliberadamente e despublicar produto antigo somente depois de conferir acesso, sem apagar compras.
Preservar scripts/cadastro-atlas-patologias.mjs. Trabalhar no worktree já isolado, mantendo branch anterior intacta.
Validação: TDD unitário/RPC SQL/rotas/CLI; npm test/lint/build; agent-browser Vercel contra provider local testando Basic, Complete, upgrade, downgrade, acesso direto bloqueado e admin. Nenhum teste escreve em produção.
