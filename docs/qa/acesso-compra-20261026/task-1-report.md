# Task 1 report

Status: DONE
Commit: 1d102e1 — feat: add owned purchase navigation and member material labels

## Files
- src/lib/membros/purchase-navigation.ts
- src/lib/content/member-resource-label.ts
- tests/membros/purchase-navigation.test.ts
- tests/membros/member-resource-label.test.ts

## Interfaces and behavior
buildPurchaseNavigation(input: ContextualInput, currentProductId: string, storeSlug: string, preview?: PreviewContext, complementScenario?: string): PurchaseNavigation | null
Returns the existing owned projection group containing the current product, with principal followed by its acquired complements. Returns null for missing current or fewer than two products. Encodes store/product slug segments and preserves the existing preview helper behavior. Only complements receive backParent. No projection/access mutation.

memberResourceLabel(item: Pick<Item, 'kind' | 'url' | 'title'>, productTitle?: string): { typeLabel: string; actionLabel: string }
Delegates detection to resourceLabel; only PDF becomes Atlas / Abrir Atlas, Guia / Abrir Guia, or Material digital / Abrir material. Searches item title before product title, using word boundaries. All other resource labels/actions remain intact.

## RED
Command: npx vitest run tests/membros/purchase-navigation.test.ts tests/membros/member-resource-label.test.ts
Exit 1; 2 failed suites / no tests collected. Both failed specifically because the new production modules did not yet exist:
- Cannot find package '@/lib/content/member-resource-label'
- Cannot find package '@/lib/membros/purchase-navigation'
Duration 150ms.

## GREEN
Command: npx vitest run tests/membros/purchase-navigation.test.ts tests/membros/member-resource-label.test.ts tests/access/contextual-complements.test.ts tests/membros/resource-label.test.ts
Exit 0; 4 test files passed, 32 tests passed. Duration 185ms.
Coverage includes current principal/complement, acquired siblings, unpublished/foreign products and relations, removed and duplicate relations, deterministic shared parents, explicit includeDrafts, encoded paths, simulation/complement preview parameters, immutable input, item-title priority, generic fallback, malformed/query-only URLs, editable formats and link/video preservation.

## Self-review
Read AGENTS.md and bundled Next project structure documentation before code. Helpers are pure TypeScript and introduce no Next-specific APIs. Confirmed ItemKind includes video. Reviewed staged files and git diff --cached --check (pass). Only the four assigned files committed. Existing home, projection, resource-label, authentication, storage, access and payments untouched. Existing unrelated untracked artifacts left intact.

## Concerns
No implementation concerns. Existing Vite configuration warning appears in RED and GREEN: ESM syntax in CommonJS-loaded vitest.config.ts unsupported by future native configLoader default. No config changes made. Full suite intentionally delegated to controller per assignment; focused regression suite is green. This report lives in ignored .superpowers and is not part of the commit.
