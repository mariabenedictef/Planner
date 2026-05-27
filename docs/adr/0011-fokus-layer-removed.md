# ADR 0011 — Fokus layer removed

**Status:** Accepted
**Date:** 2026-05-26
**Supersedes:** [ADR 0008](0008-fokus-layer-optional.md)

## Context

ADR 0008 made the Fokus layer (yearly / quarterly / monthly focus text + Sunday weekly reflection) opt-in and conditionally rendered — empty by default, no visual cost when unused. After two weeks of using the planner, Maria found she never opened the Fokus tab and the optional layer had become pure cognitive overhead: one more menu item, one more concept, one more thing to feel guilty about not using.

She asked: "Jeg ønsker ikke Fokus som en del av Planner lenger, jeg har ikke behov for det."

## Decision

The Fokus view and all its renderings are removed from the planner:

- `renderFokus()` function deleted.
- `fokusStripHTML()` helper deleted along with its 5 inline callers across the Hjem / Måned / Uke / Dag / Agenda / Årsoversikt / Prosjekter views.
- The `home-focus` widget inside the Hjem view is removed.
- The Fokus entry is removed from the mobile "Mer" menu.
- `I18N.views.fokus` is removed.
- The Sunday review nudge IIFE (`reviewNudge`) is removed.
- Related CSS rules (`.home-focus`, `/* Fokus strip */`) are removed.

**Migration in `loadState`:** old saved state with `view: 'fokus'` or `view: 'strategy'` (the even older internal name) is mapped to `view: 'home'`.

**Data preservation:** `state.yearFocus`, `state.quarterFocus`, `state.monthFocus`, and `state.reviews` are *kept* in localStorage and JSON exports. They're no longer rendered anywhere, but they aren't deleted either. If Maria changes her mind in the future, the data is still there. The cost is a few empty objects in JSON exports.

## Consequences

- **Pros**
  - Less code, less surface area. ~200 lines of `index.html` removed.
  - One less menu concept for Maria. Cleaner mental model.
  - No future drift between "Fokus exists in code" and "Fokus is unused in practice."
- **Cons / risks**
  - If Maria later wants weekly reflection or yearly themes, we have to bring back the rendering. Data is preserved, so the path back is just "restore the renderer."
  - The retained data fields in `state` add a small amount of dead weight to JSON exports. Acceptable.
  - Anyone reading the planner code who finds `state.yearFocus` and wonders what it's for will need to read this ADR or CONTEXT.md to find out. That's the cost of preserving data without code.

## Alternatives considered

- **Hide the tab, keep the code.** Rejected: leaves dormant code with no visible owner. Better to remove and document.
- **Delete the data fields too.** Rejected as a destructive choice without explicit consent. Preserving is reversible; deletion is not.
- **Move Fokus to a separate "advanced" toggle.** Rejected: just defers the same decision.
