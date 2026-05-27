# ADR 0008 — Fokus layer is optional and conditionally rendered

**Status:** Superseded by [ADR 0011](0011-fokus-layer-removed.md) on 2026-05-26
**Date:** 2026-05-23

## Context

Most "year planner" apps push a strategic layer hard: yearly themes, quarterly OKRs, monthly intentions, weekly reviews. Maria appreciates the *idea* but doesn't always want to look at it. When she's deep in week-level execution, empty "Yearly Theme:" boxes are noise.

## Decision

The **Fokus** layer (formerly called "Strategi") covers per-year, per-quarter, per-month focus text plus a weekly reflection. All four are **optional**. Rendering rules:

- The Fokus view itself (`state.settings.view === 'strategy'`) always shows all four fields, empty if unused.
- On other views (`day`, `week`, `month`, `overview`), the relevant focus is rendered as a small banner above the view **only if** it has content. Empty focus = no banner. Zero visual cost when unused.

## Consequences

- **Pros**
  - Adopting strategic planning is opt-in, gradient, no all-or-nothing commitment.
  - When Maria does fill in a quarterly focus, it shows up everywhere it's relevant without her having to navigate to a separate page.
- **Cons / risks**
  - The conditional-rendering logic adds branches to every calendar view. Worth it; tracked in CONTEXT.md so it's not surprising.
  - "Out of sight, out of mind" — if Maria never opens the Fokus tab she may not remember it exists. Documented in `LES-MEG.md`.

## Alternatives considered

- **Always-on banner.** Rejected: cluttered when empty.
- **Tab-only (no inline banners).** Rejected: defeats the point of strategic focus informing day-to-day execution.
- **Drop it.** Rejected: Maria asked for it specifically.

## Why this was superseded

After two weeks of use, Maria found she never opened the Fokus tab and never filled in yearly/quarterly/monthly focus text. The "out of sight, out of mind" risk in the original Cons section turned out to be real. The whole layer was removed on 2026-05-26 — see ADR 0011.
