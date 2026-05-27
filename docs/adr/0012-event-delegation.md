# ADR 0012 — Event delegation via HANDLERS map

**Status:** Accepted
**Date:** 2026-05-26

## Context

The original rendering pattern was: build HTML strings with `onclick="fnName('${arg}')"` attributes and expose every handler as `window.fnName = (...) => {...}`. The architecture review on 2026-05-23 flagged this as the largest code-smell in the codebase — 76 separate `window.*` assignments, polluting the global namespace, with the entire call graph hidden inside template-literal strings.

## Decision

A single delegated click listener on `document` dispatches to handlers stored on a module-local `HANDLERS` object. HTML templates use either:

- The `act(name, ...args)` helper, which produces `data-action="name" data-args='[...]'` (preferred for new code), or
- A direct `data-action="name" data-args='[...]'` attribute (used by the existing converted code).

The listener parses `data-args` as JSON (with `&#39;` → `'` un-escaping for HTML-safety), then calls `HANDLERS[action].apply(null, [...args, ev, t])` — handlers see their original positional args plus the event and the matched element as trailing arguments.

```js
const HANDLERS = {};
function act(name, ...args){
  const a = args.length ? ` data-args='${JSON.stringify(args).replace(/'/g, "&#39;")}'` : '';
  return `data-action="${name}"${a}`;
}
document.addEventListener('click', (ev) => {
  const t = ev.target.closest && ev.target.closest('[data-action]');
  if (!t) return;
  const fn = HANDLERS[t.dataset.action];
  if (typeof fn !== 'function') return;
  let args = [];
  if (t.dataset.args) {
    try { args = JSON.parse(t.dataset.args.replace(/&#39;/g, "'")); }
    catch (err) { console.error('Bad data-args for ' + t.dataset.action, err); return; }
  }
  try { fn.apply(null, [...args, ev, t]); }
  catch (err) { console.error('HANDLERS.' + t.dataset.action + ' threw:', err); }
});
```

## Consequences

- **Pros**
  - Global namespace footprint: **76 → 1** (just `HANDLERS`).
  - Every HTML-bound handler is grep-discoverable: `grep "HANDLERS.fnName ="` finds the implementation; `grep 'data-action="fnName"'` finds every call site.
  - Errors in handlers are caught by the listener and logged with the action name — better debugging signal than silent failures.
  - No risk of name collisions with future browser globals or third-party libraries (irrelevant for single-file PWA today, but useful insurance).
- **Cons**
  - One layer of indirection between a clicked button and its handler. Slightly less obvious flow.
  - JSON.parse on every click — negligible cost but technically present.
  - Inline-expression onclicks (e.g., `onclick="state.settings.view='X';render()"`) and DOM-API onclicks (e.g., `document.execCommand('bold')`) were left as-is — they don't go through HANDLERS and don't pollute globals, so converting them would be pure churn.

## Verification

After deployment, a click-level smoke test confirmed:
- All 7 view buttons render and switch correctly
- Settings drawer opens
- Quick-capture FAB opens the inbox modal
- The list/kanban toggle on a project page (data-args with a string literal) correctly mutates `state.settings.projectViewMode`
- Zero console errors during view-switching across all 7 views

## Alternatives considered

- **Namespace consolidation only** (`window.H = {}` + `onclick="H.fn(...)"`) — ~30 minutes of work, 80% of the namespace benefit. Considered but rejected: keeps the call graph invisible (handler call sites still live in template-literal strings).
- **Per-element listeners** (`btn.onclick = () => ...` after innerHTML assignment) — needs to be wired up after every render. Reject: error-prone, easy to forget on some elements.
- **Status quo** — works, but every new handler adds another `window.*`. Each addition increases the risk we'll regret later.
