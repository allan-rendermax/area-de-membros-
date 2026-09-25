# Revisão da jornada do aluno e da administração

Data: 25/09/2026. Base: `fd69a52`, publicado em produção. Auditoria de leitura; nenhuma alteração de produto, oferta, cliente ou código foi executada nesta revisão.

## Escopo e método

Revisão dos trabalhos desta conversa: capa → conteúdo, nomes de materiais, Básico/Completo, seções de packs/orderbumps/upsells, upgrade, produto bloqueado, personalização, navegação e carregamento. Não é auditoria integral de pagamentos, entregabilidade de e-mail ou infraestrutura.

Três subagentes independentes examinaram acesso, administração e rotas/desempenho. O coordenador conferiu os achados e a página publicada de conteúdo em desktop e 390 × 844. Assessment A de design foi concluído sem contato com o detector; Assessment B executou depois a entrega dos resultados isolados. Skills utilizadas: find-skills, dispatching-parallel-agents, impeccable e writing-plans; brainstorming serviu de apoio para comparar abordagens.

A busca em https://skills.sh/ confirmou disponibilidade de apoios de frontend, mas as skills locais cobrem o trabalho. Nenhum pacote adicional foi instalado. A verdade visual é a implementação e a tela aprovadas pelo usuário: não há PRODUCT.md ou DESIGN.md formal neste projeto.

## Requisitos que permanecem

- Manter a identidade dark, laranja e amarela da Arquitetura e a composição aprovada da página de conteúdo.
- Capa liberada abre diretamente a tela de conteúdo. Não recriar uma página intermediária de download.
- Título principal usa nome do produto. Não voltar com “Seu acesso” ou repetir “Clique aqui”.
- Material usa nome do produto como padrão; admin pode personalizar nomes.
- Em versões: Completo vê somente Completo; Básico vê Básico e uma oportunidade de upgrade.
- Em seções: preservar organização de packs, orderbumps e upsells e o acesso cumulativo existente.
- Produto bloqueado: capa em preto e branco, cadeado, modal personalizável e CTA de checkout.
- Checkout, suporte, texto e imagens reais não devem ser inventados.
- Simulação é exclusiva de administrador, sem gerar compras, progresso ou histórico.
- A próxima execução deve ser aprovada com base neste plano; este documento não executa mudanças.

## O que já está correto

1. A rota do produto renderiza o primeiro conteúdo diretamente; a segunda página redundante foi removida.
2. Autorização de página, download e progresso usa a mesma regra de versão. O download bloqueado é recusado antes de gerar URL assinada.
3. Nomes de seção e material são editáveis; nomes legados genéricos recebem fallback.
4. Há loading nas rotas, imagens responsivas para capas suportadas e consultas independentes em paralelo. Não é necessário refazer isso.
5. Modal de produto bloqueado tem título, texto, imagem opcional/removível, CTA configurável e foco/Escape.
6. A página de conteúdo examinada não apresentou overflow horizontal em 390 px; Conteúdos recolhe no mobile.

## Achados confirmados

As prioridades abaixo são desta revisão consolidada: P1 afeta entrega/salvamento; P2 afeta consistência, integridade ou operação; P3 é aprimoramento. Nenhum P0 foi comprovado.

| ID | Prioridade | Evidência e efeito | Encaminhamento |
|---|---|---|---|
| A1 | P1 | `item-content.tsx:31–37`, `/item/[id]/abrir/route.ts:30`, `item-access.ts:48–55`: registro de histórico é aguardado e sua falha impede vídeo/download autorizado. Testes atuais exigem esse bloqueio. | Histórico não bloqueante, com tratamento de erro; autorização continua obrigatória. |
| A2 | P1 | `next.config.ts:5`: limite total 4,5 MB; ProductForm/LockedProductFields oferecem 4 imagens de até 2 MB no mesmo envio. Três imagens de 1,6 MB excedem o limite antes da ação. | Envio individual das imagens, sem transportar os quatro binários no salvar. |
| A3 | P2 | `cadastro-executor.mjs:198–207` não persiste content_mode; `cadastro-plano.mjs:47` não aceita escolha. Banco usa sections, enquanto novo front no painel usa versions. | Paridade explícita painel/importador e preservação de legados. |
| A4 | P2 | `forms.ts:99–103`, `content-editor.tsx:57–58`, `offer-form.tsx:25`: novo front pode ter só Básico e oferta padrão Completo. A filtragem correta resulta em entrega vazia. | Validação cruzada de prontidão da versão comercializada. |
| A5 | P2 | `product-content.ts:5` libera todos os níveis na prévia; `produto/[slug]/page.tsx:31` força completo. “Visualizar como aluno” não reproduz comprador Básico/Completo. | Separar prévia editorial de simulação de acesso. |
| A6 | P2 | `actions.ts:131–139` valida produto, mas `products-admin.ts:128–136` exclui/reordena item por IDs independentes. Pode atingir outro produto com payload inconsistente. | Validar e restringir relação produto → módulo → item na mutação. Admin é global; não foi comprovada escalada de privilégio de aluno. |
| A7 | P2 | `product-form.tsx:74–76`: upgrade sem MemberTheme; bloqueado tem tema em `locked-product-fields.tsx:41`. Browser confirmou vermelho no upgrade e laranja no bloqueado. | Prévia com tema/contexto reais em ambos. |
| A8 | P2 | `product-form.tsx:15,69–72` e `forms.ts:130`: mockup de upgrade só substitui, não remove. | Remoção explícita equivalente ao modal bloqueado. |
| A9 | P2 | `actions.ts:94–101,107–128`: erros redirecionam com mensagem; formulário recarrega valores salvos. Não existe estado retornado com rascunho e erros por campo. | Manter rascunho na falha, indicar salvamento e erro contextual. A perda exata por tipo de controle requer reprodução em fixture, não foi provocada em produção. |
| A10 | P2 | Home `page.tsx:33,49–52` guarda IDs de produtos; `/produto` escolhe sempre primeiro item. “Continuar” não retoma último material. | Retomar último item ainda autorizado, com fallback. |

