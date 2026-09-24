# QA no navegador — papel do produto

Aplicação Next local em `127.0.0.1:3187`, provedor Supabase sintético em `127.0.0.1:54339`, Chrome controlado por Vercel `agent-browser@0.38.1` em sessão isolada `cadastrador-produtos-qa`. O navegador foi limitado a `127.0.0.1` e `localhost`. Todos os dados e credenciais usados eram fictícios; o fixture guardou alterações apenas em memória.

| Cenário | Resultado |
| --- | --- |
| Admin, novo produto | O campo **Papel** iniciou em **Front** e ofereceu Front, Orderbump e Upsell. [Tela inicial](admin-form-desktop.png). |
| Validação | Ao salvar Orderbump sem checkout, apareceu “Informe o link do checkout para produto complementar.” O fixture registrou zero mutações de produto nesse passo. |
| Criar e editar | Um produto publicado Orderbump com checkout fictício foi salvo na trilha separada **QA Cadastro**. Após recarga, o papel continuou Orderbump. Ele foi alterado para Upsell e, após nova gravação e recarga, continuou Upsell. O fixture registrou exatamente um POST e um PATCH de produto; a leitura final confirmou `role=upsell`, a trilha e o checkout. [Edição após recarga](admin-edit-desktop.png). |
| Vitrine de membro | Na trilha **Materiais**, a ordem da árvore acessível foi Atlas comprado → Upsell bloqueado (ordem 30) → Order bump bloqueado (ordem 90) → Front bloqueado (ordem −10). O produto oculto não apareceu. O produto criado ficou somente na trilha QA Cadastro. [Desktop](member-shelf-desktop.png) · [Celular](member-shelf-mobile.png). |
| Responsividade e erros | Em 1440×900 e 390×844, `document.documentElement.scrollWidth` foi igual à largura da viewport. Após recarga no celular, a mesma ordem permaneceu e `agent-browser errors` ficou vazio. O console mostrou apenas logs de desenvolvimento e um aviso de otimização LCP da imagem Atlas. A auditoria WCAG 2 A/AA da vitrine móvel encontrou zero violações; contraste em fundos com gradiente ficou inconclusivo para verificação automática. |

Limite visual observado no formulário desktop: o texto nativo “Escolher arquivo / Nenhum arquivo escolhido” ultrapassa a coluna de capa e fica sob a coluna de campos. Esse comportamento já existia no layout do formulário e não foi alterado neste trabalho.

Esta verificação cobre a aplicação real com um provedor HTTP local. Ela não testa Supabase, Payt, e-mail ou dados de produção.
