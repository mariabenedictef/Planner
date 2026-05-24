# Planlegger

A personal planner PWA. Single HTML file, runs in the browser, data stored locally.

**Live app:** _(will be filled in once GitHub Pages is enabled)_

## What it does

Planlegger is the project layer behind life events — weddings, trips, training plans, work initiatives — each with months of preparation, sub-tasks, drafts, people, and links. Day-to-day meetings live in Outlook; the big things live here.

## Architecture

- Single `index.html` — HTML, CSS, JavaScript inline. No build step.
- State persists in browser `localStorage`.
- Optional cross-device sync via a Cloudflare KV worker (configured per device).
- Optional read-only Outlook calendar import via a Cloudflare ICS-proxy worker.
- Norwegian UI, Monday-start weeks, ISO week numbers.

## Install on iPhone

Visit the live URL above in Safari → Share → "Add to Home Screen". It installs as a real PWA with its own icon and offline cache.

## License

Personal project. Code is open; data is local.
