# Atlas + Protocolo — QA local

Execute a partir deste checkout isolado, sem arquivos `.env*`:

```powershell
node docs/qa/atlas-protocolo/browser-fixture.mjs
```

O launcher abre a aplicação Next real em `http://127.0.0.1:3350` e o provedor Supabase fictício em `http://127.0.0.1:3351`. Em desenvolvimento usa Webpack, pois o Next deste worktree pode estar ligado a `node_modules` por junction. Após um build sintético, `--production` usa `next start`. As duas portas precisam estar livres.

| Conta de teste | Compras fictícias | Atlas | Protocolo |
|---|---|---|---|
| `aluno@example.test` | `QA-ACERVO` | Básico | Não possui |
| `protocolo@example.test` | `QA-ATLAS-COMPLETE` + `QA-PROTOCOLO` | Completo | Possui |

Ambas têm aceite de termos fictício. O Atlas (`atlas-visual-das-patologias-na-construcao-civil-completo`) aponta para `protocolo-anti-retrabalho`, mas esse vínculo não concede acesso. Há produtos de outras trilhas para verificar a ordenação e módulo próprio no Protocolo. O checkout fictício termina em `/reference?checkout=protocolo`; nenhuma compra, e-mail ou chamada Payt é realizada.

Para a aceitação com Vercel Agent Browser:

```powershell
npx --yes agent-browser@0.38.1 --session atlas-protocolo --allowed-domains 127.0.0.1,localhost open http://127.0.0.1:3350/arquitetura/entrar
npx --yes agent-browser@0.38.1 --session atlas-protocolo snapshot -i
```

Entre com uma conta por vez e use sessões separadas para comparar os direitos. Confirme que a capa e o cartão do não comprador apontam para o checkout local e que o comprador segue para a rota interna do Protocolo. Inspecione desktop e celular, o painel Conteúdos recolhido, overflow e erros do navegador. O login mantém o intervalo mínimo do formulário, então aguarde antes de enviá-lo. Feche cada sessão com `agent-browser close` e interrompa o launcher com Ctrl+C.
