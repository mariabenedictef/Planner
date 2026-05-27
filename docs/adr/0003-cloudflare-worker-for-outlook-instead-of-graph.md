# ADR 0003 — Cloudflare Worker proxies Outlook ICS (not Microsoft Graph)

**Status:** Accepted
**Date:** 2026-05-23 (backfilled)

## Context

Maria wanted her Outlook calendar visible inside Planlegger as read-only events, so she can plan around real meetings without flipping apps. Two pathways exist:

1. **Microsoft Graph API** — official, near-realtime, but requires Azure AD app registration, OAuth flow, token refresh handling, and tenant admin consent. Bluefront's tenant is locked down enough that this is non-trivial.
2. **Outlook's published ICS feed** — Maria can publish her calendar at a long random URL from Outlook settings. No tenant admin involvement. Refreshes on Microsoft's side every ~1–3 hours.

The ICS URL cannot be hit directly from `file://` or `https://` browser context (CORS), so a tiny proxy is needed.

## Decision

A dedicated Cloudflare Worker at **`outlook-cal-proxy.maria-farevaag.workers.dev`** fetches the published ICS URL on demand and returns it with CORS headers. The planner parses the ICS in-browser (including RRULE expansion for `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`).

Auto-sync triggers when the planner opens if `lastSync` is older than 1 hour.

## Consequences

- **Pros**
  - Zero tenant admin involvement. Maria controls the published feed herself.
  - Cloudflare Workers free tier covers our usage indefinitely.
  - The worker is single-purpose, trivial to reason about, and easy to replace.
- **Cons / risks**
  - Up to ~3 hours of lag from when an Outlook meeting changes to when the planner sees it. Documented in `CONTEXT.md` so Maria isn't surprised.
  - The ICS URL is a bearer secret in the URL itself — anyone with the URL can read the calendar. Stored only in `state.settings.icsUrl` on Maria's devices.
  - No write-back to Outlook. Read-only by design.

## Alternatives considered

- **Microsoft Graph API.** May revisit if real-time becomes important. Tracked as possible v2 in project memory.
- **Browser extension that scrapes Outlook Web.** Rejected: fragile, browser-bound.
- **Manual ICS export + import.** Rejected: defeats the point of "see today's meetings in the planner."
