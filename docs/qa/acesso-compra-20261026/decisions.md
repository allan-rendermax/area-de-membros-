# SDD ledger — plan: docs/superpowers/plans/2026-10-26-acesso-compra-discreto.md

Base: 611aac7. Branch codex/compra-acesso-ui. Spec/plan d0710a9. User approved pilot and explicitly delegated questions/plan approval/execution.

## Preflight

| Tasks | Produces / consumes or internal check | Result |
|---|---|---|
| 1 + 2 | PurchaseNavigation and memberResourceLabel signatures consumed by UI | Exact types/signatures agree. Serial execution; no shared writable file conflict. |
| 1 | New pure files, tests exercise functions and safe inputs | Consistent; projectContextualLibrary reused without altering homepage. |
| 2 | Optional UI props match default-preservation tests | Consistent; carousel always default protects homepage; overflow only post-purchase. |
| 2 | Empty product branch vs main renderer | Both explicitly included; must check no-content sidebar as well. |
| 1 + validation | PDF technical labels retained only in old lower-level helper | Member rendering must call wrapper; tests target user-visible text, not URL format. |

Ruling: Do not encode the pilot's four-document inventory in code — no generic authoritative inventory metadata exists — costs omission of the detailed count until catalog supplies it, prevents false promises on other products.
Ruling: Interpret removal of PDF/PDFs as member presentation, leaving technical MIME/URLs/extensions and admin unchanged — preserves working delivery — costs remaining technical filenames in external download viewers.
Ruling: Deliver committed isolated implementation and local QA without production publication — implementation/testing authorized, deployment not requested — costs a separate publication step.

Baseline: 162 files, 1291 tests passing (npm test -- --maxWorkers=2 --testTimeout=20000), 81.85s. npm ci reported existing dependency advisories; dependencies not modified.

Task 1: in progress; base d0710a9.

Task 1: complete (commits d0710a9..1d102e1, review clean). Reviewer review_purchase_helpers approved spec+quality. Module-level/home runtime checks deferred to integrated validation; only four new helper/test files changed, no callers until task2. Report contains command, expected RED failure and GREEN counts; controller will run integrated suite.
Task 1: minor (deferred): pre-existing Vite config-loader warning; no dependency/config changes in scope.
Task 2: in progress; base 1d102e1. Mobile must keep title before the compact purchase navigation, as in approved pilot.

Task 2 scope extension: existing tests community-whatsapp.test.ts, content-routes.test.ts, contextual-library.test.ts, resources.test.ts may update intentional copy/selectors (PDF labels, named return, acquired shelf title). Maintain behavioral assertions and homepage expectations. Implementer reported 410 pass/6 old-expectation failures before update.

Task 2: fix round 1/5 (lint4 errors, mobile roles, React act global cleanup, content growth test; commits289b008..b554ff5). Implementer focused6 tests pass, tsc clean, lint0errors3baselinewarnings. Re-review pending.

Task 2: complete (1d102e1..b554ff5). Scoped re-review rereview_purchase_ui: all findings addressed, no new breakage. Integrated browser: 18 checks pass including home text/link/geometry/font equivalence, 320/390, standalone/refunds, preview one/all, named return and simulated material opening.
