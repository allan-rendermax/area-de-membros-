# Task 1 — existing order bump cards

Restored ContextualComplementShelves in the content column immediately after resources and before the unchanged PathologyUpsell. Empty products render the same projected shelves after empty/upgrade state. Existing requestedOffer prompt retained; requestedSlug is not passed to shelves. No authorization, resource, catalog, dependency, DB or checkout changes.

Read platform guidelines and bundled Next.js server/client component and page conventions before implementation. Regression tests initially failed twice because shelves were absent; minimal implementation made them pass. Route coverage now includes owned access versus optional purchase, both routes, empty products, no relations/failing relations, foreign/draft exclusion, one requested prompt without initially open modal, two material resources, original banner and sidebar exclusion.

## Verification

- Targeted route tests: 15/15 pass.
- TypeScript: npx tsc --noEmit passes.
- ESLint: npm run lint exits 0 with seven preexisting unused-variable warnings outside changed files. Targeted ESLint exits 0 without warnings.
- git diff --check passes.
- Default npm test: 158 files / 1448 tests passed, 20 files / 20 tests failed with 5000ms PGlite initialization timeouts under full concurrency. No assertion failures. Failing files: admin/{atomic-mutations-sql,contextual-complements-sql,customer-deletion-sql,deletion-integrity-sql,locked-modal-sql,offer-deletion-sql,offer-groups-sql,product-complement-sql,product-deletion-sql,product-levels-sql,product-role-sql,product-versions-sql,store-community-sql,student-checkout-persistence}.test.ts; membros/{member-progress-sql,terms-sql}.test.ts; orders/{checkout-plans-sql,checkout-process,payment-identity-sql,payt-inbox-sql}.test.ts.
- Reduced concurrency full suite: npm test -- --maxWorkers=2 passes 178 files / 1469 tests. Member suite: npm test -- tests/membros --maxWorkers=2 passes 48 files / 334 tests.

## Limits / follow-up

No browser/server/deploy or external database operations. Existing local test suite uses isolated PGlite instances. Visual preview remains the parent task responsibility.

The unchanged shelf and requested-offer wrapper both use id=complementos; explicit deep links therefore contain duplicate anchor IDs. Existing prompt is shown once and shelf modals remain closed initially, per requested scope. Consider a separate anchor cleanup if desired.