## Melhorias de UI/UX propostas

- Agrupar Geral em Produto, Compra de produto bloqueado, Upgrade para Completo e Publicação. Manter abas Geral/Conteúdo.
- Mostrar perto do checkout “Compra indisponível: configure um checkout” ou “Upgrade encaminha ao suporte”. Ausência de URL não deve ser descrita como link quebrado.
- Padronizar “Salvar alterações”, “Salvando…”, “Alterações não salvas”, erro junto ao campo e confirmação contextual. Barra acessível na rolagem sem encobrir o formulário mobile.
- Prévia do rascunho com identificação explícita e sem navegar pelo botão “Já paguei”. Não exigir publicação só para visualizar.
- Dar rótulos acessíveis específicos para Capa e Banner; distinguir botões “Salvar seção Básico” e “Salvar material …”.
- No mobile, reduzir a altura do acionador Conteúdos: atualmente precede o título e ocupa cerca de 114 px com espaços. Preservar a navegação recolhível e não criar novo layout de página.
- Mostrar nome real do material quando houver mais de um, evitando vários defaults iguais. Sugerir nomes ao admin; não renomear automaticamente conteúdo autoral.
- Manter microanimações discretas e respeitar reduced-motion. Não adicionar animações de atenção contínua.
- Harmonizar tamanho, espaçamento e estados dos dois modais sem apagar diferenças de compra nova e upgrade.

## Estado do catálogo observado

O Atlas de Patologias está publicado com três materiais: um Básico e dois Completos. Checkouts de compra/aluno/upgrade, descrição e campos personalizados do modal estão vazios no admin observado. Portanto, o CTA de compra ausente corresponde aos dados atuais. Completar esses dados é uma tarefa operacional, separada da correção do software.

A conversão anterior para versions depende de o Completo reunir todo o material prometido. A existência de um arquivo Completo não prova que seu conteúdo seja autocontido. Não inspecionamos os arquivos vendidos; requer conferência do responsável. Não reverter permissões automaticamente.

## Desempenho: limites da evidência

Confirmamos dependência bloqueante de histórico e caminhos sequenciais; não medimos LCP, INP, p95 ou economia em milissegundos. Tempo de chamada da ferramenta não é benchmark do site. Prefetch por intenção, progresso separado e otimização adicional de imagens são hipóteses a medir depois da correção de efeitos no render.

Assessment B: detector Impeccable retornou `[]`, exit 0; console observado sem warning/error. Isso não prova ausência de bugs de acesso, formulários ou UX. Não foi injetado overlay: evaluate disponível é somente leitura. Nenhum servidor de auditoria foi iniciado. Viewport temporário restaurado. Prévia editorial não comprova jornada de aluno pago; testes de navegação com contas fixture são necessários.

Assessment A: nota qualitativa interna 20/40 para o admin (não uma nota automática nem da área inteira): status 2, correspondência com mundo real 2, controle 2, consistência 2, prevenção 2, reconhecimento 3, eficiência 2, minimalismo 2, recuperação 1, ajuda 2. Forças: identidade existente, nomes editáveis e prévia bloqueada funcional. Personas mais afetadas: admin iniciante, operador recorrente e usuário de teclado.

Validação nesta revisão: subagente de acesso executou 95 testes em 7 arquivos; administração executou 52 em 6 arquivos. Existe sobreposição, portanto não somar os totais como testes únicos. Suite completa mais recente no mesmo HEAD: 834 testes aprovados durante publicação. Nenhuma mutação destrutiva ou compra real foi usada como teste.

## Direção recomendada

Três opções consideradas: apenas ajustes visuais; correções incrementais com identidade preservada; redesenho completo. Recomenda-se a segunda. Só polir deixaria problemas de entrega e salvamento; redesenhar contraria a preferência expressa e aumenta risco desnecessário.

Implementar em fases independentes: integridade → entrega resiliente → editor e imagens → simulação → conversão/UX → retomada/performance. Cada fase deve ter validação própria e poder ser publicada separadamente.

Questions skipped: pedido explícito de revisão e plano, com requisitos anteriores suficientes; nenhuma decisão foi tratada como autorização para implementar agora.
