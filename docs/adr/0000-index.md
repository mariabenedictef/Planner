# ADR Index — Planlegger

Architecture Decision Records. Each ADR captures *why* a structural choice was made. When that "why" changes, supersede the ADR rather than editing it in place.

| # | Title | Status |
|---|---|---|
| [0001](0001-single-file-html-pwa.md) | Single-file HTML PWA, no build step | Accepted |
| [0002](0002-onedrive-folder-as-source-of-truth.md) | OneDrive folder as project home | Accepted |
| [0003](0003-cloudflare-worker-for-outlook-instead-of-graph.md) | Cloudflare Worker proxies Outlook ICS (not Microsoft Graph) | Accepted |
| [0004](0004-cloudflare-kv-for-cross-device-sync.md) | Cloudflare KV for cross-device sync (not iCloud / Graph) | Accepted |
| [0005](0005-projects-as-life-events.md) | Projects-as-life-events is the central data model | Accepted |
| [0006](0006-two-categories-only.md) | Two categories only: Jobb and Privat | Accepted (supersedes earlier four-category model) |
| [0007](0007-norwegian-ui-monday-start.md) | Norwegian UI, week starts Monday, ISO weeks | Accepted |
| [0008](0008-fokus-layer-optional.md) | Fokus layer is optional and conditionally rendered | Superseded by 0011 |
| [0009](0009-serving-worker-for-iphone-pwa.md) | Serving worker (`worker.js`) for iPhone PWA install | Superseded by 0010 |
| [0010](0010-github-pages-serving.md) | GitHub Pages serves the planner | Accepted |
| [0011](0011-fokus-layer-removed.md) | Fokus layer removed | Accepted |
| [0012](0012-event-delegation.md) | Event delegation via HANDLERS map | Accepted |
| [0013](0013-split-js-into-sidecar.md) | JavaScript split into `app.js` sidecar | Accepted (partially supersedes 0001) |
| [0014](0014-multiday-bar-via-css-bleed.md) | Multi-day events as continuous bar via CSS margin-bleed | Accepted |
| [0015](0015-always-strip-settings.md) | `loadState` always strips `merged.settings`, unconditionally | Accepted |

## How to add a new ADR

1. Copy an existing ADR file. Name it `NNNN-short-kebab-title.md`.
2. Fill in: **Context** (what was true when we decided), **Decision** (what we chose), **Consequences** (what we accept by choosing this), **Alternatives considered**.
3. Append a row to the table above.
4. Status starts as `Proposed`. Becomes `Accepted` when implemented. Becomes `Superseded by NNNN` when replaced — do not delete superseded ADRs.

## Status vocabulary

- **Proposed** — under discussion
- **Accepted** — in effect
- **Superseded by NNNN** — replaced by a newer ADR
- **Deprecated** — no longer in effect but kept for historical record
