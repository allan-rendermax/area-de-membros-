# Revisão do navegador confiável do administrador

O usuário aprovou a confiança por sete dias e pediu revisão, planejamento, execução com subagentes e teste de frontend com agent-browser da Vercel, sem novas perguntas. Esta é uma revisão delimitada do fluxo existente. O plano é revisado e aprovado pelo agente conforme essa autorização.

## Comportamento

- O primeiro acesso exige código enviado ao e-mail de um administrador autorizado.
- A opção “Confiar neste navegador por 7 dias” começa desmarcada e é uma escolha explícita.
- A escolha deve sobreviver a código incorreto e reenvio, sem obrigar o usuário a marcá-la novamente.
- Marcada, a confirmação vale no máximo 604800 segundos a partir da validação do código. Renovar tokens ou visitar páginas não reinicia o prazo.
- Desmarcada, o marcador de confirmação é cookie de sessão. Restauração de sessões pelo navegador pode preservar cookies de sessão; não prometer encerramento garantido ao fechar uma janela.
- Reabrir a tela de login com sessão válida e confirmação vigente abre o painel.
- Após expiração, cookies removidos, sessão revogada ou saída explícita, solicitar código novamente.
- Assinatura, identidade, sessão e lista de administradores continuam obrigatórias. Não criar bypass de autenticação para testes em código de produção.
- As sessões anteriores sem marcador fazem uma nova confirmação inicial.

## Limites e validação

Manter Next.js 16.3.5, Supabase e as dependências do produto. Ler os guias locais do Next antes de alterar código. Preservar arquivos alheios à autenticação. Usar worktree isolada e devolver os resultados verificados à pasta original, sem publicação remota. A infraestrutura de teste deve ser local e usar dados fictícios, sem envio de e-mails reais. Testar desktop e celular com agent-browser; registrar honestamente a diferença entre integração local e provedor real. Testes automatizados, lint e build devem passar, exceto avisos anteriores identificados.
