# ADR 0017 — Project page merges tagged free tasks into the Oppgaver list

**Status:** Accepted
**Date:** 2026-06-09
**Depends on:** [ADR 0016](0016-taskproject-tag-not-move.md)

## Context

After ADR 0016 (`taskToProject` tags rather than moves), a project could have tasks in two places:

- `p.tasks`: subtasks created directly on the project page via «+ Ny»
- `state.tasks` with matching `t.projectId`: free tasks tagged via the To Do's «▸ Prosjekt»-dropdown

Immediately after ADR 0016 shipped, Maria noticed that the project page's «Oppgaver»-section only showed `p.tasks`. Her tagged To Do's — including all the Anteo AS ones she'd carefully tagged — were invisible from the project's own page. She had to jump back to To Do's to see the full picture. That defeated the purpose of tagging.

`renderProjectTasks(p)` was the culprit: it iterated only `p.tasks`.

## Decision

`renderProjectTasks(p)` merges two sources:

```js
const subtasks = (p.tasks || []).map(t => ({ ...t, _origin: 'sub' }));
const tagged = state.tasks.filter(t => t.projectId === p.id).map(t => ({ ...t, _origin: 'free' }));
const all = [...subtasks, ...tagged];
```

Each row is rendered with **origin-specific HANDLERS** so mutations go to the right store:

| Action | `_origin: 'sub'` (project subtask) | `_origin: 'free'` (tagged free task) |
|---|---|---|
| Toggle done | `HANDLERS.toggleProjectTask(pid, tid)` | `HANDLERS.toggleTask(tid)` |
| Edit (click title) | `HANDLERS.openProjectTaskForm(pid, tid)` | `HANDLERS.openTaskForm(tid)` |
| Delete (×) | `HANDLERS.deleteProjectTask(pid, tid)` | `HANDLERS.deleteFreeTask(tid)` |
| Drag to reorder | enabled | **disabled** (see below) |

The `_origin` field is a transient tag added at render time — it lives on the mapped object, not on the underlying task in state, and never persists.

**Drag-reorder is disabled for tagged free tasks in the project view.** Their order is meaningful in the priority buckets on the To Do's page (via `_dateThenOrderCmp`). Reordering them from the project view would require a second, separate order field for the project context — needlessly complicating the data model. The drag handle is rendered with reduced opacity to signal it. Users can still drag project subtasks (whose order is native to the project) as before.

**Empty state:** shown only when *both* sources are empty. A project with 0 subtasks but 3 tagged free tasks shows the 3 tags — no empty message.

## Consequences

- **Pros**
  - Project page now shows the complete picture. No context-switching to see what's on the plate.
  - Actions on each row route to the correct store. Toggling a tagged task's done state doesn't accidentally mutate `p.tasks`; deleting a subtask doesn't touch `state.tasks`.
  - Zero data-model change from ADR 0016. Just a render-time merge.
  - Empty-state check is now correct (was buggy before if `p.tasks` was empty but tagged tasks existed).
- **Cons / risks**
  - **Two visually-identical rows with different behaviours.** A subtask row and a tagged-task row look the same, but their × button deletes from different places, and their checkbox toggles different `done` flags. This is a semantic asymmetry that's not visible to the user. Rationale for hiding it: from Maria's mental model, «it's a task in this project» is the whole story — the underlying array doesn't matter. If it becomes confusing (e.g. she deletes what she thinks is a tag but is actually a subtask), we can add a subtle marker to the row.
  - **Task lookup by `data-task-id` alone is ambiguous.** If a subtask and a tagged task happened to share an id (they can't in practice, since `uid()` is monotonic), a `document.querySelector('[data-task-id="X"]')` would only find the first one. Not a real problem, but worth noting.
  - **Sort ordering** — `_dateThenOrderCmp` treats the two origins as one list. Subtasks with an explicit `order` field are sorted by that field within their own scope; tagged tasks may have an `order` field from their priority bucket. Merging them may produce interleaving that neither list would produce on its own. Testing showed the result is «date first, then whatever came in» — acceptable but not perfectly predictable. Would need a per-origin sort if it becomes annoying.
- **Follow-up work implied**
  - The «+ Ny» button on the project page always creates a subtask (in `p.tasks`). If Maria wanted to create a tagged free task from the project page directly, we'd need another affordance. Currently she has to add it in To Do's and then tag it — a two-step flow. Not urgent.
  - The «×» delete button on a tagged row *deletes the task entirely*, not just untags it. To untag she has to click the project-tag chip in the To Do's view. Two different ways to «remove from project» is a UX rough edge — worth watching if she reports it.

## Alternatives considered

- **Only merge in the empty case** — show tagged tasks only if `p.tasks.length === 0`. Rejected — half-visibility is worse than no visibility.
- **Separate section for tagged tasks** — «Prosjekt-oppgaver» + «Tagget herfra». Rejected because it multiplies UI surface without giving Maria a real choice; she doesn't care about the underlying array, she cares about the task list.
- **Migrate all `p.tasks` into `state.tasks` with `projectId`** (see also ADR 0016's «Option C»). Would unify the two paths. Rejected here for the same reasons as in ADR 0016 — too invasive for what is fundamentally a render-layer fix. Nothing in ADR 0017 blocks a future migration.
- **Add drag-reorder for tagged tasks in the project view** — would require a second order field or a scope-specific order table. Rejected as premature; not yet requested.

## Related ADRs

- **[ADR 0016](0016-taskproject-tag-not-move.md)** — the tag-not-move change that created the two-source situation.
- **[ADR 0012](0012-event-delegation.md)** — the HANDLERS dispatch pattern used to route per-origin actions.
