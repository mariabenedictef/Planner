# ADR 0014 — Multi-day events as continuous bar via CSS margin-bleed

**Status:** Accepted
**Date:** 2026-05-27

## Context

Multi-day events (a wedding trip, a conference, a sprint) have been part of the data model since the start — `event.endDate` and `task.endDate` are first-class fields, and `eventCoversDay()` correctly identifies which days a given event spans. But the month view rendered them as separate boxes per day with little arrow glyphs (`↳` on continuation days, `→` on first/middle days) to hint at the continuation. Each cell got its own self-contained pill.

In practice this made multi-day events visually noisy and small. A four-day Porto trip looked like four unrelated entries that happened to share a title. The eye didn't immediately register them as one engagement spanning the week. With several large multi-day blocks coming up — Maria's wedding (Porto, 26 June 2027), her father's wedding weekend (Oslo, 27 June 2026), a halvmaraton-helg (September 2026) — the inability to read these as continuous engagements was starting to hurt.

Standard calendar apps (Google Calendar, Outlook, Fantastical) solve this by drawing multi-day events as one connected bar that visually spans the cells it covers.

## Decision

Render multi-day events in the month view as a continuous bar across cells within the same week-row, achieved with a **pure CSS approach using negative horizontal margins** — no absolute positioning, no overlay layer, no new DOM structure.

The mechanism, per `.ev.multi` rules in `index.html`:

- **First day of the run** (`.multi:not(.multi-cont):not(.multi-last)`) — square the right edge, extend the right margin `-9px` into the cell gap so the box visually crosses into the next cell. Shows full title text and time prefix.
- **Continuation days** (`.multi.multi-cont`) — drop the left border-radius and the left category-colored border (it would otherwise look like the bar "restarted"); extend the left margin `-9px` back into the previous cell. Text colored `--ink-muted` since it's just a placeholder.
- **Middle of a run** (`.multi.multi-cont:not(.multi-last)`) — also square the right edge and extend the right margin, same as first day. The bar passes straight through.
- **Last day** (`.multi.multi-cont.multi-last`) — extend left only, keep right border-radius.

On the JS side (`app.js`):

- `eventsOnDay()` sorts multi-day events first (`if (a._isMultiDay !== b._isMultiDay) return a._isMultiDay ? -1 : 1;`) so the continuous bar lands in the same vertical slot in every cell it spans — otherwise it would zig-zag as single-day events pushed it up or down per cell.
- Continuation cells render an HTML `&nbsp;` placeholder instead of the title, so the bar keeps its height and aligns vertically with the first-day cell. The title is still in the `title=` attribute, so hover/tap shows the full name everywhere along the bar.

The old `↳` and `→` glyph indicators (the `::before` / `::after` content rules) are removed — the visual bar replaces them.

## Consequences

- **Pros**
  - Multi-day engagements read as one event at a glance. No more "four separate Porto-tur entries"; it's one bar spanning Tuesday→Friday.
  - Maria's real Outlook recurrences automatically benefit — verified live with "Investering: Alvestad Marin AS: IC2 slidepakke" (3-day bar across Tue–Thu) and "Langhelg" (4-day bar) immediately after deploy.
  - Pure CSS — no overlay layer to maintain, no new DOM structure, no z-index battles.
  - Same data model. Same per-cell rendering. The only structural change is the sort order in `eventsOnDay()`.
- **Cons / risks**
  - **The bar breaks visually at the week boundary** (Sunday → Monday) because the cells live in different `.row` grid containers. A multi-week event will appear as two bars on consecutive rows, not one continuous bar. Standard calendar apps have the same limitation; we live with it for now. If it becomes annoying we can revisit with an absolute-positioned overlay layer (see Alternatives).
  - **Negative margins overflow the cell** — relies on `.month-grid` having `overflow:hidden` (which it does) and the inner `.row` grid letting items overflow into adjacent grid cells (which it does in standard CSS Grid). If we ever wrap cells in additional containers with `overflow:hidden`, the bars will clip. Documented here so a future refactor doesn't break it accidentally.
  - **`&nbsp;` placeholder is fragile** — if someone later tries to render an empty string instead, the cell collapses and the bar loses height. The render path in `renderMonth` is explicit about this; touch with care.

## Alternatives considered

- **Absolutely-positioned overlay layer.** A separate `<div class="multiday-overlay">` rendered above the month grid, with bars positioned in pixel coordinates spanning the days they cover. **Pros**: works across week-row boundaries (one bar can wrap Sunday→Monday). **Cons**: introduces a second rendering pass, needs to recompute on resize and DOM-mutation, fights with the existing per-cell event stacking, much more code. Rejected as overkill for the current friction level. Reserved for future iteration if the Sunday-Monday break becomes a real annoyance.
- **Span the bar via CSS Grid `grid-column: span N`.** Considered. Would require restructuring the month grid so events are siblings of `.cell` rather than children. A bigger refactor than the margin-bleed approach, and still doesn't solve the cross-row case. Not worth it.
- **Per-cell pill with strong visual grouping (matching colors, no border between, no rounded inner corners).** This is essentially what we built — the margin-bleed approach is the same idea taken to its logical conclusion (zero gap = continuous bar).
- **Keep the `↳` / `→` glyphs as the only multi-day indicator.** This was the status quo before this ADR. Rejected because it never visually conveyed "this is one event spanning multiple days" — it conveyed "this entry has weird arrows."
