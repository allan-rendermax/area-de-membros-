# Relatório da correção final

## Resultado

O `LockedPoster` agora acompanha mudanças efetivas do parâmetro `comprar` no cliente. Depois de fechar o diálogo, uma nova navegação para o mesmo slug volta a abri-lo; mudar para outro slug fecha o produto anterior. A abertura local pelo poster continua independente da URL, e o fechamento mantém `replaceState`, os demais parâmetros e o hash.

## TDD

### RED

Comando:

```text
npm test -- tests/membros/locked-poster.test.ts
```

Resultado antes da correção: exit 1, 3 falhas e 2 testes aprovados. Falharam exatamente:

- `reabre o mesmo produto quando comprar volta à URL após o fechamento`;
- `fecha o produto quando comprar muda e acompanha voltar e avançar`;
- `usa o mesmo fechamento no Escape e no clique fora do painel`, na reabertura pelo parâmetro.

### GREEN

Comando:

```text
npm test -- tests/membros/locked-poster.test.ts
```

Resultado após a correção: exit 0, 5 testes aprovados em 1 arquivo, nenhuma falha.

O teste usa um harness stateful de hooks porque o projeto não possui `jsdom`, `happy-dom` nem `react-test-renderer`. O harness mantém estado, refs, callbacks e dependências de efeitos entre renderizações, mas executa o componente real, seus handlers reais e as transições reais de `searchParams`; não replica a regra de abertura do produto.

## Validação adicional

- `npx tsc --noEmit`: exit 0.
- `npx eslint src/components/membros/locked-poster.tsx tests/membros/locked-poster.test.ts`: exit 0.
- `git diff --check`: exit 0.
- Build e suíte completa não foram executados nesta onda, conforme coordenação; ficam com o coordenador após o novo build.

## Arquivos

- `src/components/membros/locked-poster.tsx`
- `tests/membros/locked-poster.test.ts`

Nenhuma alteração foi necessária na vitrine, em acesso, persistência, banco ou dependências.

## Commit da correção

- `129ac88` — `corrige reabertura do modal pelo parâmetro comprar`

## Riscos residuais

- O teste automatizado não monta DOM real; foco e integração do histórico nativo com o roteador Next permanecem cobertos pela implementação preservada e pelo QA de navegador coordenado.
- A correção depende do contrato documentado do Next 16 de que `pushState`/`replaceState` sincronizam `useSearchParams`. A documentação local instalada foi conferida antes da alteração.
