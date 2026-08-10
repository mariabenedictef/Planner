# ADR 0024 — List-visningen fjernet

**Status:** Accepted
**Date:** 2026-08-10

## Context

`render()` hadde en gren `else if (v === 'list') renderList();`, og `renderList()` var 83 linjer som tegnet en flat, kronologisk liste over hendelser, oppgaver, delmål og prosjekt-måldatoer 365 dager fremover.

Helsesjekken 2026-08-10 fant at **visningen ikke kunne åpnes.** Verifisert:

- `renderTopbar` bygger nav fra `['home','projects','todos']` + `['day','week','month','overview']` — sju visninger, ingen `list`.
- `openMoreMenu` (iPhone «Mer») lister de samme fire sekundære.
- `I18N.views` har ingen `list`-etikett, så en knapp ville vist `undefined`.
- Ingenting i hele filen kaller `switchView('list')`.

Den var altså uåpnåelig, og hadde vært det lenge — antakelig siden Fokus-visningen ble fjernet 2026-05-26 (ADR 0011) og nav-listene ble skrevet om. Symptomatisk: CHANGELOG-innslaget 2026-06-09 beskriver at prosjekt-tag-rendring ble fikset i «List-visning fri-task-rad». Arbeidet ble gjort i en visning ingen kunne se.

CONTEXT.md dokumenterte den heller ikke i views-tabellen, selv om resten av dokumentet omtaler «List-view». Dokumentasjonen hadde altså glemt den på samme måte som koden.

## Decision

**Visningen fjernes.** `renderList()` slettet, `'list'`-grenen i `render()` fjernet, og et eventuelt lagret `state.ui.view === 'list'` migreres til `'home'` i `loadState` — både i legacy-`settings`-stien og på det ferdig flettede state-objektet, siden en gammel enhet kan pushe en slik verdi gjennom KV-sync.

Valget er å slette, ikke å koble inn, av tre grunner:

1. Maria har aldri hatt tilgang til den, så hun mister ingen vane. Å koble den inn ville vært å *introdusere* en visning, ikke gjenopprette en — og det er en produktbeslutning som fortjener å bli tatt fordi noen vil ha den, ikke fordi koden tilfeldigvis finnes.
2. Årsoversikt dekker det samme behovet (hva kommer, i tidsrekkefølge) på en måte hun bruker.
3. Kode som ikke kan nås, kan ikke være riktig eller gal — bare vedlikeholdsgjeld. Den kostet allerede én bugfix-runde i juni.

Kaskaden ble tatt med: `monthMiniHTML` (43 linjer), `buildDashboardHTML` (62), `projectsOverlapping` (13), `setupImagePaste` (27), `tasksUndated`, `holidayFor`, `quarterKey`, `quarterOf` — alle bare kalt fra hverandre eller fra `renderList`, ingen fra levende kode. Til sammen 243 linjer, pluss fire ubrukte CSS-regler i `index.html`. Verifisert etter sletting: null gjenstående referanser, ingen definerte-men-ukalte funksjoner igjen, ingen ubrukte CSS-klasser igjen.

## Consequences

**Vi aksepterer:**

- Vil hun ha en flat liste senere, må den skrives på nytt. Koden ligger i `backups/app.js.20260810-135832.pre-healthfix` og i git-historikken. Det er en akseptabel pris for 243 linjer mindre å lese.
- `state.ui.view` har nå sju gyldige verdier. `render()`s `else renderHome()`-fallback gjør at en ukjent verdi degraderer pent uansett.

**Vi får:**

- `app.js` fra 5 222 til 4 979 linjer. Alt som gjenstår er nåbart fra UI-et.
- Prinsippet fra ADR 0011 (fjern det som ikke brukes, dokumentér hvorfor) anvendt konsekvent — med den forskjellen at Fokus ble fjernet fordi Maria ikke brukte den, mens List ble fjernet fordi hun ikke *kunne*.

## Alternatives considered

**Koble den inn** — legge til `I18N.views.list`, en nav-knapp på PC og en oppføring i «Mer»-menyen. Ville tatt ti minutter. Vurdert og lagt fram som valg; Maria valgte sletting.

**La den ligge** — den koster ingenting i drift. Forkastet: den koster i lesing, og den har alt kostet én bugfix-runde. Uåpnåelig kode i en fil man skanner manuelt er verre enn uåpnåelig kode i en modul man kan ignorere.

**Beholde `renderList` men bruke den som lese-visning i søk** — søket har alt sin egen resultat-rendring, så det ville bare vært to måter å gjøre samme ting.
