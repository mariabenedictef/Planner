# ADR 0016 — `taskToProject` tags the task instead of moving it

**Status:** Accepted
**Date:** 2026-06-08

## Context

The «▸ Prosjekt»-dropdown on each To Do row lets Maria associate a free task with a project. The original implementation, `HANDLERS.taskToProject`, physically moved the task: `state.tasks.splice(idx, 1)` and `p.tasks.push({...})`. In the process it:

- Assigned a new `id` (so cross-references to the original id broke)
- Preserved `title`, `due`, `endDate`, `notes`, `done`
- **Discarded** `priority` and `category`
- Made the task disappear from the To Do's list (which iterates `state.tasks`)

Maria reported: «Jeg liker ikke at To Do'sene forsvinner fra listen når jeg tilegner dem et prosjekt. Jeg ønsker en total oversikt over alt jeg må gjøre på et sted (gjerne med prosjekttag hvis det tilhører et prosjekt).» The move-semantics were an active UX barrier — she avoided tagging because tagging meant losing the task from her priority-sorted overview.

I initially proposed a rendering-only fix (Option B: leave the data alone, merge project.tasks into To Do's view). On closer reading it became clear this couldn't work well because `project.tasks` has no `priority` field — a tagged Urgent task would still lose its Urgent bucket. The right fix had to keep the task in `state.tasks` with priority intact.

## Decision

`HANDLERS.taskToProject` no longer moves the task. It sets `t.projectId = projectId` on the free task and renders. The task stays in `state.tasks` in its priority bucket, keeps its priority and category, and gains a project-tag rendered as «· prosjekt-tittel» (muted italic) in the To Do's row, Hjem Urgent panel, iPhone-Dag-dashboard, List-view, and calendar views (via `_projectTitle` propagation in `tasksOnDay`).

A companion handler `HANDLERS.untagTaskProject` removes the tag by deleting `t.projectId`. It's wired to the project-tag span itself — clicking the tag removes it.

**Data model after this change:**

- `state.tasks`: array of free-floating tasks. May have an optional `projectId` field pointing at a project.
- `project.tasks`: array of project-owned subtasks (created via «+ Ny» on the project page). Unchanged.

A project can have subtasks in **both** places. See ADR 0017 for how they're merged in the project view.

**Legacy behaviour handled:**

- Tasks that were moved into `project.tasks` before this change stay there. They render on the project page as before. No migration attempts to «un-move» them, because we don't have the original `id`, `priority` or `category` any longer.

## Consequences

- **Pros**
  - Total overview in To Do's is preserved. Priority buckets stay intact when tagging.
  - Cheap: one field mutation instead of splice+push.
  - Reversible: click the project-tag on any row to untag.
  - Priority and category are preserved through the tag operation. Neither is lost.
  - Sync-safe: `projectId` is an additive field. Old iPhone installations with pre-2026-06-08 app.js will silently ignore it in render but preserve it in localStorage, so no data is lost when devices with different app versions sync via KV.
- **Cons / risks**
  - **Two conceptually different associations coexist** — «subtask of project» (in `project.tasks`, owned by the project) vs. «tagged to project» (in `state.tasks`, independent but visible from project). Anyone reading the code has to keep both paths in mind. Rationale for both: subtasks are for genuinely project-owned steps that only make sense inside that project (e.g. «Lag Save-the-Date-mal»); tagged free tasks are for cross-cutting reminders that live in the priority-bucket flow but also happen to belong to a project.
  - **Orphan projectIds** — if a project is deleted, any `state.tasks[i].projectId` pointing at it becomes stale. Render code defensively looks up the project (`state.projects.find(p => p.id === t.projectId)`) and hides the tag when the lookup fails; nothing crashes, but the field lingers. Not urgent — the field is 15 bytes and harmless. Could be cleaned up by a batch pass in `loadState` if we ever want to.
  - **Rendering fan-out** — I initially added the tag only to `todoRowHTML`, forgetting that Hjem Urgent, iPhone Dag-dashboard, and List-view iterate `state.tasks` directly with their own render code. Maria reported the tag missing from Hjem; fix followed. The pattern «add a field on state.tasks and hope every render path picks it up» is fragile. The mitigation was to extend `tasksOnDay()` to set `_projectTitle` for tagged free tasks, so all render paths that already handle `_projectTitle` (from project subtasks) automatically work. Any *new* render path that iterates `state.tasks` still needs to remember the projectId lookup.

## Alternatives considered

- **Option B: rendering-only merge in To Do's view.** Keep `taskToProject` moving; extend `renderTodos` to also iterate `project.tasks` and show them in the priority buckets. Rejected because `project.tasks` has no `priority` field — the moved task would still land in an «Uten prioritet»-bøtte instead of Urgent. Not the behaviour Maria wanted.
- **Option C: unify all tasks in `state.tasks` with `projectId`.** Migrate `project.tasks` into `state.tasks`, delete the split. The «right» long-term data model. Rejected as too invasive for this change: it requires touching the project page renderer (which relies on `p.tasks`), the drag-reorder helpers (which currently only reorder inside `p.tasks`), and every serialisation path (JSON export, cross-device sync). A future ADR could still choose this path; nothing about ADR 0016 blocks it.
- **Keep move-semantics but preserve `priority` and `category` in the copied task.** Doesn't help — the task still disappears from To Do's, which is what Maria explicitly disliked.

## Related ADRs

- **[ADR 0017](0017-project-page-merges-tagged-tasks.md)** builds on this: since tagged tasks live in `state.tasks` not `project.tasks`, the project page has to merge both sources to show a complete task list.
