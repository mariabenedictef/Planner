# ADR 0015 — `loadState` always strips `merged.settings`, unconditionally

**Status:** Accepted
**Date:** 2026-05-27

## Context

On 2026-05-26 we split the flat `state.settings` object into two new top-level nodes: `state.ui` (view, anchors, theme, filters) and `state.sync` (icsUrl, syncUrl, syncToken, lastWeeklyExport). The migration in `loadState` translated pre-2026-05-26 blobs by reading `parsed.settings.X` and writing into `merged.ui` / `merged.sync`, then deleting `merged.settings`.

The migration was guarded by:

```js
if (parsed.settings && (!parsed.ui || !parsed.sync)) { ... delete merged.settings; }
```

The intent was "only run migration if the blob is from before the split." But this condition has a quiet failure mode: once a blob has *both* `parsed.settings` AND `parsed.ui` (or `parsed.sync`), the migration block doesn't run — and `merged.settings` is never deleted. The vestigial field hangs around forever, copied through every save.

This isn't theoretical. Round 2 of the audit (2026-05-27, earlier the same day) found two bugs where `pullFromRemote` and `restoreCloudBackup` had been writing sync credentials to `state.settings` (a regression from the split). When those bugs ran, they produced blobs containing both a populated `state.settings.syncUrl` AND a populated `state.sync.syncUrl`. The migration condition saw `parsed.sync` exists → skipped → vestigial `settings.syncUrl` carried forward.

The condition was overly conservative. `state.settings` is dead schema: no code path *reads* from it. There's no scenario where we want to preserve it across `loadState`.

## Decision

Always strip `merged.settings` after merge, unconditionally:

```js
if (parsed.settings) {
  if (!parsed.ui || !parsed.sync) {
    // Legacy fold: fold parsed.settings.X into merged.ui/merged.sync,
    // letting parsed.ui/parsed.sync take precedence where they exist.
    ...
  }
  delete merged.settings;
}
```

The inner condition (`!parsed.ui || !parsed.sync`) still gates the *legacy fold-in*: we only need to translate old fields if the new fields are missing. But the outer condition just checks whether `parsed.settings` exists at all, and the `delete` runs in either branch.

The test suite asserts both `state.settings === undefined` after `loadState` for a blob with both `settings` and `ui`/`sync` present, and that legacy folds still preserve `parsed.ui.X` precedence where applicable.

## Consequences

- **Pros**
  - Self-healing: any blob that ever contained `settings` (legacy or accidental regression) gets cleaned on next load.
  - One less concept for future code to remember. `state.settings` doesn't exist after `loadState`, full stop.
  - Round-2 sync-credential regression class is closed off at the migration level — even if a future bug writes to `state.settings`, the next load wipes it.
- **Cons / risks**
  - **`saveState` still serializes whatever's on `state`**, so if some live code path writes to `state.settings` between `loadState` and `saveState`, that data will be persisted *and then* stripped on the next load. The data loss window is one session. Mitigation: there's no live code that writes to `state.settings`, and the test suite asserts this. The 2026-05-27 round-2 regression was caught precisely because we look for `state.settings.X` references in code review.
  - **Imported JSON backups** from before 2026-05-26 carry `settings`. The `importData` handler already re-runs `loadState`, so the strip runs there too. Confirmed in the jsdom test suite (2 migration edge-cases).
  - **Future split-and-rename refactors should follow the same pattern**: always strip the old field unconditionally; only fold-in when the new fields are missing. Worth a one-liner in CONTEXT.md if we do another split.

## Alternatives considered

- **Keep the conservative condition.** Status quo. Rejected — the round-2 incident showed the failure mode is real and easy to miss.
- **Delete the migration block entirely.** Tempting since the migration shipped ~24 hours ago and most active users have already migrated. Rejected because: (a) iPhone PWA installs might still have a stale localStorage from before the migration ran, (b) JSON exports from before 2026-05-26 are still importable and need the fold-in, (c) the migration is ~12 lines — removing it saves nothing meaningful.
- **Add a `meta.version` gate** (e.g., "only run if `version < 4`"). Considered, but the field-existence check (`if (parsed.settings)`) is simpler and more robust — it doesn't matter how the field got there, if it's there we strip it. Version gates also tend to lie when blobs are hand-edited or imported across versions.
- **Schema-validate `merged` against a whitelist** and drop anything not in the whitelist. The "right" long-term solution, but premature. We have 14 top-level state keys, all known. A general schema validator is a project unto itself.
