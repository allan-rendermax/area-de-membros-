# Níveis Básico e Completo Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Uma capa por produto com permissões Básico/Completo e upgrade interno.
**Architecture:** Nível por vínculo oferta-produto; exigência por módulo; cálculo dinâmico por pedidos pagos. Rotas autorizam antes de mostrar/assinar arquivos privados.
**Tech Stack:** Next16.3.5, React19, Supabase, Vitest/PGlite, Node24.
**Spec:** docs/superpowers/specs/2026-09-24-niveis-produtos-design.md

## Global Constraints
- Completo inclui todo Básico mais extras; uma linha products e uma capa por produto.
- Níveis basic|complete; role front|orderbump|upsell permanece independente.
- Legacy grant_level default complete e required_level default basic preservam compras antigas.
- Não aplicar migration/alterar produção; não fazer push/deploy; não imprimir segredos.
- Não alterar scripts/cadastro-atlas-patologias.mjs.
- Ler guias Next locais antes de editar app. TDD com RED/GREEN; commits só arquivos próprios.
- Novo bucket arquivos-restritos privado; assinatura 60 segundos somente após autorização.
- Não revelar URL/embed de extra ao cliente Básico; bloqueio também em rotas diretas.
- Usuário delegou revisão/aprovação; seguir sem novas perguntas.
- Task1 e Task4 podem executar em paralelo; Task2 e Task3 após contrato Task1 pronto, em arquivos distintos.

## Review Focus
1. Reembolso de Completo com Básico ainda pago volta a basic, não revoga tudo: tarefa1.
2. RPC antiga não pode promover vínculo basic ao reinserir: tarefa1 SQL.
3. Rotas diretas e anterior/próximo não podem expor extras: tarefa3.
4. Alterar módulo para complete com arquivo público próprio exige reenvio: tarefa2.
5. Reexecutar lote tiered não pode duplicar produto/oferta nem trocar grant legado: tarefa4.

### Task 1: Schema, acesso e contratos compartilhados
**Files:** supabase/migrations/20260924010000_product_access_levels.sql; src/lib/domain/types.ts; src/lib/access/access.ts; src/lib/data/access.ts; src/lib/data/products.ts; src/lib/content/private-files.ts; tests/access/levels.test.ts; tests/admin/product-levels-sql.test.ts; tests/content/private-files.test.ts; testes de queries/access afetados.
**Interfaces:** AccessLevel='basic'|'complete'; Product.upgradeCheckoutUrl?:string|null; Module.requiredLevel?:AccessLevel; ProductLink.grantLevel?:AccessLevel (ausência legacy complete). Export grantedProductLevels(orders,links,blocked):Map<string,AccessLevel>, canAccessLevel(granted:AccessLevel|undefined,required:AccessLevel='basic'):boolean. Manter grantedProductIds como wrapper de keys. data/access export loadGrantedProductLevels(storeId,customer):Promise<Map>; loadStoreAccess acrescenta levels sem remover granted.
private-files.ts exports PRIVATE_FILES_BUCKET='arquivos-restritos'; privateFileUrl(supabaseUrl,path):string; privateFilePath(url,supabaseUrl):string|null (origem própria, prefix authenticated do bucket privado, caminho decodificado validado); isLegacyPublicFileUrl(url,supabaseUrl):boolean (public/arquivos próprio). Não importa cliente Supabase.
- [ ] Escrever testes e rodar RED: básico, completo inclui básico, pedidos múltiplos, reembolso/chargeback/revogação com fallback, bloqueado, link sem nível legacy.
```ts
expect(grantedProductLevels([{productCode:'B',status:'pago'}],[{productCode:'B',productId:'P',grantLevel:'basic'}],false).get('P')).toBe('basic')
expect(canAccessLevel('basic','complete')).toBe(false)
expect(canAccessLevel('complete','basic')).toBe(true)
```
- [ ] Implementar migration colunas check/not-null defaults e RPC save_offer_levels_atomic(p_id uuid,p_store_id uuid,p_name text,p_product_code text,p_grants jsonb) returns uuid. p_grants=[{product_id,grant_level}]. Mesmo bloqueio/validação transacional da RPC atual; rejeitar duplicatas conflitantes e nível inválido; permissão service_role apenas. Substituir RPC antiga por wrapper que preserva níveis existentes na seleção e usa complete apenas em novos vínculos. Testar defaults, rollback, loja/código, níveis inválidos e wrapper.
- [ ] Propagar queries e mappers upgrade_checkout_url,required_level,grant_level. Campos opcionais na tipagem permitem fixtures legadas, mappers fornecem defaults. Testar helper de arquivos URL com espaços/#/%/traversal/origem externa e userinfo; construir URLs com encoding por segmento.
- [ ] Rodar testes focados e tsc/lint dos arquivos. Relatório RED/GREEN; commit feat: model basic and complete product access.

