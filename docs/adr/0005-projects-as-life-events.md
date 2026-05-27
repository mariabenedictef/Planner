# ADR 0005 — Projects-as-life-events is the central data model

**Status:** Accepted
**Date:** 2026-05-23 (backfilled)

## Context

Most planners model the world as: events, tasks, and notes. Maria already has that — Outlook does events, Microsoft To Do does tasks, iPhone Notes does notes. She did not need another version of those.

What she lacked was a home for the **big things in life** — Porto wedding, father's wedding, half marathon, apartment renovation, an investment process at work. Each one is:

- a target date months in the future
- a hidden pyramid of sub-tasks
- a draft (e.g., wedding-speech text)
- a list of people involved
- a cluster of links
- a story spanning a season of life

Treating those as a flat list of tasks loses the structure. Treating them as Outlook events loses everything except the date.

## Decision

The **Prosjekt** entity is the central noun of the data model. Other entities (events, tasks, notes, people) hang off projects — or stand alone if they're not part of one. Every view in the app is project-aware: project sub-tasks with dates appear on calendar views automatically; the Årsoversikt is essentially a project Gantt.

Projects come from a small set of **templates** (`PROJECT_TEMPLATES` in code): Reise, Bryllup-gjest, Konferanse, Trening, Investering. Templates seed a project with typical tasks offset from the target date.

## Consequences

- **Pros**
  - Maria's mental model — "the big things" — maps directly onto the data model. Lower friction.
  - Sub-tasks appear on calendars without double entry.
  - Templates make starting a new project a 30-second action.
- **Cons / risks**
  - Standalone tasks and one-off events still exist. The codebase has to handle both project-scoped and free-floating items, which adds branches.
  - Projects can accumulate stale tasks. The To Do's view + the architecture-pass discipline mitigate this.

## Alternatives considered

- **Flat task list with tags.** Rejected: loses the narrative arc of a project.
- **One Notion-style block tree.** Rejected: too heavy, doesn't surface on a calendar.
