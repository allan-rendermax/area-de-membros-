# Benchmark HTTP local — jornada do aluno (25/09/2026)

A gravação de histórico deixou de bloquear a entrega autorizada no build local. Com falha sintética de histórico, o arquivo privado passou de HTTP 500 na base para HTTP 307 no build atual. Isso comprova o comportamento local; não mede a infraestrutura Vercel/Supabase.

## Ambiente e método

- Base: commit `fd69a52`, extraído com `git archive` para `.superpowers/qa-baseline`. Atual: snapshot dos arquivos de trabalho autorizado para teste, copiado para `.superpowers/qa-current` em 25/09/2026, antes das medições; não é um SHA de commit publicado.
- Ambos: Next.js 16.3.5, React 19.2.8, Windows, `next build --webpack` e `next start`. Builds, TypeScript e prerender concluídos. O aviso de múltiplos lockfiles veio das cópias de QA dentro do worktree.
- Autenticação real do SDK Supabase com sessão JWT emitida somente pela fixture. Todos os dados/segredos são fictícios. Processos Next bloqueiam `fetch` fora de loopback. Sem banco, checkout ou e-mail real.
- Provedor sintético com 25 ms de espera em cada chamada Auth/REST/Storage. Sem latência adicional entre cliente HTTP e Next, ambos no mesmo computador. Não simula rede móvel.
- Cinco amostras por cenário/perfil/temperatura. “Frio de processo” é a primeira requisição autenticada após reiniciar o processo Next; não afirma esvaziamento de caches em disco, SO, DNS, CDN ou cold start de função Vercel. Startup até “Ready” não entra no TTFB.
- “Aquecido” mantém a última instância usada no cenário e executa cinco requisições. Cada amostra abre conexão TCP própria. Redirects não são seguidos: mede autorização/assinatura/resposta, não bytes do arquivo final.
- TTFB: relógio `performance.now()` do cliente até os headers. Resposta completa: até o fim do corpo HTTP. Páginas transmitem HTML por streaming, portanto TTFB pode preceder o conteúdo autorizado.
- Rodada adicional: cinco amostras aquecidas de vídeo e arquivos por perfil, acrescentando 800 ms apenas no POST de histórico. São 220 amostras no total. Não calculamos p95 com cinco observações.
- Browser funcional usa provider 3342 e dev 3351; comparação usa builds de produção e provider separado 3344. A rodada normal da base usou 3342 antes de qualquer uso de browser, com o mesmo dataset e latência. A rodada de atraso foi refeita integralmente no 3344 para evitar mistura dos contadores.

Fingerprint SHA-256 dos caminhos relativos e bytes de `src/` do snapshot atual: `51f9afc44c0baa821a727001866442afd504bc5490b3b8e868da44f1afbd1948`.

Cada célula abaixo é **p50 / máximo, em ms**, arredondada ao inteiro. CSVs conservam duas casas decimais.

## Processo frio, atraso de histórico adicional 0 ms

| Perfil | Requisição | TTFB base | TTFB atual | Completa base | Completa atual |
|---|---|---:|---:|---:|---:|
| Básico | Capa → produto | 403 / 864 | 399 / 445 | 557 / 999 | 552 / 561 |
| Básico | Sidebar → vídeo | 399 / 407 | 413 / 429 | 526 / 536 | 540 / 560 |
| Básico | Abrir arquivo público | 489 / 493 | 464 / 477 | 489 / 493 | 464 / 477 |
| Básico | Abrir arquivo privado | 508 / 519 | 541 / 564 | 508 / 519 | 541 / 564 |
| Completo | Capa → produto | 403 / 414 | 464 / 472 | 557 / 569 | 617 / 646 |
| Completo | Sidebar → vídeo | 395 / 416 | 453 / 460 | 527 / 555 | 588 / 599 |
| Completo | Abrir arquivo público | 483 / 489 | 510 / 537 | 483 / 489 | 510 / 537 |
| Completo | Abrir arquivo privado | 515 / 525 | 538 / 540 | 515 / 526 | 538 / 540 |

## Aquecido, atraso de histórico adicional 0 ms

| Perfil | Requisição | TTFB base | TTFB atual | Completa base | Completa atual |
|---|---|---:|---:|---:|---:|
| Básico | Capa → produto | 36 / 37 | 36 / 37 | 187 / 188 | 187 / 187 |
| Básico | Sidebar → vídeo | 36 / 36 | 36 / 37 | 156 / 158 | 157 / 157 |
| Básico | Abrir arquivo público | 154 / 155 | 124 / 138 | 154 / 155 | 124 / 139 |
| Básico | Abrir arquivo privado | 185 / 185 | 154 / 169 | 185 / 185 | 154 / 169 |
| Completo | Capa → produto | 36 / 37 | 37 / 49 | 188 / 188 | 188 / 200 |
| Completo | Sidebar → vídeo | 36 / 38 | 38 / 41 | 156 / 157 | 171 / 171 |
| Completo | Abrir arquivo público | 154 / 154 | 124 / 138 | 154 / 155 | 124 / 138 |
| Completo | Abrir arquivo privado | 185 / 185 | 155 / 170 | 185 / 185 | 155 / 170 |

## Aquecido, histórico com 800 ms adicionais

