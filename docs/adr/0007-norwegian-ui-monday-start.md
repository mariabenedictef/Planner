# ADR 0007 — Norwegian UI, week starts Monday, ISO week numbers

**Status:** Accepted
**Date:** 2026-05-23 (backfilled)

## Context

Maria is Norwegian and lives in Norway. Norwegian weeks start Monday. Norwegian work life runs on ISO week numbers ("Uke 23"). Date formatting in Norway uses lower-case month names ("23. mai 2026").

US conventions (Sunday-start weeks, MM/DD dates, no week numbers) would feel foreign and slow her down.

## Decision

- All user-facing strings are **Norwegian Bokmål** (the document `lang="nb"`).
- Internal identifiers, keys, and ADR titles stay **English** so Claude can reason about code without translation overhead.
- Weeks start **Monday**. `monIdx()` in code: `(d.getDay() + 6) % 7` returns 0 for Monday.
- Week numbers are **ISO 8601** (computed in `isoWeek()`).
- Date formatting: `23. mai 2026` (lower-case month) for long form; `23. mai` for short form.
- Norwegian public holidays (`generateNorwegianHolidays()`) include Easter-relative feasts via the Anonymous Gregorian algorithm. Pre-loaded for 2026 and 2027.

## Consequences

- **Pros**
  - Reads natively to Maria. Less cognitive translation.
  - ISO weeks match her work calendar exactly — when Bluefront colleagues say "uke 23" she sees the same number.
- **Cons / risks**
  - When Claude writes new UI strings it has to write them in Norwegian — easy to forget. CONTEXT.md flags this so future sessions remember.
  - Norwegian-only is a deliberate choice. There is no English-language toggle. If that ever changes, the `I18N` object in code is already structured to support it.

## Alternatives considered

- **Bilingual UI with a toggle.** Rejected: doubles the surface area for a single-user app.
- **English UI.** Rejected: Maria's primary language for her own life is Norwegian, even though she's fluent in English.
