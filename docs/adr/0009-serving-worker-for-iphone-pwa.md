# ADR 0009 — Serving worker (`worker.js`) for iPhone PWA install

**Status:** Superseded by [ADR 0010](0010-github-pages-serving.md) on 2026-05-24
**Date:** 2026-05-23

## Context

iPhone Safari can install a web page to the Home Screen as a PWA only when the page is served over **HTTPS from a real domain**. A local `file://` path won't do it.

Maria can already open `index.html` directly from OneDrive on her phone, but that opens in Safari as a tab — not as an installable app with its own icon, splash screen, and offline behavior.

To get the proper PWA install experience without setting up GitHub Pages or another hosting service, we need a tiny HTTPS endpoint that returns `index.html`.

## Decision

A dedicated Cloudflare Worker (the `worker.js` in this folder) serves the planner over HTTPS. It currently embeds the entire `index.html` as a JavaScript template literal and returns it on every GET/HEAD request:

```js
const HTML = `<!DOCTYPE html>...`; // ~5,600 lines, escaped
export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', ... } });
  },
};
```

The iPhone PWA install points to the worker's `*.workers.dev` URL.

## Consequences

- **Pros**
  - Real PWA install on iPhone — Home Screen icon, full-screen launch, offline once cached.
  - Cloudflare Workers free tier covers usage indefinitely.
  - No GitHub repo / Pages setup needed.
- **Cons / risks — currently severe**
  - `worker.js` is a **byte-for-byte copy** of `index.html` (modulo template-literal escaping). Two sources of truth, no automated drift check. **This is the highest-priority architecture issue we have today** — tracked in `docs/architecture-review-2026-05-23.md` Tier 1.
  - Each edit to `index.html` must be re-escaped and pasted into `worker.js`. Easy to forget.

## Alternatives considered

- **GitHub Pages.** Eliminates the need for a worker entirely. Mentioned in ADR 0002 as possible v2. Not chosen yet because it requires a public GitHub repo and a deploy step Maria isn't currently set up for.
- **Cloudflare R2 / Workers static assets.** Cleaner long-term but introduces `wrangler` tooling.
- **Inline include via a build step.** A `scripts/build-worker.sh` that wraps `index.html` as a template literal. Keeps both files in sync but adds a manual ritual.

## Next iteration

This ADR will likely be superseded soon. The architecture review proposes turning `worker.js` into a tiny fetching worker (~15 lines) that pulls `index.html` from a stable source on each request. When that lands, supersede this ADR with the new approach.
