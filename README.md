# Planlegger

A personal planner PWA. Runs in the browser with no build step, data stored locally.

**Live app:** <https://mariabenedictef.github.io/Planner/>

## What it does

Planlegger is the project layer behind life events — weddings, trips, training plans, work initiatives — each with months of preparation, sub-tasks, drafts, people, and links. Day-to-day meetings live in Outlook; the big things live here.

## Architecture

- Two files, no build step: `index.html` (structure + CSS) and `app.js` (all behaviour). Split out of a single file in May 2026 — see `docs/adr/0013-split-js-into-sidecar.md`.
- State persists in browser `localStorage`.
- Optional cross-device sync via a Cloudflare KV worker (configured per device).
- Optional read-only Outlook calendar import via a Cloudflare ICS-proxy worker.
- Norwegian UI, Monday-start weeks, ISO week numbers.
- Architecture decisions are recorded in `docs/adr/`; dated changes in `CHANGELOG.md`.

## Install on iPhone

Visit the live URL above in Safari → Share → "Add to Home Screen". It installs as a real PWA with its own icon and offline cache.

## License

Personal project. Code is open; data is local.
