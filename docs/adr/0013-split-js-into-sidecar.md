# ADR 0013 — JavaScript split into `app.js` sidecar (supersedes ADR 0001's single-file aspect)

**Status:** Accepted
**Date:** 2026-05-26
**Supersedes (partially):** [ADR 0001](0001-single-file-html-pwa.md)

## Context

ADR 0001 chose a single `index.html` containing HTML, CSS, and JavaScript inline. The reasoning was: no build step, no tooling, easy to inspect and copy. At ~800 lines, this was a clean choice.

By 2026-05-26 the file had grown to 5,624 lines, of which 4,553 were JavaScript. At that scale:

- Reading any non-trivial function required scrolling through thousands of lines of unrelated code.
- Grep results across HTML attributes, CSS rules, and JavaScript were intermixed.
- Editing was slower for Claude (longer file = bigger context per edit) and harder for any human reading the code.
- The original argument that "Claude can read the whole thing in one go" stopped being true — Claude was using grep and ranged reads, not reading the file top-to-bottom.

The single-file constraint had stopped paying off.

## Decision

Split the JavaScript into a sidecar file: **`app.js`** in the same folder as `index.html`. The HTML now contains exactly:

```html
<script src="app.js"></script>
```

right before `</body>`.

Both files live in the same folder and are pushed to GitHub together. GitHub Pages serves them from the same path. The `file://` fallback (double-clicking `index.html` from OneDrive) still works because browsers resolve relative `src` paths against the HTML's location.

**No build step was introduced.** This is still strictly two files plus the browser's native script loading.

## Consequences

- **Pros**
  - `index.html` is now 1,070 lines — mostly HTML + CSS. Readable end-to-end.
  - `app.js` is 4,553 lines of pure JavaScript. Greppable, navigable, editable without scrolling past unrelated markup.
  - Each file has a single concern (structure+styling vs. behavior).
  - Browser caches `app.js` separately from `index.html`. If only `app.js` changes, the HTML doesn't need to redownload. Marginal performance benefit but real.
- **Cons / risks**
  - **Two files to keep in sync** when copying or sharing. We must always copy/upload them together to GitHub. Mitigation: documented here and in CONTEXT.md.
  - **The `file://` path still works**, but if Maria copies just `index.html` somewhere without `app.js`, it'll be broken. The most natural copy operation (right-click → copy folder) handles both correctly.
  - The "single-file PWA" promise in ADR 0001 is no longer literally true. This ADR explicitly supersedes that aspect.

## What's preserved from ADR 0001

- No build step.
- No bundler, no transpiler, no `node_modules`.
- No npm packages — anything we need we still inline (in `app.js` now).
- Open the planner by visiting the URL or double-clicking `index.html`. Same as before.

## What changed

- "One file" → "Two files: index.html (1,070 lines structure+CSS) + app.js (4,553 lines behavior)".

## Alternatives considered

- **Keep everything in one file.** Rejected: the single-file constraint had become net negative.
- **Multiple JS files (e.g., split by concern).** Considered, but premature. One JS file is the simplest improvement; subdividing further can come later if `app.js` grows past, say, 8,000 lines.
- **CSS extracted to `app.css` too.** Considered, deferred. The CSS in `index.html` is well-scoped at ~1,000 lines and isn't the bottleneck. Can be extracted later if it grows.
