# Como usar o Codex neste projeto

Cole o bloco abaixo na primeira mensagem de um chat novo do Codex, com a pasta **Area de membros** aberta como projeto.

```
Projeto: área de membros multi-loja (Next.js 16 App Router, React 19, Tailwind 4,
Supabase com service role no servidor, Resend, hospedagem Vercel).

Leia antes de mexer em qualquer coisa:
- AGENTS.md (raiz)
- docs/superpowers/specs/2026-09-16-cuspidora-areas-de-membros-design.md
- docs/superpowers/plans/2026-09-16-cuspidora-areas-de-membros.md
- docs/conferencia-gpt-cuspidora.md (riscos já aceitos, não reabrir)
- docs/status-email-2026-09-22.md (estado de e-mail e domínio)

Regras de trabalho:
- TDD: escreva o teste, veja falhar, implemente, veja passar.
- Antes de dizer que terminou, rode e mostre o resultado de:
  npm test | npx tsc --noEmit | npm run lint | npm run build
- Migração de banco: crie o arquivo em supabase/migrations com timestamp e ME AVISE.
  NÃO aplique no Supabase e NÃO publique código que dependa dela antes de eu aplicar.
- Não altere .env.local, não exponha chaves, não mexa em variáveis da Vercel sem eu pedir.
- Não mude o visual (cores, tipografia, carrosséis) a menos que o pedido seja esse.
- Commit e push ao final, mensagem em português explicando o porquê.
- Ambiente Windows/PowerShell. `rg` não existe: use Select-String.
```

## Combinados para não dar conflito

1. **Um de cada vez.** Codex e Claude não devem editar o projeto ao mesmo tempo: o segundo a salvar sobrescreve o primeiro.
2. **Push ao final de cada sessão.** É assim que o outro lado se atualiza, lendo o histórico do Git.
3. **Migração é o ponto sensível.** Código publicado que espera uma coluna inexistente derruba o site. A ordem correta é: criar o arquivo da migração → rodar o SQL no Supabase → publicar.
4. **Avise o Claude quando voltar.** Basta dizer "o Codex mexeu no projeto", que ele lê o histórico e os documentos de status antes de continuar.

## Divisão que vem funcionando

| Tarefa | Quem |
|---|---|
| Código fechado, com escopo definido e testes | Codex |
| Decisões de produto, estrutura e navegação | Claude |
| Banco de dados, Vercel, domínio e e-mail | Claude |
| Cadastro de produtos e cargas em massa | Claude (scripts em `scripts/`) |
| Revisão do que o outro fez | sempre o outro lado |

## Scripts úteis já prontos (rodar com `node scripts/<arquivo>`)

| Script | Para quê |
|---|---|
| `cadastro-atlas-patologias.mjs` | Sobe arquivos e cria produtos, módulos, itens e ofertas. Base para novos produtos. |
| `ajustar-nomes-download.mjs` | Faz o arquivo baixado chegar com o nome do item. |
| `limpar-dados-exemplo.mjs` | Remove dados de teste e recria um pedido de teste interno. |
| `trocar-admin-e-aluno.mjs` | Troca quem é admin e quem é aluno de teste. |
