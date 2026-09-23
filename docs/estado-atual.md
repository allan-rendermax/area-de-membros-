# Estado atual da área de membros

Atualizado em 23/09/2026. Este é o ponto de entrada para consultar entregas e pendências. Os relatórios datados preservam a evidência de cada rodada; não devem ser interpretados isoladamente como o estado atual.

## Publicação

- Domínio oficial: https://members.grupoelevamax.com.
- **Navegação entre módulos publicada:** commit `e66cd4ffbcdb06dc8e6bbf6c770f8ef8d9026127`, enviado por push normal a `main` após o usuário autorizar “prossiga”.
- Vercel consultada nesta rodada: deploy `dpl_DvW5HWozTCPE9bw9fNtf3kUHPC9o`, Ready / Production, domínio oficial atribuído e execução em São Paulo (`gru1`). URL: https://area-de-membros-d039y2bps-rendermax.vercel.app. Os logs confirmam o commit `e66cd4f` e build concluído em 18 segundos.
- Deploy anterior disponível para rollback: https://area-de-membros-6s9v6gdvd-rendermax.vercel.app, `dpl_FMSqkNAzLHKBEAfKUHd9uqz93teH`, commit `5473fc1` (correção de e-mail).
- O novo relatório `docs/status-entregabilidade-email-2026-09-23.md` foi produzido pela outra tarefa e permanece sob responsabilidade dela no Git. Registra Reply-To configurado, DMARC publicado e reenvio recebido no Gmail. Esse reenvio não comprova uma compra completa com bump nem o login OTP.

## Entregas com registro de publicação

| Área | Comportamento | Evidência |
| --- | --- | --- |
| Acesso e vendas | Isolamento das rotas administrativas, identidade de pagamentos e operações atômicas de oferta/e-mail | [Lançamento](status-lancamento-2026-09-22.md), [segurança](status-seguranca-2026-09-22.md) |
| Payt | Eventos autenticados marcados como teste são registrados e recebem resposta sem criar pedidos ou liberar acesso | [Postback](status-postback-payt-2026-09-23.md) |
| Admin | Opção de confiar no navegador por sete dias, vinculada à sessão | [Navegador confiável](status-admin-browser-2026-09-23.md) |
| Materiais | Upload pelo admin e abertura de arquivos/links com validação de acesso | [Publicação dos materiais](status-publicacao-materiais-2026-09-23.md) |
| Aula | Painel de conteúdos, anterior/próxima, informações e conclusão local | [Publicação da interface](status-publicacao-interface-aula-2026-09-23.md) |
| Desempenho | Consultas relacionais, cache de metadados públicos e funções próximas ao banco | [Carregamento](status-publicacao-carregamento-2026-09-23.md) |
| Visual | Tema exclusivo da loja Arquitetura, com ações amarelas e texto escuro | [Design system](status-design-system-arquitetura.md) |

## Navegação publicada e organização desta rodada

- “Conteúdos” lista todos os módulos publicados do produto com itens utilizáveis. O módulo da aula atual abre automaticamente; os demais podem ser expandidos.
- “Aula anterior” e “Próxima aula” seguem a ordem dos módulos e itens, atravessando módulos. Os extremos da sequência ficam desabilitados.
- Módulos vazios, rascunhos e destinos inválidos ficam fora da navegação. A consulta continua restrita ao produto autorizado e só ocorre depois da checagem de acesso.
- “Downloads e links” continua mostrando somente materiais do módulo atual. Abrir uma página de arquivo não registra um download; o registro continua no clique de abertura.
- A consulta reutiliza a função relacional existente, sem uma requisição por módulo, preservando a ordenação por `sort_order` e `created_at`.
- As duas imagens de referência foram movidas da raiz para [design/referencias](design/referencias/), com hashes conferidos. Os relatórios históricos pendentes foram incluídos na organização do Git, sem apagar seu conteúdo.

### Validação

