# ADR 0004 — Cloudflare KV for cross-device sync

**Status:** Accepted
**Date:** 2026-05-23 (backfilled)

## Context

The v1 cross-device sync was manual JSON export/import via OneDrive. That works but adds friction every time Maria switches between her PC and iPhone. She wanted edits on one device to appear on the other without her thinking about it.

Constraints:

- No new account for Maria.
- No data leaving infrastructure she controls.
- Survive being offline.

## Decision

Cross-device state is mirrored to a **Cloudflare KV** namespace via a dedicated Cloudflare Worker (separate from the planner-serving worker in this folder — see ADR 0009). Writes are debounced by 2500 ms after any state change. The KV worker URL and access token are stored locally per device in `state.settings.syncUrl` and `state.settings.syncToken`.

A guard prevents pushing an empty local state to the cloud — this would otherwise wipe the cloud blob the first time a device loads fresh.

## Consequences

- **Pros**
  - Maria edits on PC; iPhone catches up next time she opens the planner. No manual step.
  - KV is durable enough for a planner. Free tier covers our usage.
  - Local-first remains true: the device works fully offline; sync is opportunistic.
- **Cons / risks**
  - Two writers (PC and iPhone) editing simultaneously can lose changes — last write wins. Mitigated by the planner being mostly used by one device at a time.
  - The token is local to each device; if Maria gets a new device she has to enter it from Settings (⚙).
  - We must keep the empty-state guard healthy. If it ever breaks, a fresh device load could wipe the cloud blob.

## Alternatives considered

- **OneDrive JSON sync (manual export/import).** Kept as belt-and-braces backup, but demoted from primary sync.
- **Microsoft Graph / OneDrive file API.** Rejected: same tenant friction as Graph for Outlook.
- **Firebase / Supabase.** Rejected: another vendor, another account.
