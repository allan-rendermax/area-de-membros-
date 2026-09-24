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

Em `produto.txt`, use uma chave por linha. `nome`, `id` (código Payt), `tag` (`front`, `orderbump` ou `upsell`) são obrigatórios. Informe `loja` com o slug de uma loja existente ou configure `DEFAULT_STORE_SLUG`. `slug`, `trilha`, `destaque` (`sim` ou `não`), `ordem`, `checkout` e `descricao` são opcionais; `checkout` passa a ser obrigatório para `orderbump` e `upsell`. A descrição pode ocupar as linhas finais. Comentários iniciados por `#` são aceitos antes da descrição. Em `links.txt`, cada linha é `Título | https://...`; linhas vazias e comentários são ignorados. Links de YouTube e Vimeo entram como vídeo.

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

`--todos` considera somente subpastas imediatas com `produto.txt` e mostra quais entradas ignorou. Toda a lista é validada antes de qualquer gravação. A simulação mostra módulos, itens, tamanhos, código Payt e link, sem criar cliente Supabase ou fazer rede.

Para o cadastro real, configure `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`, mais `SUPABASE_SECRET_KEY`, em `.env.local` na raiz do projeto. Variáveis do processo prevalecem. Aplique antes a migration `supabase/migrations/20260924000001_product_role.sql` manualmente no SQL Editor do projeto correto. O script consulta a coluna `role` no preflight e interrompe se ela faltar. No painel Supabase Storage do mesmo projeto, confira que o bucket `arquivos` existe e é público; o aplicativo já depende dele. Não imprima nem compartilhe a chave secreta.

Uma reexecução atualiza produto por loja e slug, módulo por título dentro do produto, item por título dentro do módulo, e oferta pelo código Payt. Também atualiza ordem e publicação. Módulos e itens extras já existentes são relatados e preservados. Um código Payt vinculado a outro produto ou loja e um slug existente em outra loja são conflitos: corrija-os antes de repetir. Execute um único processo de cadastro por vez, pois títulos de módulos e itens não têm restrição única no banco.

Falhas de rede podem deixar uploads ou registros parciais. Corrija a causa e reexecute a mesma pasta; o processo retoma pelos registros existentes. A validação inicial protege o lote contra pasta inválida ou arquivo ilegível, mas não constitui transação entre storage e banco.
