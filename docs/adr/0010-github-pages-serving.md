# ADR 0010 — GitHub Pages serves the planner (supersedes ADR 0009)

**Status:** Accepted
**Date:** 2026-05-24
**Supersedes:** [ADR 0009](0009-serving-worker-for-iphone-pwa.md)

## Context

ADR 0009 documented a Cloudflare Worker (`worker.js`) that embedded the entire `index.html` as a JavaScript template literal and served it over HTTPS so the iPhone could install the planner as a real PWA. That setup had a serious flaw: `worker.js` was a byte-for-byte copy of `index.html` (modulo template-literal escaping), creating two sources of truth that could (and would) drift. The architecture review on 2026-05-23 flagged this as the highest-priority issue in the codebase (see `docs/architecture-review-2026-05-23.md` §1.1).

Maria created a public GitHub repository for the planner and enabled GitHub Pages. The planner is now served directly from GitHub, removing the need for any worker in the serving path.

## Decision

The planner is served from **GitHub Pages** at:

**<https://mariabenedictef.github.io/Planner/>**

The public repository is <https://github.com/mariabenedictef/Planner>. Only `index.html` and a public `README.md` are pushed to the repo. All other documents (`CONTEXT.md`, ADRs, `LES-MEG.md`, `backups/`, `starter.json`, `docs/`) stay in the OneDrive folder and are not part of the public repo. This protects Maria's personal references (her name, partner, life events, employer's deal names) which appear in CONTEXT.md and the ADRs.

`worker.js` has been moved to `backups/worker-js-archived-2026-05-24.js` and is no longer deployed. The corresponding `*.workers.dev` URL is abandoned.

## Consequences

- **Pros**
  - One source of truth — `index.html`. The duplication that ADR 0009 created is gone.
  - Free git version history of every change to `index.html` (via GitHub commits).
  - Free, durable HTTPS hosting. GitHub Pages has been operating since 2008.
  - iPhone PWA install continues to work, now from a `*.github.io` URL.
  - Fewer moving parts: no Cloudflare Worker in the serving path, fewer vendor dependencies for the planner itself. (Cloudflare Workers still handle the Outlook ICS proxy [ADR 0003] and cross-device KV sync [ADR 0004] — both unaffected.)
- **Cons / risks**
  - Updates now require a two-step ritual: edit `index.html` in OneDrive (where Claude works), then upload the updated file to the GitHub repo to publish. Documented in `docs/github-pages-setup.md` § Future updates.
  - The repo is **public**. The source code itself contains no secrets (state lives in browser `localStorage`), but care must be taken not to commit anything personal. CONTEXT.md and the ADRs explicitly stay out of git.
  - One-time cost: re-install the PWA on iPhone from the new URL (the old `*.workers.dev` install will keep working but won't receive updates).

## Alternatives considered

- **Tiny fetching worker** — `worker.js` becomes ~15 lines and pulls `index.html` from a stable URL on each request. Considered, but adds back a worker that isn't strictly necessary if GitHub Pages can serve directly.
- **Cloudflare KV with a serving worker** — keeps everything in Maria's existing Cloudflare account. Considered, but introduces a manual KV push step on every update, and gives no version history.
- **Keep `worker.js`, add a build script** — solves duplication via a manual ritual rather than removing it. Considered worst-of-both-worlds.
