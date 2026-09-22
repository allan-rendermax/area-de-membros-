# Carregamento da área de membros — 22/09/2026

## O que mudou

- A sessão inicia a busca da loja e a validação do usuário em paralelo. O cliente continua sendo consultado a cada requisição.
- Produto e item consultam somente as permissões necessárias, sem carregar todo o catálogo para autorizar. A vitrine reutiliza o cliente já validado.
- O contexto de um item vem em uma consulta relacional item → módulo → produto, usando as chaves estrangeiras existentes. A navegação de vídeo busca somente os itens publicados do módulo atual.
- Capas raster elegíveis usam imagens responsivas do Next, com prioridade para o banner principal e carregamento lazy nas demais. URLs externas e formatos incompatíveis mantêm o comportamento anterior.
- Fechar o modal de compra remove apenas `comprar` da URL pelo histórico nativo, preservando outros parâmetros e hash e evitando recarregar a vitrine.

Não foram alterados cores, tipografia, carrosséis, regras de acesso, variáveis de ambiente ou dados remotos. Não há cache persistente de permissões: bloqueios e reembolsos continuam sendo verificados entre requisições.

## Medição das rotas

Teste local com build de produção, agent-browser 0.38.1 e backend sintético com 100 ms de latência por requisição Auth/REST. Mesmo dataset e navegador antes/depois; mediana de três amostras aquecidas, após descartar uma de aquecimento. O tempo inclui a leitura do corpo completo da resposta da rota, inclusive instrução de redirecionamento transmitida pelo Next; não mede a transferência do arquivo final nem a reprodução do vídeo.

| Rota | Antes | Depois | Redução | Requisições Auth/REST antes → depois |
|---|---:|---:|---:|---:|
| Vitrine | 547 ms | 445 ms | 18,6% | 8 → 8 |
| Produto | 877 ms | 657 ms | 25,1% | 10 → 9 |
| Arquivo | 983 ms | 546 ms | 44,5% | 11 → 8 |
| Vídeo | 1.195 ms | 653 ms | 45,4% | 13 → 9 |

Na vitrine, o ganho vem da sobreposição de consultas; a deduplicação de fetch do Next já evitava uma segunda ida ao backend para o mesmo cliente no baseline.

Esses números demonstram o efeito das mudanças em condições controladas. Não são uma promessa de latência em produção: região da Vercel/Supabase, rede, volume de dados e aquecimento influenciam o tempo real. A observação pública da tela de login antes da alteração variou entre 652 e 2.397 ms, sem controle dessas condições, e não é usada como comparação causal.

## Imagens e navegador

Comparação de payload único das variantes efetivamente escolhidas pelo navegador, nos mesmos arquivos raster sintéticos. As respostas WebP foram medidas com o cabeçalho Accept do navegador; estes valores não incluem HTML, JavaScript ou headers e não equivalem a tráfego de uma navegação com cache aquecido.

| Página | Tela | JPEG original | Variantes WebP | Redução |
|---|---|---:|---:|---:|
| Vitrine | 375×812 | 443.940 B | 20.362 B | 95,4% |
| Vitrine | 1440×1000 | 443.940 B | 45.100 B | 89,8% |
| Produto | 375×812 | 276.047 B | 16.598 B | 94,0% |
| Produto | 1440×1000 | 276.047 B | 41.336 B | 85,0% |

O fixture de imagens passou de URLs HTTP absolutas para caminhos locais relativos, para exercitar o ramo elegível do otimizador com os mesmos arquivos. HTTP é deliberadamente tratado como fallback. O ramo remoto HTTPS Supabase tem cobertura de política/configuração em testes; não foi medido contra imagens remotas reais.

O agent-browser confirmou `srcset`/`sizes`, banner eager/high e cards lazy, com geometria principal preservada nas quatro combinações de rota/tela, sem overflow ou URLs privadas no HTML da vitrine/produto. O fluxo de arquivo chegou ao destino sintético após registrar acesso; o vídeo abriu a página e a navegação Anterior/Próximo funcionou. A reprodução externa foi interrompida pelo teste.

Itens de outra loja e ocultos mostraram a página 404 sem entregar conteúdo. Nas navegações diretas observadas, o Next já havia iniciado o streaming e respondeu HTTP 200 com o estado de not-found no corpo; o teste não interpreta isso como entrega do item.

