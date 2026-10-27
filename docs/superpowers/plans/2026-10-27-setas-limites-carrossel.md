# Setas nos limites do carrossel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute the single implementation task and review it before browser verification.

**Goal:** Show each carousel arrow only while more content can be scrolled in its direction, preserving all covers.

**Architecture:** Keep the shared Carousel component and its markup/styles. Measure the track's scrollLeft/clientWidth/scrollWidth after mount and on scroll, size/content changes; conditionally render each existing arrow. SSR starts with both arrows hidden until browser measurement.

**Tech Stack:** Next.js 16.4.3, React 19, TypeScript, Vitest/happy-dom; Vercel Agent Browser for browser verification.

**Spec:** User's bounded request in this chat: hide left at start, right at end, both without overflow; do not change covers. Prior instruction authorizes autonomous execution and review without confirmation.

## Global Constraints

- Modify only `src/components/membros/carousel.tsx` and add `tests/membros/carousel.test.ts`; no cover, product, access, CSS, dependency or checkout changes.
- Preserve existing 48px arrow styling, labels, mobile breakpoint, scroll step, snap behavior and reduced motion behavior.
- Work in the isolated checkout based on current `origin/main`; never overwrite the dirty original checkout.
- Browser APIs run only after mount. Disconnect observers and listeners on cleanup. No hydration-dependent initial markup.

## Review Focus

- No overflow (including an empty row): neither arrow should appear.
- Fractional scroll values/overscroll at either edge: use 1 CSS pixel tolerance, clamp maximum to zero.
- Container resize without a window resize: ResizeObserver must update availability.
- Children added/removed or resized: observers and measurements must remain current.
- Hidden controls must not be keyboard stops; preserve the visible controls' labels and focus styling.

### Task 1: Measure available scroll directions in the shared Carousel

**Files:** modify `src/components/membros/carousel.tsx`; create `tests/membros/carousel.test.ts`.

**Interfaces:** Keep `Carousel({ title, children }: { title: string; children: React.ReactNode })` unchanged. Do not add exported utilities. All consumers, including `Complemente seu material`, automatically receive the fix.

- [ ] Read AGENTS.md and the local Next.js `use-client` guide before changes. Read an existing happy-dom member component test for setup patterns.
- [ ] Add behavior tests using React `act`/`createRoot`, stub actual layout measurements on the track and emit real scroll events/ResizeObserver callbacks. Write them before production code and record expected failures. Example assertion for a track whose width is 600 and scrollWidth is 1800 at scrollLeft 0:

```ts
expect(container.querySelector('button[aria-label="Voltar em Materiais"]')).toBeNull()
expect(container.querySelector('button[aria-label="Avançar em Materiais"]')).not.toBeNull()
```

Cover initial/start, middle, end then return, no overflow/empty, fractional tolerance, container resize, changed children, child size change, cleanup, unchanged scrollBy distance and reduced motion. Tests must assert visible behavior rather than source strings.
- [ ] Run `npm test -- --maxWorkers=2 tests/membros/carousel.test.ts`; capture the failing assertions.
- [ ] Implement the minimal state and effect within Carousel. Use this measurement rule:

```ts
const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
const canScrollLeft = el.scrollLeft > 1
const canScrollRight = maxScroll - el.scrollLeft > 1
```

Gate both by `maxScroll > 1` and a nonzero clientWidth. Initial state is false/false. Schedule initial measurement with requestAnimationFrame; update on passive scroll, observe the track and its direct children with ResizeObserver, and rebind when React children change. A window resize fallback and capture-phase image load handler may be used. Return the previous state if both flags are unchanged. Cancel animation frame and disconnect/remove all subscriptions on cleanup. Keep existing track/cards untouched and conditionally render the existing arrow wrappers.
- [ ] Re-run the new test, ESLint for the changed files, and `npm test -- --maxWorkers=2 tests/membros`. Root controller will run build and browser verification, so do not duplicate the full suite.
- [ ] Self-review, commit only implementation and its tests, and write the report with RED/GREEN evidence and concerns. Do not push, deploy or spawn subagents.

## Controller verification and delivery

- Review the task diff and a final whole-branch review; resolve substantive findings.
- Build with `DEFAULT_STORE_SLUG=arquitetura` and verify via Agent Browser: a row with three fitting cards has zero arrows; a long row shows right only at start, both in middle, left only at end, then restores right on return. Resize in both directions; check mobile and keyboard. Preserve image src and styles.
- Continue the previously authorized production workflow from this chat with the isolated change, preserving any new upstream commits. Verify Vercel READY and the official area de membros after publication. Save report/screenshots in the original checkout; never publish temporary QA fixtures.
