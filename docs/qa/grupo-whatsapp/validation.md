# Grupo do WhatsApp — entrega e validação

Concluído localmente em 17/10/2026. Código revisado na branch `codex/grupo-whatsapp-arquitetura`, mudanças da funcionalidade após o baseline `c961690`; última correção de código `6537aae`.

## Entregue
- Configuração opcional **Grupo do WhatsApp** em Admin → Lojas, separada do suporte individual. Limpar o campo oculta o convite.
- Migration aditiva configura o convite fornecido apenas na loja `arquitetura`; outras lojas podem cadastrar o próprio grupo.
- Convite secundário em e-mails de novo acesso, novo produto e reenvio, preservando o acesso aos materiais como ação principal. Propagação verificada em compra Payt e reenvios individual/lote.
- Pill verde com ícone, centralizada acima do rodapé nas páginas de produto/módulo e item/aula, incluindo produto vazio. O convite não aparece no login, boas-vindas ou acervo inicial.
- Validação compartilhada exige URL HTTPS absoluta do host correto e rejeita formas incompletas, credenciais, portas customizadas, fragmentos, controles e caminhos inválidos. Query do convite original preservada.

## Verificações automáticas
| Verificação | Resultado |
|---|---|
| `npm test -- --maxWorkers=2` | 122 arquivos, **970 testes aprovados**, exit 0 |
| `npm run lint` | Exit 0; nenhum erro, um aviso preexistente em `scripts/trocar-admin-e-aluno.mjs:20` |
| `npm run build` | Exit 0; compilação, TypeScript e geração das páginas concluídas |
| Revisões independentes | Configuração, e-mail, UI e revisão geral aprovadas após correções |

Os testes incluem persistência/leitura entre lojas, remoção do convite, migration repetida em PGlite, propagação de dados até o envio, HTML de todos os avisos, validação de URLs e renderização dos caminhos de conteúdo. O projeto já emite um aviso do Vite sobre a configuração carregada como CommonJS. Uma primeira execução com paralelismo irrestrito atingiu timeouts de PGlite; a execução final usa dois workers, sem ampliar timeouts ou alterar configuração do produto.

## Navegador real
Vercel **agent-browser 0.38.1**, Chrome em sessão isolada, build de produção Next real e backend sintético local. Nenhum banco, e-mail ou pedido real foi usado.

| Cenário | Evidência |
|---|---|
| Login real da aplicação | Acesso com `aluno@example.test`, usando fluxo normal e tokens sintéticos |
| Produto desktop 1440×900 | Uma pill; centro horizontal; altura 48px; distância de 28px até o rodapé |
| Aula direta, celular 375×812 | Uma pill, texto legível, sem sobreposição ou overflow horizontal |
| Produto vazio, celular | Pill próxima ao rodapé: bottom 700,25px e footer top 728,25px |
| Outra loja sem configuração | Nenhuma pill ou convite de Arquitetura |
| Login e início, celular | Nenhum convite e largura do documento igual à viewport |
| Teclado | Tab alcança a pill; foco amarelo de 3px com afastamento de 4px |
| Acessibilidade do novo botão | Axe: zero violações, zero verificações inconclusivas no elemento auditado |
| Console e erros JS | Vazios nos fluxos conferidos |
| E-mail gerado pelo template real | Desktop e celular conferidos; ação principal preservada; convite centralizado; sem overflow |

Href observado: `https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t`, com `target="_blank"` e `rel="noopener noreferrer"`. O grupo não foi aberto nem houve tentativa de entrada. A disponibilidade do convite no WhatsApp e a renderização em clientes de e-mail externos não foram verificadas; não houve disparo real.

Capturas: [produto desktop](screenshots/product-desktop.png), [aula no celular](screenshots/lesson-mobile.png), [foco](screenshots/lesson-focus-mobile.png), [produto vazio](screenshots/empty-mobile.png), [outra loja](screenshots/no-group-mobile.png), [início](screenshots/home-mobile.png), [login](screenshots/login-mobile.png), [e-mail desktop](screenshots/email-desktop.png), [e-mail celular](screenshots/email-mobile.png). [HTML de e-mail sintético](access-email.html).

## Decisões registradas
1. Revisão e aprovação autônomas de design/plano conforme pedido explícito do usuário. Uma preferência diferente exige revisão do design local, reversível.
2. Configuração por loja, inicial apenas para Arquitetura, para respeitar a plataforma replicável. Se o grupo tiver de pertencer a um único produto, será necessário restringir esse escopo.
3. Publicação e migration remota fora desta execução local, pois não foram explicitamente solicitadas. A ativação exige aplicar a migration antes do deploy.
4. Foco do botão usa o token amarelo existente, pois uma borda escura ficaria pouco visível no fundo escuro. Reverter essa decisão exige apenas ajustar a cor de foco.

## Ativação
Seguir a [ordem de ativação](README.md#ativação-em-produção): migration, deploy e conferência da configuração no admin. Os e-mails antigos não serão reenviados automaticamente. Nenhum serviço externo foi modificado nesta entrega.
