# Cadastrar um produto por pasta

Execute os comandos na pasta principal do projeto, onde está `package.json`. Prepare uma pasta para cada produto, com `produto.txt` na raiz. O exemplo em `docs/exemplo-pasta-produto` pode ser simulado imediatamente:

```powershell
node scripts/cadastrar-produto.mjs "docs/exemplo-pasta-produto" --simular
```

Estrutura:

```text
meu-produto/
  produto.txt
  capa.png                 (opcional: jpg, jpeg ou webp)
  banner.webp              (opcional)
  links.txt                (opcional)
  entregaveis/
    01 Guia.pdf            (arquivos soltos vão para o módulo Material)
    02 Bônus/
      01 Planilha.xlsx
```

Em `produto.txt`, use uma chave por linha. `nome`, `id` (código Payt), `tag` (`front`, `orderbump` ou `upsell`) são obrigatórios. Informe `loja` com o slug de uma loja existente ou configure `DEFAULT_STORE_SLUG`. `slug`, `trilha`, `destaque` (`sim` ou `não`), `ordem`, `checkout`, `organizacao` e `descricao` são opcionais; `checkout` passa a ser obrigatório para `orderbump` e `upsell`. A descrição pode ocupar as linhas finais. Comentários iniciados por `#` são aceitos antes da descrição. Em `links.txt`, cada linha é `Título | https://...`; linhas vazias e comentários são ignorados. Links de YouTube e Vimeo entram como vídeo.

Use `organizacao: versions` para separar Básico e Completo ou `organizacao: sections` para seções com acesso cumulativo. O valor `auto` e a ausência do campo usam `versions` para um **novo front**, e `sections` para um **novo orderbump/upsell**. Na reimportação, `auto` ou campo ausente preservam o modo já salvo; mudar `tag` sozinho não reorganiza conteúdo existente. Um valor explícito `versions`/`sections` solicita a mudança. Em `versions`, Completo deve conter tudo o que promete: não inclui materiais do Básico automaticamente.

`complemento: protocolo-anti-retrabalho` associa este produto a outro já cadastrado na mesma loja. O complemento aparece para descoberta, mas a compra e o acesso são independentes. Ao reimportar, omitir `complemento` preserva a associação atual; `complemento: nenhum` remove a associação. Informe a chave antes de `descricao`, pois a descrição ocupa todas as linhas seguintes. Aplique a migration de complemento antes de importar fichas com essa chave.

Nomes de pastas e arquivos podem começar com número e espaço para definir a ordem. Esse prefixo sai do título exibido. Arquivos sem prefixo vêm depois dos numerados. Aceita-se um nível de pastas de módulo em `entregaveis`; pastas mais profundas, módulos vazios, links simbólicos e entradas desconhecidas são recusados. Use nomes únicos para módulos e itens, inclusive após remover prefixos e acentos. O destino dos arquivos no bucket público `arquivos` começa com `<slug>/`.

Confira uma pasta antes de cadastrar:

```powershell
node scripts/cadastrar-produto.mjs "C:\caminho com espaços\meu-produto" --simular
```

Depois de conferir a simulação e preparar o banco, cadastre essa pasta:

```powershell
node scripts/cadastrar-produto.mjs "C:\caminho com espaços\meu-produto"
```

Para várias pastas de produto sob uma pasta principal:

```powershell
node scripts/cadastrar-produto.mjs "C:\caminho com espaços\lote" --todos --simular
node scripts/cadastrar-produto.mjs "C:\caminho com espaços\lote" --todos
```

`--todos` considera somente subpastas imediatas com `produto.txt` e mostra quais entradas ignorou. Toda a lista é validada antes de qualquer gravação. A simulação mostra módulos, itens, tamanhos, código Payt, link, organização e materiais utilizáveis por nível, sem criar cliente Supabase ou fazer rede. Essas contagens consideram a pasta como produto novo: uma simulação offline não conhece o modo, os materiais extras nem as ofertas já salvos. Na execução real, o preflight consulta esses dados, informa a organização preservada e valida o estado resultante antes do primeiro upload.

Para o cadastro real, configure `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`, mais `SUPABASE_SECRET_KEY`, em `.env.local` na raiz do projeto. Variáveis do processo prevalecem. Aplique antes a migration `supabase/migrations/20260924000003_product_role.sql` manualmente no SQL Editor do projeto correto. O script consulta a coluna `role` no preflight e interrompe se ela faltar. No painel Supabase Storage do mesmo projeto, confira que o bucket `arquivos` existe e é público; o aplicativo já depende dele. Não imprima nem compartilhe a chave secreta.

