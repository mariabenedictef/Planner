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
| [0014](0014-multiday-bar-via-css-bleed.md) | Multi-day events as continuous bar via CSS margin-bleed | Accepted (amended by 0027) |
| [0015](0015-always-strip-settings.md) | `loadState` always strips `merged.settings`, unconditionally | Accepted |
| [0016](0016-taskproject-tag-not-move.md) | `taskToProject` tags the task (sets `projectId`) instead of moving it | Accepted |
| [0017](0017-project-page-merges-tagged-tasks.md) | Project page merges tagged free tasks into the Oppgaver list | Accepted |
| [0018](0018-render-view-section-helpers.md) | Store render-visninger splittes i seksjons-helpere | Accepted |
| [0019](0019-wikilinks-rendered-not-stored.md) | Wikilinks rendres ved visning, aldri i lagret innhold | Accepted |
| [0020](0020-note-url-whitelist.md) | Notat-sanitizer bruker URL-whitelist, med unntak for innlimte raster-bilder | Accepted |
| [0021](0021-sanitize-per-tag-not-whole-string.md) | Notat-saniteringen opererer per tag, aldri på hele strengen | Accepted (utvider 0020) |
| [0022](0022-state-never-degrades-silently.md) | Lasting og lagring av state skal aldri degradere stille | Accepted |
| [0023](0023-inputs-commit-on-input-not-blur.md) | Felt lagrer på `input` (strupet); vi stempler ikke suksess vi ikke kan bekrefte | Accepted (utvidet 2026-08-11: `ics-url` var oversett) |
| [0024](0024-list-view-removed.md) | List-visningen fjernet | Accepted |
| [0025](0025-rrule-support-boundary.md) | Hva RRULE-ekspansjonen støtter — og hva den bevisst ikke støtter | Accepted (TZID + sommertid superseded by 0028) |
| [0026](0026-wikilink-autocomplete.md) | Wikilink-autocomplete skriver kildeformat, ikke markup | Accepted |
| [0027](0027-multiday-row-segments.md) | Flerdagsbar segmenteres per uke-rad, med etikett på hvert segment | Accepted (amends 0014) |
| [0028](0028-ics-timezones-per-occurrence.md) | ICS-tider konverteres per forekomst, med TZID | Accepted (avgrenser 0025) |
| [0029](0029-render-preserves-focus.md) | `render()` bevarer fokuserte felt; redigeringer utenfor state lagres først | Accepted (avløser forkastet alternativ i 0023) |
| [0030](0030-snapshots-protect-user-data-not-cache.md) | Øyeblikksbilder utelater Outlook-cachen; ringene beskjæres på bytes | Accepted (utvider 0022) |
| [0031](0031-audit-fixes-newest-snapshot-floor-and-loud-failures.md) | Gulv for nyeste øyeblikksbilde, én dør for øyeblikksbilder, stempling bare av det som skjedde | Accepted (retter 0030, utvider 0022) |
| [0032](0032-outlook-cache-is-device-local.md) | Outlook-cachen er enhetslokal (egen nøkkel, ute av sky-blobben); gjentakelser bevarer dagen i måneden | Accepted (fullfører 0030/0031, retter 0025 sin andre kodesti) |
| [0033](0033-project-cards-show-todo-list.md) | Prosjektkortene viser To Do-lista (3, tidligste frist først); `projectTasksMerged` er én kilde for kort og side | Accepted (utvider 0017) |
| [0034](0034-tabs-always-land-on-view-start.md) | Fanene lander alltid på startsiden i visningen (`switchView` nullstiller `openProjectId`); `openProject` er den ene døren inn | Accepted |

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