### Task 2: Administração, ofertas e uploads privados
**Files:** src/lib/admin/forms.ts; src/lib/data/products-admin.ts; src/lib/admin/item-upload.ts; src/app/admin/(painel)/produtos/{product-form.tsx,content-editor.tsx,item-fields.tsx,actions.ts}; src/app/admin/(painel)/ofertas/offer-form.tsx; supabase/migrations/20260924010001_private_product_files.sql; tests/admin/* testes afetados/novos.
**Interfaces:** Consome Task1 AccessLevel/helper privado/RPC. ProductInput.upgradeCheckoutUrl?:string|null; ModuleInput.requiredLevel?:AccessLevel; OfferInput.productLevels?:Record<string,AccessLevel>; AdminOffer.productLevels?:Record<string,AccessLevel>. ItemUploadTicket.bucket?:string para compatibilidade antiga; novos tickets bucket arquivos-restritos e publicUrl=privateFileUrl(config,path), sem assinar download no admin. UI envia para ticket.bucket, fallback arquivos somente tickets antigos.
- [ ] Testes RED parseProductForm URL upgrade, parseModuleForm nivel inválido/defaultbasic, parseOfferForm níveis por produto, saveOffer RPC novos pares, editar/reabrir mantém níveis e bundles. Campo HTML grant_level_<id>. Defaults de oferta complete.
```ts
form.set('required_level','complete')
expect(parseModuleForm(form).requiredLevel).toBe('complete')
```
- [ ] Implementar controles: link de upgrade no produto, acesso no módulo (novo e editar), nível por produto na oferta. Aviso de impacto em compras existentes. Salvar rows com upgrade_checkout_url/required_level; saveOffer chama save_offer_levels_atomic com p_grants. Erro amigável migration ausente sem fallback inseguro.
- [ ] Criar migration bucket privado (storage.buckets id/name arquivos-restritos public false; não mudar arquivos/covers). Novos uploads admin privados, assinados para upload; URL referência permanece privada. Guardar saveModule complete se arquivos atuais apontam bucket público legado próprio e saveItem em módulo complete se URL de arquivo é pública própria: erro pede reenvio. Links externos seguem permitido. Garantir alterações de nível antes de uploads inúteis no form action.
- [ ] Tests upload tickets/bucket e guards com fake; atualizar fixtures antigas para novo comportamento, preservar ownership das actions. Teste SQL bucket com schema mínimo PGlite ou inspeção estruturada se apropriado. Rodar focados/lint/tsc, relatório e commit.

### Task 3: Experiência do membro e autorização de downloads
**Files:** src/app/[loja]/produto/[slug]/page.tsx; src/app/[loja]/item/[id]/page.tsx; src/app/[loja]/item/[id]/abrir/route.ts; src/components/membros/lesson-sidebar.tsx se necessário; novo src/components/membros/product-upgrade.tsx; src/lib/data/resource-download.ts; testes membros/content rotas.
**Interfaces:** Consome loadGrantedProductLevels e canAccessLevel; modules.requiredLevel default basic. src/lib/data/resource-download.ts export resolveResourceDestination(item,supabaseUrl):Promise<string|null>; usa privateFilePath e createAdminClient().storage.from(PRIVATE_FILES_BUCKET).createSignedUrl(path,60,{download:true}) para privado; legado/externo getResourceDestination existente.
- [ ] Testes RED de básico vs complete na página; bloqueado/sem compra/loja errada/rascunho continuam protegidos. Acesso direto a item completo por básico redireciona produto antes de recordItemAccess ou assinatura. Básico não recebe extras no primeiro item/sidebar/anterior/próximo/siblings.
```ts
expect(canAccessLevel(levels.get(product.id),module.requiredLevel??'basic')).toBe(false)
```
Testar rotas reais mockando loaders e checando ausência do URL privado/iframe em HTML/RSC renderizado.
- [ ] Renderizar badge Seu acesso e módulos bloqueados título/quantidade sem URLs de item. ProductUpgrade mostra CTA apenas basic+extras publicados+URL válida; sem checkout texto de bloqueio/suporte; complete sem CTA; atualizar acesso via navegação dinâmica. Reutilizar visual existente, sem redesenho.
- [ ] Enforce gate nas 3 rotas antes de qualquer uso de URL e registro; gerar lista de navegação só de módulos permitidos. Resolver privado servidor depois do gate, erro assinatura não vaza URI nem faz redirect inválido; se sem retorno notFound ou erro controlado. URLs externas autorizadas e arquivos legados continuam comportamento anterior. Assinatura não cacheada.
- [ ] Rodar testes focados relevantes, lint/tsc, relatório e commit feat: show locked extras and unlock complete access.

### Task 4: Cadastro por pasta com duas versões
**Files:** scripts/lib/cadastro-plano.mjs; scripts/lib/cadastro-pasta.mjs; scripts/lib/cadastro-executor.mjs; scripts/cadastrar-produto.mjs; tests/cadastro/*; docs/como-cadastrar-produto.md; docs/exemplo-pasta-produto-niveis/**; docs/niveis-basico-completo.md (guia de configuração/conversão).
**Interfaces:** Ficha antiga id permanece; nova id_basico,id_completo,id_upgrade,checkout_upgrade. Novas fichas geram ofertas:[{codigo,nivel:'basic'|'complete',nome}], plano.modulos[].requiredLevel; upload.bucket='arquivos'|'arquivos-restritos'. Ficha produto pode acrescentar ofertas e modoNiveis, mantendo legado id existente. Executor usa plano.ofertas com fallback legacy id para fakes anteriores. Implementar sem depender de imports TypeScript.
- [ ] Testes RED ficha tiered/mútua exclusão/códigos duplicados/checkouts; pastas basico/completo, arquivos soltos, módulos com mesmos nomes erro; links terceira coluna; compatibilidade absoluta de fichas id antigas. Usar spec para regras exatas.
```text
nome: Kit
id_basico: BASIC01
id_completo: FULL01
id_upgrade: UPG01
tag: front
loja: arquitetura
checkout_upgrade: https://example.com/upgrade
```
- [ ] Implementar leitor de até um nível de módulo dentro de basico/completo e manter antigo um nível; sem symlinks, colisões, ordens int32 e proteções de caminho existentes. Private refs usando /object/authenticated/arquivos-restritos com encodeURIComponent por segmento; imagens públicas em arquivos, arquivos tiered privados; legacy bucketarquivos.
- [ ] Executor preflight todas ofertas/níveis/schema/lojas/conflitos antes upload; upsert link grant_level explicitamente mesmo quando existe, módulos required_level e produto upgrade_checkout_url; ofertas antigas sem mapa continuam complete. Validar lote contra qualquer code das várias ofertas. Nunca migrar/vincular automaticamente produto de outro slug/loja. Não apagar extras.
- [ ] Testar fake stateful: 3ofertas um produto/uma capa, duas execuções sem duplicar, básico vs upgrade flags, conflitos de qualquer code abortam lote, privado bucket MIME/download encoding certo. CLI --simular imprime ofertas+níveis+módulos e usa zero rede. Rodar legados e exemplo novo.
- [ ] Guia em português: como configurar Payt básico/completo/upgrade, módulo e checkout, migration antes de deploy, bucket privado, links externos/legados, reembolso, manual grant, uma execução por vez. Conversão de catálogo existente requer reimportar/recriar extras no principal e configurar ofertas conscientemente; despublicar produto duplicado só após conferir; não apagar pedidos nem adivinhar mapeamento; não prometer que URLs públicas antigas são revogadas. Rodar focados/lint e relatório, commit.

### Task 5: QA integrado e entrega
**Files:** docs/qa/niveis-produtos/browser-fixture.mjs, browser-report.md e capturas; docs/validacao-niveis-produtos.md.
**Interfaces:** Reusar fixture sintética anterior, portas exclusivas 3191/54341, ambiente isolado sem credenciais reais. Usar agent-browser@0.38.1.
- [ ] Revisão por tarefa e revisão final; corrigir findings com agentes, não editar código no controlador.
- [ ] Fixture básico pago, completo pago, básico+upgrade pago, reembolso upgrade com básico ainda pago, bloqueado. Simular Payt via endpoint real /api/webhooks/payt com payload sintético/provedor local se viável; confirmar acesso após status novo sem recadastrar produto.
- [ ] Navegador testa admin URL upgrade/módulo/nível oferta persistidos; upload privado signed fake; aluno básico vê extras bloqueados e CTA, completo vê tudo e sem CTA, acesso direto básico ao extra bloqueado, signed download somente completo. Mobile390 e desktop1440, screenshots/erros/overflow. Uma capa por produto.
- [ ] npm test, npm run lint, npm run build; duas simulações (legacy/tiered). Registrar contagens, warnings anteriores, restrições de produção e passos SQL exatos (role anterior + migrations de níveis/private bucket).
- [ ] Commit docs de validação e checklist; manter branch local sem merge/push/deploy.