Uma reexecução atualiza produto por loja e slug, módulo por título dentro do produto, item por título dentro do módulo, e oferta pela identidade do plano (código Payt, modo e referência do checkout; no legado, código exclusivo). Também atualiza ordem e publicação. Módulos e itens extras já existentes são relatados e preservados. Um código Payt vinculado a outro produto ou loja e um slug existente em outra loja são conflitos: corrija-os antes de repetir. Execute um único processo de cadastro por vez, pois títulos de módulos e itens não têm restrição única no banco.

Falhas de rede podem deixar uploads ou registros parciais. Corrija a causa e reexecute a mesma pasta; o processo retoma pelos registros existentes. A validação inicial protege o lote contra pasta inválida ou arquivo ilegível, mas não constitui transação entre storage e banco.

## Produto com Básico e Completo

Há dois formatos aceitos: códigos Payt distintos por plano (abaixo) e um código Payt compartilhado com identificadores explícitos (seção seguinte). Eles não podem ser combinados na mesma ficha.

A ficha antiga com `id: CODIGO` continua válida: esse código libera o nível Completo e os arquivos soltos/pastas legadas são Básicos. Para criar um front novo com essa estrutura cumulativa, informe `organizacao: sections`; no modo automático de um front novo, a oferta Completo sem material Completo será recusada. Reimportar um produto existente sem `organizacao` mantém seu modo salvo. Para um produto novo com níveis, use `id_basico`, pelo menos um de `id_completo` ou `id_upgrade`, e `checkout_upgrade`. Não misture `id` com esses campos. Cada código Payt precisa ser distinto no lote. `checkout` continua sendo o checkout de entrada; `checkout_upgrade` é o link do botão de upgrade dentro da área de membros. O app não calcula diferença de preço: configure esse valor no checkout Payt correspondente.

O preflight exige ao menos um material publicado utilizável para cada nível comercializado; não exige sempre duas versões. Conta arquivos, links HTTP(S) e vídeos reconhecidos pelo player, inclusive vídeos como único material. Rascunhos, URLs inválidas e vídeos não reconhecidos não contam. Novas publicações, novos vínculos e mudanças de organização que deixariam uma oferta sem entrega são bloqueados. Configuração publicada legada já vazia, sem mudança dessa promessa, recebe aviso: o cadastro não revoga compras nem inventa materiais para corrigir o catálogo. Uma mudança que tornaria vazio um nível antes utilizável também é recusada. Para retirar material problemático deliberadamente, use o painel e confira o impacto sobre as ofertas.

Simule [a pasta de exemplo](exemplo-pasta-produto-niveis/produto.txt) antes de adaptar os códigos, links, loja e arquivos:

```powershell
node scripts/cadastrar-produto.mjs "docs/exemplo-pasta-produto-niveis" --simular
```

```text
produto.txt
links.txt
entregaveis/
  basico/
    01 Material principal/Guia.pdf
  completo/
    02 Extras/Modelo.zip
```

Arquivos soltos em `basico` vão para **Material básico**; em `completo`, para **Extras do Completo**. Pastas de módulos diretamente em `entregaveis` continuam básicas. Aceita-se um nível de módulo dentro de `basico` ou `completo`, sem subpastas mais profundas. Os títulos dos módulos precisam ser únicos entre todos os níveis. Em `links.txt`, a terceira coluna opcional é `basico` ou `completo`: `Título | https://exemplo.com | completo`. Sem ela, o link é básico. Links completos ficam em **Conteúdo online — Completo**. Links e vídeos externos dependem também das regras do provedor externo; o app oculta seus endereços do cliente Básico, mas não controla URLs já compartilhadas fora dele.

No Payt, configure o código Básico para a compra inicial, o código Completo para a compra integral e, se usado, o código Upgrade para o checkout próprio de upgrade. Completo e Upgrade concedem acesso Completo ao mesmo produto; não crie um segundo produto para o upgrade. Confira no painel a correspondência entre cada código, checkout e nível antes de publicar. O produto mostra uma capa e módulos completos bloqueados para quem tem Básico.

Antes de executar o cadastro real, aplique manualmente a migration de role indicada acima e a migration de níveis, nessa ordem, no projeto Supabase correto. Crie/confira o bucket privado `arquivos-restritos` e suas políticas conforme a migration de níveis. A capa e o banner continuam públicos no bucket `arquivos`; entregáveis de fichas com níveis vão para `arquivos-restritos`. O cadastro grava referências privadas estáveis e o servidor assina downloads somente após conferir acesso. A simulação não cria cliente Supabase nem faz rede. Execute um cadastro por vez e confira a saída inteira antes da execução real.

