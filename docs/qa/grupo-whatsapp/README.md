# Grupo WhatsApp — QA local

Execute na raiz do checkout isolado, sem arquivos `.env` reais:

```powershell
node docs/qa/grupo-whatsapp/browser-fixture.mjs
# Após o controlador gerar o build com variáveis sintéticas:
node docs/qa/grupo-whatsapp/browser-fixture.mjs --production
```

O launcher exige portas livres 3340 (Next) e 3341 (backend), usa ambiente allowlisted com credenciais fictícias, recusa arquivos `.env` locais e encerra ambos os serviços em SIGINT/SIGTERM. `--production` usa o build existente. Nenhum e-mail é enviado; login real da aplicação gera e verifica tokens apenas no backend local.

Entre com `aluno@example.test` em `http://127.0.0.1:3340/arquitetura/entrar`. Não há senha. O formulário mantém sua proteção temporal normal; aguarde antes de enviar. O aluno possui compras e aceite de termos sintéticos.

Rotas após login:

- Produto: `http://127.0.0.1:3340/arquitetura/produto/atlas-qa`
- Item direto: `http://127.0.0.1:3340/arquitetura/item/00000000-0000-4000-8000-000000000030`
- Produto vazio com acesso: `http://127.0.0.1:3340/arquitetura/produto/vazio-qa`
- Loja sem grupo (o mesmo aluno tem compra): `http://127.0.0.1:3340/outra-loja/produto/material-qa`
- Login público: `http://127.0.0.1:3340/arquitetura/entrar`
- Saúde backend: `http://127.0.0.1:3341/__qa/health`

Convite fornecido esperado: `https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t`. Suporte separado esperado: `https://wa.me/5511999999999`. Inspecione os links sem navegar para serviços externos ou entrar em grupos. Capturar desktop 1440×900 e mobile 375×812, foco por teclado, posição acima do rodapé, ausência de overflow e ausência de pill na outra loja/login. Bloqueie frames externos do vídeo fictício durante QA offline.

`createCommunityFixture()` é exportada para verificações HTTP isoladas; preserva os arrays e o comportamento HTTP do provider base, que já inclui o RPC sintético de tentativas de login. Preview de e-mail e screenshots são artefatos mantidos pelo controlador.

## Ativação em produção

1. Aplicar `supabase/migrations/20261016010000_store_community_whatsapp.sql` no banco da aplicação **antes** de publicar o código que consulta a nova coluna. A migration acrescenta um campo opcional e preenche o convite fornecido apenas na loja existente com slug `arquitetura`, sem substituir um convite já configurado.
2. Publicar a aplicação e conferir **Admin → Lojas → Arquitetura → Grupo do WhatsApp (opcional)**. O convite deve ser `https://chat.whatsapp.com/BfhiSoEHc28E8OglEJQyPo?mode=gi_t`. Outras lojas ficam sem grupo até configuradas individualmente.
3. Novos avisos de acesso, novo produto e reenvios passam a incluir o convite. E-mails antigos não são alterados nem reenviados automaticamente. Para trocar ou ocultar o grupo, editar ou limpar esse campo e salvar; o suporte individual continua separado.

A implementação e a validação desta entrega são locais. Nenhuma migration remota, publicação, mensagem real ou entrada em grupo foi executada.