- Quatro regressões novas reproduziram as limitações anteriores antes da correção e passaram depois dela.
- `npm test -- --reporter=dot`: **495 testes em 62 arquivos passaram**.
- `npm run build`: compilação, TypeScript e geração das páginas concluídos.
- `npm run lint`: zero erros; permanece o aviso anterior de `loja` não utilizada em `scripts/trocar-admin-e-aluno.mjs`.
- A suíte também emite avisos do Vite sobre o formato da configuração e de imagens em testes com DOM simulado; não houve falhas.
- Revisão independente dos arquivos de navegação e testes: nenhum achado.
- Navegador local: 1440×1000 e 375×812, passagem e retorno entre dois módulos, expansão do painel e títulos longos, sem overflow horizontal. O QA usou HTML gerado pelo componente real da rota, dados fictícios e CSS do build. Não foi uma sessão autenticada do Next.js nem um teste de hidratação, vídeo ou download real; a fonte de exibição usou o fallback do tema.

### Verificação após publicação

- Build remoto concluiu compilação, TypeScript e geração das páginas; deploy Ready e alias confirmados pela CLI Vercel.
- No domínio oficial, `/arquitetura/entrar` e `/admin/entrar` retornaram HTTP 200. Sem sessão, `/arquitetura`, `/admin`, uma rota de item e sua rota `/abrir` retornaram HTTP 307 para o respectivo login.
- Login da Arquitetura conferido no navegador em 375×812 e 1440×1000: sem overflow horizontal e sem erros JavaScript capturados. Botão “Entrar” com fundo `rgb(255,213,61)` e texto `rgb(23,23,23)`, confirmando o tema atual em produção.
- Não houve login real de aluno/admin, envio de código, compra ou download nesta publicação. A navegação autenticada em produção permanece sem validação nesta rodada; os cenários de módulos foram conferidos nos testes e na prévia sintética local.
- Nenhuma alteração de schema, DNS, credenciais ou configuração de produção nesta publicação. O relatório concorrente de e-mail foi preservado fora do commit.

## Pendências

| Prioridade | Pendência | Como concluir |
| --- | --- | --- |
| Alta | Compra real com order bump e entrega do e-mail | Fazer compra autorizada com valor definido; conferir eventos da Payt, pedidos, acessos e caixa de entrada. Eventos marcados como teste não liberam acesso por decisão atual. |
| Alta | Reembolso parcial do bump e revogação de acesso | Validar com uma transação apropriada, preservando o produto principal. Chargeback em produção segue sem evidência; usar procedimento legítimo homologado pelo provedor, sem gerar disputa artificial. |
| Alta | Plano e consumo efetivo do Supabase | Conferir plano e painel de uso da organização, separando tráfego com e sem cache. Não houve leitura desse painel nesta rodada. |
| Média | Validar navegação em sessão real | A correção está publicada; percorrer um produto com mais de um módulo no domínio oficial usando uma conta autorizada. |
| Média | Progresso sincronizado | Projetar persistência por aluno/loja/item no banco e sua exibição no admin. Hoje “Concluir” permanece local ao navegador. |
| Média | Login administrativo válido em produção | Validar recebimento do código, entrada e comportamento da opção de sete dias. Os relatórios registram QA completo local, mas não esse fluxo real. |
| Média | WhatsApp e checkout dentro da área | O relatório de 22/09 registrou campos vazios. Reconsultar a configuração e cadastrar os endereços corretos se ainda faltarem. Não inferir número ou URL de compra. |

## Observações sobre a revisão recebida

- **Supabase:** a documentação consultada em 23/09 informa, para Free, 5 GB de tráfego sem cache e 5 GB com cache, com cotas independentes. Não são 10 GB intercambiáveis. Repetições de download, cache e tráfego de outros serviços impedem converter isso em um limite fixo de alunos. Os 46 MB armazenados e a estimativa de 40 MB por aluno vieram da revisão recebida e não foram medidos novamente. Fontes: [cotas de egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [bandwidth do Storage](https://supabase.com/docs/guides/storage/serving/bandwidth).
- **Contraste:** o achado do relatório de lançamento é histórico. O CSS atual do tema Arquitetura aplica `#ffd53d` com texto `#171717` às ações, inclusive ao formulário de entrada. Nenhuma cor foi alterada nesta rodada; isso não substitui uma auditoria completa de acessibilidade.
- **Git:** havia quatro relatórios de publicação/admin não rastreados e dois relatórios modificados, além das imagens soltas. Todos foram preservados. A alteração concorrente de e-mail foi mantida fora do escopo desta implementação.

Nas próximas rodadas, atualize este documento com o commit/deploy e a evidência nova. Acrescente relatórios separados apenas quando houver detalhes técnicos úteis para auditoria ou rollback.