Reexecutar a mesma pasta atualiza o produto, módulos, itens, ofertas e níveis de vínculo sem apagar conteúdo extra existente. O preflight recusa códigos associados a outro produto ou loja e verifica todos os arquivos antes de começar uploads. Falhas após o preflight podem deixar gravações parciais; corrija a causa e reexecute. Reembolsar o pedido Completo ou Upgrade retira apenas o nível concedido por aquele pedido: se ainda houver um pedido Básico pago, o acesso volta a Básico. Acesso manual usa uma oferta existente e herda o nível dessa oferta.

## Um produto Payt com vários checkouts

Após aplicar `20261023010000_checkout_plans.sql` e publicar o código correspondente, a ficha aceita estes campos explícitos. Valores abaixo são exemplos fictícios; substitua por identificadores confirmados em eventos autenticados da sua integração:

```text
nome: Kit de exemplo
produto_payt: PRODUTO-EXEMPLO
codigo_checkout_basico: REF-BASICO
links_checkout_basico: https://payt.site/ExemploBasic, https://checkout.payt.com.br/exemplo-basic
codigo_checkout_completo: REF-COMPLETO
links_checkout_completo: https://payt.site/ExemploFull, https://checkout.payt.com.br/exemplo-full
tag: front
loja: arquitetura
organizacao: versions
```

`produto_payt` substitui todos os campos `id`, `id_basico`, `id_completo` e `id_upgrade`; misturá-los é erro. Básico e Completo exigem seus pares `codigo_checkout_*` e `links_checkout_*`. Para um terceiro plano Completo, acrescente ambos `codigo_checkout_upgrade` e `links_checkout_upgrade`; esse nome apenas identifica o terceiro plano da ficha. Cada referência precisa identificar um único plano desse código no cadastro por pasta. Os aliases de cada linha são separados por vírgula e normalizados antes de qualquer consulta de rede; não use vírgulas internas no alias. Links sobrepostos entre planos, hosts externos, HTTP, credenciais, portas e caminhos inválidos são recusados.

O código de checkout é uma referência administrativa, e o acesso usa os links explicitamente cadastrados que forem recebidos no evento autenticado. Cadastre a URL curta e a final quando comprovadas; não há busca de redirects nem inferência pelo preço, título ou UTM. Query, hash e barras finais são removidos, preservando maiúsculas no caminho.

O campo `checkout_upgrade` continua sendo exclusivamente o link do botão de pagamento da diferença dentro da área de membros. É **opcional neste formato compartilhado** e independente de `codigo_checkout_upgrade`/`links_checkout_upgrade`; um Completo promocional de compra integral não deve virar botão de diferença. Ao omitir `checkout_upgrade`, a ficha grava esse botão como vazio. O formato antigo com `id_basico`/`id_completo`/`id_upgrade` mantém sua exigência anterior desse botão.

O importador cria um grupo comum para os novos planos, seleciona a oferta pela identidade completa e preserva os UUIDs ao reexecutar. Na reimportação, mantenha referências e todos os aliases salvos; novos aliases podem ser acrescentados. Referência alterada com alias de outro plano, mistura com modo legado, sobreposição ou código de outro produto/loja interrompem o lote antes do primeiro upload. Planos antigos não são convertidos; seus grupos existentes são preservados. Códigos distintos antigos continuam aceitos.

A ficha por pasta suporta esses dois ou três planos de checkout para o mesmo produto. Para upsell por `upsell_code`, combos, planos com nomes livres ou mais planos, use **Admin → Ofertas**. Não há suporte a `planos.json`; entradas desconhecidas na pasta continuam recusadas.
# Complementos contextuais

Após aplicar as migrations `20261024020000` e `20261024021000`, a ficha aceita as chaves abaixo, antes de `descricao:`:

```text
complementos: guia, orcamento, biblioteca
visibilidade_catalogo: contextual
```

Os slugs de complementos precisam existir na mesma loja. Cadastre os alvos primeiro e depois associe o principal. A ordem da lista é a ordem da fileira. Omitir uma chave preserva sua configuração; `complementos: nenhum` limpa somente a lista contextual. `visibilidade_catalogo: catalogo` volta ao catálogo geral. O campo singular `complemento:` continua independente e compatível.

As relações não concedem acesso. `contextual` retira ofertas das trilhas gerais na loja com biblioteca agrupada, mas mantém acesso avulso às compras. Configure o modo da biblioteca no admin da loja depois de conferir os produtos. Complementos não podem ser principais de outros complementos.

A simulação CLI valida arquivos e sintaxe local; existência remota, concorrência e grafo são validados no preflight antes de uploads e novamente na gravação atômica. Em conflito de revisão, releia a ficha/banco antes de tentar de novo. Produto e relações são atômicos; uploads, conteúdo e ofertas do lote não constituem uma única transação. Imagens ausentes são preservadas ao atualizar relações de um produto existente.