Bloquear o cliente encerrou a sessão na requisição seguinte; reembolsar a compra removeu acesso ao produto e mostrou o modal. Aluno sem autorização administrativa foi direcionado à entrada do admin. O fixture foi restaurado e os navegadores/servidor de QA foram encerrados. Não houve erro de console ou overlay do Next nas verificações finais.

## TDD e revisão

- Autorização/concorrência: 13 falhas de regressão observadas antes da implementação; 23 testes focados passaram depois.
- Consultas de conteúdo: 7 falhas observadas antes da implementação; 18 testes focados passaram depois. A revisão pediu um dataset com outro módulo e item oculto; o teste foi reforçado e uma mutação temporária comprovou que remover o filtro de módulo faz a regressão falhar. O código foi restaurado antes da validação final.
- Imagens/modal: ciclo RED/GREEN registrado; 42 testes focados passaram.
- As três tarefas tiveram revisão independente aprovada. O ajuste de teste da segunda tarefa também teve nova revisão aprovada.
- A revisão final encontrou uma regressão de reabertura: fechar um modal vindo de link direto e clicar no CTA do mesmo produto mudava a URL sem reabrir o diálogo. O QA reproduziu o problema no build real; o fechamento em si já fazia zero novas consultas e preservava os demais parâmetros/hash.
- A correção sincroniza o estado do modal quando `comprar` muda. O teste reforçado observou três falhas antes da correção e passou nos cinco cenários depois; a revisão limitada marcou o achado como resolvido, sem novas regressões.
- No build final `2547999`, o agent-browser confirmou link direto → fechar → CTA do mesmo produto → diálogo reaberto. Botão, Escape e backdrop fecharam com zero novas requisições Auth/REST; query/hash foram preservados. Voltar/avançar não ressuscitou o modal fechado. O baseline acrescentava oito requisições ao fechar.

## Validação final em main

Após integração fast-forward da implementação e correção, os quatro comandos foram executados na pasta principal do projeto:

| Comando | Resultado |
|---|---|
| `npm test` | exit 0; 44 arquivos, 323 testes aprovados |
| `npx tsc --noEmit` | exit 0, sem erros |
| `npm run lint` | exit 0; zero erros, um aviso preexistente |
| `npm run build` | exit 0; build de produção e geração das rotas concluídos |

Avisos anteriores preservados: variável `loja` não utilizada em `scripts/trocar-admin-e-aluno.mjs:20` e aviso do Vitest/Vite sobre o futuro `configLoader: native`. Não foram adicionadas supressões. O build da pasta principal carregou o ambiente já existente normalmente; nenhum arquivo de ambiente foi aberto, copiado ou alterado pelo trabalho.

## Banco e compatibilidade

Nenhuma migração foi criada ou aplicada nesta sessão. A migração anterior `supabase/migrations/20260922150000_order_payment_identity.sql` continua pendente de aplicação manual, conforme `docs/status-seguranca-2026-09-22.md`; estas otimizações não dependem dela.

O otimizador aceita caminhos raster locais compatíveis e imagens públicas HTTPS do bucket `covers` em projetos Supabase. Outras fontes usam a imagem original, mantendo compatibilidade, mas sem a redução de bytes desta otimização. Não foi habilitado acesso a IPs locais pelo otimizador nem processamento de SVG.

## Decisões de execução

1. Design e plano aprovados autonomamente, conforme autorização explícita. Se a interpretação do escopo estiver incorreta, o custo é revisar/reverter documentos e commits.
2. Escopo limitado a consultas e imagens, sem cache persistente nem novos índices. Isso preserva revogação de acesso e independência do banco; latência remota ou grandes volumes podem exigir outra rodada com medição real.
3. Otimização de raster restrita a caminhos locais e covers públicos HTTPS do Supabase, com fallback para as demais fontes. O custo é manter o peso original de imagens externas.
4. Tarefas 2 e 3 executadas em paralelo após a tarefa 1, em arquivos independentes; suítes finais, staging e commits foram coordenados. Um conflito exigiria reconciliação antes da integração.

## Evidências locais

Os fixtures sintéticos, JSONs e capturas ficam fora do repositório em `C:/Users/arqal/.codex/visualizations/2026/09/22/01a0ca00-5b38-7ee3-87c2-64d52391594d/carregamento/`. A comparação de rotas usa `baseline-routes-final.json`, `after-routes.json` e `comparison-routes.json`. Nenhum fixture, imagem de QA, chave ou arquivo de ambiente integra o commit.