| Perfil | Requisição | TTFB base | TTFB atual | Completa base | Completa atual |
|---|---|---:|---:|---:|---:|
| Básico | Sidebar → vídeo | 36 / 52 | 36 / 38 | 961 / 979 | 156 / 158 |
| Básico | Abrir arquivo público | 958 / 961 | 124 / 139 | 959 / 961 | 124 / 139 |
| Básico | Abrir arquivo privado | 989 / 991 | 154 / 156 | 989 / 991 | 154 / 156 |
| Completo | Sidebar → vídeo | 36 / 39 | 37 / 38 | 961 / 966 | 157 / 158 |
| Completo | Abrir arquivo público | 960 / 966 | 123 / 125 | 960 / 966 | 123 / 125 |
| Completo | Abrir arquivo privado | 991 / 992 | 154 / 154 | 991 / 992 | 154 / 154 |

## Evidência de execução após o redirect

Na mesma conta fictícia, com atraso de 800 ms:

| Verificação | Base | Atual |
|---|---:|---:|
| Histórico antes / na resposta / após espera | 102 / 103 / 103 | 101 / 101 / 102 |
| Arquivo privado autorizado | 307 | 307 |
| Arquivo privado com POST de histórico retornando 503 | 500 | 307 |
| Básico tentando arquivo Completo | redirect bloqueado | redirect bloqueado |
| Assinaturas e gravações no caso bloqueado | 0 | 0 |

O teste executou `next start` real e a chamada `after` real; o INSERT pendente concluiu depois do redirect no atual. A verificação equivalente em Vercel ainda depende de uma implantação autorizada.

O vídeo no build atual não registra durante GET/SSR: a montagem do componente client chama uma Server Action que revalida autorização. Este cliente HTTP não executa JavaScript e, portanto, não inclui a chamada de visita client, hidratação, reprodução, refresh de progresso ou render visual. Os testes DOM de `item-visit` cobrem montagem, StrictMode, refresh, remount e rejeição; o checklist de navegador é evidência complementar.

Os CSVs registram contagem de Auth, leituras REST, POST de histórico e assinatura Storage por amostra. A medição aguarda o histórico fora da janela de resposta para contar efeitos adiados. Arquivos têm uma chamada Storage adicional quando privados. A redução de um POST durante GET de vídeo é esperada: ele foi transferido para a visita client, não eliminado do fluxo completo de navegador.

## Arquivos de evidência

- [Base, atraso 0 ms](benchmark-baseline-0.csv), [atual, atraso 0 ms](benchmark-current-0.csv).
- [Base, atraso 800 ms](benchmark-baseline-800.csv), [atual, atraso 800 ms](benchmark-current-800.csv).
- [Checks runtime base](runtime-baseline.json), [checks runtime atual](runtime-current.json).
- [Runner reproduzível](http-benchmark.mjs), [provider local](../../../scripts/qa-members-browser-fixture.mjs).

## Reproduzir

1. Criar `.superpowers/qa-baseline` com `git archive fd69a52`, copiar o candidato para `.superpowers/qa-current` e disponibilizar `node_modules` nas duas pastas. Não copiar `.env` real.
2. Em processo separado, executar `QA_PROVIDER_PORT=3344 node scripts/qa-members-browser-fixture.mjs` (no PowerShell: `$env:QA_PROVIDER_PORT='3344'` antes do comando).
3. Construir ambos com `next build --webpack`. Usar `SUPABASE_URL=http://127.0.0.1:3344`, `SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key`, `SUPABASE_SECRET_KEY=fixture-service-key`, `APP_URL=http://127.0.0.1:3340` para base/3341 para atual, `ADMIN_EMAILS=admin@example.test`, `DEFAULT_STORE_SLUG=arquitetura`, `LOGIN_GUARD_SECRET=fixture-only-hmac-secret-32-chars-minimum`, `PAYT_INTEGRATION_KEY=fixture-payt`, `RESEND_API_KEY=re_fixture`, `EMAIL_FROM=fixture@example.test`. Turnstile vazio.
4. A partir da raiz, rodar os comandos abaixo, sequencialmente. O runner abre e fecha as instâncias Next, cria bloqueio de fetch externo e grava resultados em `.superpowers/qa-<versão>-<atraso>.json`.

```powershell
node docs/qa/jornada-2026-09-25/http-benchmark.mjs baseline .superpowers/qa-baseline 3340 0
node docs/qa/jornada-2026-09-25/http-benchmark.mjs current .superpowers/qa-current 3341 0
node docs/qa/jornada-2026-09-25/http-benchmark.mjs baseline .superpowers/qa-baseline 3340 800 --warm-only
node docs/qa/jornada-2026-09-25/http-benchmark.mjs current .superpowers/qa-current 3341 800 --warm-only
```

`QA_BENCH_PROVIDER` permite outra porta de fixture. Nunca apontar para um provedor real. O runner presume portas livres.

## Limites

Não medimos clique→feedback, clique→conteúdo pintado, LCP, CLS, INP, peso total de imagens, mobile com rede celular, nem navegação SPA/RSC real; bytes dos CSVs são apenas o corpo das respostas HTTP consultadas. Sem ganho quantitativo atribuído a produção. As 5 amostras e execução em uma máquina compartilhada mostram a remoção da espera sintética, não um percentil confiável da experiência dos alunos. Prefetch por intenção e outras otimizações não foram adicionadas sem essa evidência.
