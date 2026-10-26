# Acesso à compra com ajustes discretos

## Intenção e autorização

O usuário aprovou o piloto `piloto-ajuste-discreto.html` nesta conversa e pediu implementação completa, planejada, revisada e testada sem novas perguntas. É uma mudança delimitada no fluxo existente. Esta especificação registra o desenho aprovado e a correção adicional: usar nomes dos materiais, não “PDF/PDFs”, na apresentação ao membro. O usuário delegou a revisão do plano e escolheu execução com subagentes e Vercel Agent Browser.

## Restrições globais

- Manter a página inicial exatamente como está: hero, catálogo, Continuar, Meus materiais, agrupamento, estilos e comportamento dos carrosséis da home.
- Alterar somente a apresentação e navegação internas da compra; não modificar Payt, pedidos, concessões, autenticação, armazenamento ou cadastros.
- Preservar a identidade atual: título condensado, faixa de acesso, coluna lateral, capas de complementos e ofertas separadas.
- Mostrar somente produtos adquiridos, publicados e da mesma loja na navegação da compra; respeitar a prévia editorial existente.
- Preservar os módulos, níveis Básico/Completo, progresso e sequência do produto atual; associação não concede acesso.
- Preservar parâmetros de prévia e de cenário nos links internos.
- Usar Atlas, Guia ou Material digital conforme o nome; não exibir PDF/PDFs em rótulos gerados para o membro. Não alterar URLs, extensões, MIME nem textos internos dos entregáveis.
- Não fixar nomes, slugs, IDs, quantidade de arquivos ou bônus de um produto no código. A contagem de links não representa a quantidade de materiais dentro de uma pasta.
- Usar Vercel agent-browser para a validação de frontend, em ambiente local com dados sintéticos.
- Não publicar, fazer push ou migrar dados como parte desta implementação.

## Comportamento

Em lojas com biblioteca agrupada, a coluna existente passa a identificar “Conteúdos da compra” quando existe um grupo com principal e complementos adquiridos. Exibe o principal e todos os complementos adquiridos desse grupo, nomes completos, estado “Você está aqui” e rótulos de aquisição. Os acessos permanecem visíveis no celular. Os módulos do produto atual continuam disponíveis quando há múltiplos materiais; não duplicar um único material desnecessariamente.

Dentro de um complemento com principal disponível, mostrar “Voltar para {nome do principal}” de forma visível e acessível. Sem principal disponível, voltar a Meus materiais. O complemento avulso continua acessível. A rota do produto, a rota direta do item e a tela sem material publicado devem concordar.

A faixa de material mantém seu aspecto. O nome reconhecível é usado no rótulo de tipo/ação: Atlas, Guia ou Material digital; arquivos editáveis mantêm o formato útil (DWG, SKP, XLSX etc.). Títulos editoriais existentes continuam fonte de verdade. Não prometer quatro guias nem três bônus sem informação cadastrada que sustente isso.

A fileira de adquiridos usa “Seus complementos adquiridos”, status “Adquirido” e acesso textual claro. As capas e ofertas continuam no lugar atual. Controles do carrossel são omitidos quando não há transbordamento apenas nas fileiras internas, via opção com padrão que preserva a home.

A ajuda interna explica que o principal e os complementos têm acessos separados na lista da compra. Login, home e demais contextos não recebem essa mensagem.

## Validação e limites

Testes puros verificam grupos, irmãos, reembolso independente, publicações, lojas, relações repetidas e prévia. Testes de renderização/rotas verificam retorno, links, estado atual, ausência de vazamento de módulos e textos. Browser real: desktop 1440, mobile 390 e 320; um/zero/vários complementos, avulso, reembolso e caminhos diretos. Comparar a home antes/depois e confirmar que arquivos exclusivos da home não mudaram. Rodar suíte, lint e build. O fixture não prova downloads ou e-mails reais; não fazer transações nem registrar atividade na conta do cliente.
