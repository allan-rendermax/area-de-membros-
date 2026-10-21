# Atlas e Protocolo: descoberta e acesso

## Escopo aprovado

Em 21/10/2026 o usuário aprovou capa do Protocolo na primeira linha ao lado do Atlas, acesso dentro do Atlas e clique condicional: compradores abrem materiais; demais abrem checkout. Solicitou plano, execução por subagentes, revisão autônoma e testes de front-end com Vercel Agent Browser, sem novas perguntas. Essa autorização substitui as pausas de revisão das skills.

## Decisão

Adicionar `complementaryProductId` opcional no produto de origem (Atlas), correspondente a `products.complementary_product_id`. Um produto pode apontar para um complemento da mesma loja. A associação é de navegação e nunca concede acesso. Admin escolhe o complemento; cadastrador aceita `complemento: slug-do-produto` da mesma loja (produto já cadastrado). Ausência da chave preserva associação em reimportações; `complemento: nenhum` a remove.

Na vitrine, promover a trilha do produto associado para a primeira linha, colocar origem e complemento nos dois primeiros lugares e retirar a duplicata do complemento da trilha anterior. A primeira trilha associada vem antes de Continuar. Sem associações válidas, comportamento anterior permanece. Associações com produtos não publicados não alteram a vitrine real. Processamento determinístico, sem recursão e sem duplicatas mesmo com ciclos/associações compartilhadas.

Dentro do Atlas, mostrar um cartão do complemento no painel Conteúdos, fora das sanfonas de Básico/Completo. No celular o cartão permanece visível mesmo com Conteúdos recolhido. O bloco comercial abaixo dos materiais usa a mesma resolução: comprador vê acesso, não uma oferta de recompra. O produto complementar mantém página, materiais, níveis e pedidos próprios.

## Regras obrigatórias

- Preservar todas as regras atuais de compra, níveis Básico/Completo e proteção de downloads.
- A associação não concede acesso; usar direitos atuais calculados no servidor.
- Validar mesma loja, impedir autorreferência e ignorar alvos ausentes/não publicados na área do aluno.
- Quem possui o complemento acessa sua rota interna; quem não possui abre checkout HTTP(S) válido em nova aba com `noopener noreferrer`.
- Usar `studentCheckoutUrl` válido quando disponível, senão `checkoutUrl`; não fixar checkout no componente.
- Sem checkout válido, mostrar indisponibilidade sem link quebrado ou liberação de material.
- Prévia administrativa conserva `previa=1` e não representa compra real.
- Configuração reutilizável por admin e cadastrador; nenhuma regra geral baseada em slug do Atlas.
- Migrar apenas a associação editorial Atlas → Protocolo na loja arquitetura, usando slugs confirmados e sem alterar ofertas, pedidos ou concessões.
- Testar front-end com Vercel Agent Browser em ambiente local com dados sintéticos, sem compras ou mensagens reais.

## Persistência e implantação

Migration aditiva cria campo, FK composta para mesma loja e proteção contra autorreferência. Exclusão de complemento limpa somente a associação; origem permanece. Seed limitado à loja arquitetura e aos slugs `atlas-visual-das-patologias-na-construcao-civil-completo` e `protocolo-anti-retrabalho`. Seed só preenche associação vazia. Aplicação em produção e deploy são etapas distintas da validação local; não alegar publicação sem executá-la.

## Aceitação

1. Atlas e Protocolo aparecem adjacentes na primeira linha, com qualquer combinação de posse.
2. Clique da capa e do cartão interno abre materiais para comprador e checkout para não comprador.
3. Em Básico e Completo, Protocolo é complemento separado; nunca entra na sequência de aulas nem no progresso do Atlas.
4. Pagamento pendente/reembolsado/cancelado/chargeback não libera Protocolo; outra compra válida segue concedendo acesso.
5. Desktop e celular sem transbordamento horizontal; cartão interno acessível com Conteúdos recolhido.
6. Cadastro, edição, importação e remoção da associação são validados e documentados.
