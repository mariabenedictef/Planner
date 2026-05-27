# ADR 0001 — Single-file HTML PWA, no build step

**Status:** Partially superseded by [ADR 0013](0013-split-js-into-sidecar.md) on 2026-05-26
**Date:** 2026-05-23 (backfilled — decision originally made earlier)

## Context

Maria wanted a personal planner for the next ~1.5 years that:

- runs on her PC (Edge/Chrome) and iPhone
- has no server she has to maintain
- can be edited and resaved without setting up Node, npm, a build pipeline, or a dev environment
- syncs through tools she already pays for (OneDrive)

She is not a developer and does not want to manage tooling. Claude is the maintainer; Claude needs the codebase to be inspectable and editable in a single tool call.

## Decision

The entire planner lives in **one `index.html` file** — HTML, CSS, and JavaScript inline. No bundler, no transpiler, no `node_modules`, no build step. Open it with a double-click; it just works.

A PWA manifest is inlined via `data:` URI so the iPhone Home Screen install path works without serving extra files.

## Consequences

- **Pros**
  - Maria can open the file, run it, back it up by copying it. No "how do I run this" friction ever.
  - Claude can read the whole codebase in one Read call and edit with surgical precision.
  - Trivially portable: copy to any folder, any device, any browser.
- **Cons / risks**
  - The file grows large (currently several thousand lines). Risk of ball-of-mud — mitigated by periodic architecture passes (see `improve-codebase-architecture` discipline) and by keeping `CONTEXT.md` accurate.
  - No code splitting; full file ships on every load. Acceptable because the file is local-first.
  - No npm libraries — anything we need we inline.

## Alternatives considered

- **React + Vite + deploy to Vercel.** Rejected: introduces a build chain Maria can't easily inspect or fix, and a hosting dependency.
- **Multiple HTML / JS files.** Rejected: makes copy/move operations error-prone for a non-developer; OneDrive sync handles single files more reliably.
- **A native iOS/Mac app.** Rejected: 1.5-year horizo