# Retorno dos cards e capas de order bumps

## Objetivo e decisões

Recuperar os cards existentes abaixo dos links de materiais. O usuário confirmou expressamente que o banner do Protocolo Anti-Retrabalho deve permanecer. A página mantém a apresentação original recuperada, com dois materiais no Atlas Completo. Usar a autorização anterior para executar plano e implementação sem novas aprovações de processo; a dúvida visual sobre o banner foi respondida nesta etapa.

Na vitrine, destacar os três produtos da imagem: Kit Gestão de Obras, Kit Captação e Atendimento de Clientes, Orçamento de Obras na Prática. Restaurar suas capas originais a partir de evidência histórica. Demais order bumps ficam relacionados aos Atlas correspondentes. Protocolo mantém o comportamento atual de upsell, sem nova alteração de sua visibilidade.

## Restrições globais

- Não redesenhar cards, carrosséis, materiais, sidebar, header ou homepage.
- Não alterar autenticação, regras de compra, Payt, níveis, pedidos, arquivos ou dependências.
- Não repor os quatro downloads individuais do Atlas.
- Manter o banner PathologyUpsell idêntico e o backup/tag aprovado intacto.
- Separar conteúdo adquirido (acesso ao produto) de produto não adquirido (modal com checkout cadastrado).
- Dados reais de preço/checkout não podem ser inventados. Seis complementos Hospitalar/Urbanismo não possuem checkout avulso comprovado; compras existentes devem continuar acessíveis.
- Preparar e mostrar prévia local validada antes de publicar esta nova alteração visual.

## Task 1: Reintegrar os cards existentes no conteúdo da compra

Arquivos: `src/components/membros/item-content.tsx`, `src/app/[loja]/produto/[slug]/page.tsx`, testes correspondentes em `tests/membros/`.

1. Adicionar testes que reproduzam a ausência dos cards em produto com primeiro item e em rota direta de item. Usar as fixtures atuais de `contextual-product-routes.test.ts` para assertar:

```ts
expect(html).toContain('Seus complementos')
expect(html).toContain('/arq/produto/guia')
expect(html).toContain('Conhecer optional')
expect(html.indexOf('Materiais disponíveis')).toBeLessThan(html.indexOf('Seus complementos'))
```

2. Usar a projeção de direitos já existente, sem nova consulta ou lógica por slug:

```tsx
import { ContextualComplementShelves } from './contextual-complement-shelves'
const complements = contextualInput ? projectProductComplements(contextualInput, ctx.product.id) : null
```

Logo depois da seção de recursos e antes de `PathologyUpsell`, inserir:

```tsx
{complements && <ContextualComplementShelves complements={complements} storeSlug={store.slug} preview={preview} complementScenario={complementScenario} />}
```

Preservar o `requestedOffer`/`ComplementPurchasePrompt` existente para deep links explícitos. Não passar `requestedSlug` aos shelves neste ajuste: o prompt já trata esse link, evitando abrir duas apresentações simultâneas.

3. Produto sem itens: calcular a mesma projeção e renderizar os shelves no conteúdo principal após o estado vazio/upgrade, antes de fechar a coluna. Não alterar o controle de acesso ou retorno ao acervo.

4. Confirmar testes: sem relações não há cards; relação entre lojas/rascunho não vaza; adquirido não vira compra; a sidebar não ganha cards nem outra lista de materiais; banner original permanece.

5. Executar testes de membros relevantes, TypeScript e ESLint. Registrar resultado em `.superpowers/orderbump-covers/task-1-report.md`. Não fazer deploy nem alteração de catálogo. Commit somente arquivos deste escopo.

## Task 2: Preparar catálogo de prévia e plano de alteração pontual

Responsável: agente principal, independente do renderer.

1. Ler snapshot pós-recuperação e obter estado atual antes de qualquer publicação futura.
2. Preparar cópia local do catálogo: três produtos da imagem com `catalog_visibility='catalog'` e capas históricas comprovadas; demais order bumps mantêm `contextual`.
3. Preservar as seis relações existentes. Acrescentar as três relações de Urbanismo e as três de Hospitalar usando IDs de publicação comprovados. Não reclassificar ofertas/pedidos.
4. Manter checkouts existentes e imagens quadradas cadastradas; conferir URLs das capas e os destinos dos três checkouts, sem comprar.
5. Gerar backend de teste somente loopback, com os dados de apresentação reais, direitos simulados e destinos de materiais locais. O servidor não deve enviar e-mail nem gravar em Supabase/Payt.

## Task 3: Revisão e validação da prévia

1. Revisor independente compara diff com restrições e valida direito adquirido versus oferta.
2. Agent-browser: testar 1440px e 390px, zero/um/todos OBs adquiridos, Basic/Complete, capa clicável e checkout correto, retorno da home aos OBs adquiridos. Confirmar três ofertas na vitrine com cenário não adquirido e demais relacionadas em cada Atlas.
3. Rodar testes adequados e build. Guardar capturas e registro do plano de dados; abrir prévia para usuário. Não publicar antes da conferência desta alteração visual.

## Review Focus

- Direito adquirido precisa abrir conteúdo, nunca checkout.
- Relações inválidas, ausência de relação ou falha de consulta não podem liberar material.
- Nenhuma alteração de listas de recursos: dois acessos no Atlas Completo.
- Banner original preservado; nenhum card extra na lateral.
- Capas históricas e URLs de checkout somente de registros comprovados; sem placeholders em produção.
