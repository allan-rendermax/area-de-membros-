# Entrega — encontrar e baixar materiais

24/09/2026. Implementação local na branch `codex/melhorias-acervo-membros`, base `b1c8252`; código revisado até `26282a6`. Sem publicação ou alteração do banco remoto.

## Resultado

- Entrada compacta com materiais adquiridos, busca por nome/categoria sem distinção de acentos ou caixa, estado vazio e limpeza da busca.
- Ofertas separadas do acervo e atalhos para materiais acessados recentemente.
- Produto com lista única, arquivos em destaque e ação para retomar ou abrir o primeiro material.
- Formatos reconhecidos e ações explícitas, como Baixar PDF e Baixar ZIP, mantendo a rota autorizada de abertura.
- Ajuda contextual no login e no acervo, inclusive quando não existe contato configurado.
- Progresso persistido no servidor, reversível, com estado pendente e erro sem sucesso falso. Sumário responsivo com conteúdo atual e concluído.
- Ajustes de contraste, navegação ativa, foco e barra de ações que não encobre a ajuda no celular.

## Evidências

Vercel agent-browser **0.38.1**, Next real hidratado, provedor HTTP local com dados fictícios. Sessões isoladas; autenticação pela interface normal. Nenhum bypass foi acrescentado às rotas do aplicativo. Desktop 1440px e celular 375×812.

| Verificação | Resultado |
|---|---|
| Login, ajuda e conta sem materiais | Passou |
| Busca com acento/caixa, sem resultados e limpar | Passou |
| Acervo separado de ofertas e compra sem checkout | Passou |
| Entrada direta em conteúdo não adquirido | Redirecionada para oferta; conteúdo não exposto |
| Produto, retomada e identificação PDF/ZIP/link | Passou |
| Concluir, recarregar e desmarcar | Estado persistiu e foi reversível |
| Falha simulada na gravação e nova tentativa | Estado anterior preservado, erro exibido, retry funcionou |
| Sumário no celular e aberto nativamente no desktop | Passou |
| Escape e restauração de foco nos painéis | Passou |
| Largura 375px, incluindo título longo | Sem overflow horizontal |
| Ajuda após correção da barra mobile | Alvo recebeu hit-test, sem sobreposição |
| Erros JavaScript da sessão principal | Nenhum listado ao concluir |
| Axe em main da home, produto e item | Zero violações detectadas; alguns contrastes de gradiente/ícones requerem inspeção manual |

Capturas inspecionadas visualmente. O contraste laranja de ações encontrado no primeiro QA foi corrigido para amarelo no tema Arquitetura. A verificação automatizada não constitui certificação integral WCAG. As capas geradas e ícones foram também inspecionados, mantendo o tema existente.

### Download: limite da evidência

O clique percorreu a rota autorizada e o arquivo local respondeu HTTP 200 com Content-Disposition de anexo; PDF de teste válido. Os testes cobrem autorização e transformação da URL de download. O agent-browser cancelou o salvamento físico em disco neste Windows, inclusive com uma âncora `data:text/plain` isolada, em sessões headed/headless e diretório temporário sem espaços. Portanto, **o salvamento final na pasta Downloads não foi comprovado**; não foi tratado como sucesso nem contornado desabilitando proteções. A ativação inclui conferir esse passo em navegador comum com arquivo real.

## Verificação de código

Execução final no worktree após todos os ajustes:

- `npm test`: **524 testes em 72 arquivos, todos passaram**.
- `npm run build`: **exit 0**, compilação, TypeScript e geração das páginas concluídos.
- `npm run lint`: **0 erros**, um aviso anterior em `scripts/trocar-admin-e-aluno.mjs:20` por variável não usada.
- Migration executada em PGlite nos testes, com verificação do esquema/RLS.
- Revisões independentes de implementação e revisão final: aprovadas, sem achados bloqueadores.
- Vite emitiu aviso de configuração já existente sobre futura mudança de loader.

Os processos locais de QA e as duas sessões de navegador desta execução foram encerrados.

## Decisões tomadas conforme a autonomia solicitada

1. Plano e escolhas visuais aprovados pelo controlador, como solicitado. Eventuais preferências diferentes exigem apenas ajustes reversíveis de interface.
2. Entrega local, sem deploy/migration remota. A produção continua na versão anterior até a ativação.
3. Informar formato conhecido, sem inventar tamanho de arquivo. Não há prévia de tamanho até existir metadata confiável.
4. Não importar automaticamente conclusões antigas do localStorage. Essas marcas precisam ser refeitas na versão sincronizada.

## Arquivos de referência

- [Ativação e reversão](activation.md): aplicar migration antes do deploy e conferir com conta autorizada.
- [Home desktop](home-desktop.png) e [home celular](home-mobile.png).
- [Produto celular](product-mobile.png), [item celular](item-mobile.png) e [item desktop](item-desktop.png).
- [Título longo](long-title-mobile.png), [ajuda no login](login-help-mobile.png) e [acervo vazio](empty-mobile.png).
- [Antes da integração](before-desktop.png).

QA não cobre envio real de e-mail, banco remoto, atendimento externo ou reprodução dos provedores de vídeo. Instruções de reprodução da fixture estão em activation.md.

## Conferência na pasta original

Os 47 arquivos da entrega foram copiados após comparação de hashes, sem sobrescrever edições concorrentes. As três alterações anteriores de e-mail foram preservadas. Na pasta original, com essas alterações existentes, a suíte completa passou: **528 testes em 72 arquivos**. O build acima foi validado no worktree isolado; o código da entrega foi conferido por SHA-256 após a cópia.
