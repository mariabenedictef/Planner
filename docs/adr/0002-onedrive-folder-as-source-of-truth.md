# ADR 0002 — OneDrive folder as project home

**Status:** Accepted
**Date:** 2026-05-23 (backfilled)

## Context

Maria already uses Microsoft 365 + OneDrive for work and personal files. The planner needs to live somewhere that:

- syncs automatically between her work PC and iPhone
- is backed up without manual work
- she can find without thinking
- doesn't require yet another account, app, or login

## Decision

The Planner project lives in **`C:\Users\mfblu\OneDrive - Bluefront Equity AS\Claude\Planner\`**. This folder is the single source of truth on disk. OneDrive sync handles cross-device file replication. Manual JSON exports go into `backups/` inside the same folder.

## Consequences

- **Pros**
  - Maria opens OneDrive on her iPhone, taps `index.html`, and the planner runs. No deploy step.
  - File-level versioning comes free via OneDrive history.
  - Claude has read/write access to this exact folder through Cowork, so updates land in the same place Maria will see them.
- **Cons / risks**
  - OneDrive sync conflicts are possible if she edits `index.html` in two places at once. Mitigated by Claude being the only editor of `index.html` itself; runtime state lives in `localStorage`, not the file.
  - The path contains the Bluefront tenant name. If Maria changes employer the path moves — but the relative structure of the folder doesn't change.

## Alternatives considered

- **GitHub repo + GitHub Pages.** Listed as a possible v2 to enable real PWA install on iPhone. Not chosen as primary because it requires git literacy and adds a deploy step.
- **Local-only (Desktop folder).** Rejected: no cross-device.
- **iCloud Drive.** Rejected: Maria's primary stack is Microsoft.
