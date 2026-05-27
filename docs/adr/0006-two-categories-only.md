# ADR 0006 — Two categories only: Jobb and Privat

**Status:** Accepted — supersedes the earlier four-category model (Arbeid / Personlig / Helse / Reise)
**Date:** 2026-05-23 (backfilled)

## Context

The planner originally had four categories: **Arbeid**, **Personlig**, **Helse**, **Reise**. In practice Maria filtered by "is this work or is this personal?" and never by "is this health vs. travel". The extra categories added visual noise (more color chips, more dropdown options) without informing any decision.

## Decision

Two categories only:

- **Jobb** (`arbeid`) — slate blue accent (`--work`)
- **Privat** (`privat`) — dusty rose accent (`--privat`)

The filter chip row in the UI shows **Alle / Jobb / Privat**.

Legacy data is migrated on load via `_LEGACY_CAT_MAP`: `personlig`, `helse`, and `reise` all collapse to `privat`. CSS variables for the legacy categories (`--personlig`, `--helse`, `--reise`) are still defined so old exports render acceptably if reimported.

## Consequences

- **Pros**
  - Cleaner UI, fewer chips, less visual noise.
  - Aligns with how Maria actually thinks about her time.
  - Migration is automatic — no manual cleanup of old projects.
- **Cons / risks**
  - We lose the ability to filter by Helse or Reise specifically. If Maria ever wants that, project templates (`category` field) and project tags would be the better mechanism.
  - Old JSON backups carry the legacy category strings. The migration runs on every load, so this is safe — but worth remembering when reading raw backup JSON.

## Alternatives considered

- **Keep four categories, hide them behind an "advanced" toggle.** Rejected: complicates the UI for a feature she doesn't use.
- **Tags instead of categories.** Rejected for now — too much UX work to introduce a tag system. Could be revisited.
