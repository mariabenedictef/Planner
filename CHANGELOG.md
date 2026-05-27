# Endringslogg — Planlegger

Hver vesentlig endring blir notert her med dato + commit-referanse. Holder oversikt over hva som har skjedd over tid og når. ADR-ene forklarer *hvorfor* — denne loggen forklarer *hva* og *når*.

Nye innslag legges øverst.

---

## 2026-05-27 — Lukk-knappen i Settings (og 10 andre modaler) fungerer igjen

- **`HANDLERS.closeModal` lagt til** — `data-action="closeModal"` brukes 11 steder (Settings-modal, prosjekt-form-cancel, oppgave-form-cancel, hendelse-form-cancel, m.fl.), men `closeModal()` eksisterte bare som modul-lokal funksjon, ikke på HANDLERS. Den sentrale klikk-lytteren slo opp `HANDLERS[action]`, fant ingenting, og returnerte stille. Resultat: ingen av Lukk-knappene fungerte — bruker måtte trykke Esc eller klikke bakgrunnen for å lukke modaler. Rapportert av Maria 2026-05-27 (Settings → Lukk).
- **Root cause-analyse:** Samme klasse bug som de 39 inline-handler-bugsa fra runde 1 tidligere i dag, men inversen: der var `HANDLERS.X` referert uten prefiks i inline-attributter; her var `data-action="closeModal"` referert til en funksjon som fantes i modul-scope men ikke på HANDLERS. Audit-skriptet som fanget runde 1 sjekket bare inline-attributter — ikke data-action-bindinger mot HANDLERS. Krysset av alle 52 unike data-action-verdier i app.js: bare `closeModal` manglet. Bekrefter at det er en isolert bug.
- **Smoke-testen utvidet** — to nye assertions: `typeof HANDLERS.closeModal === 'function'`, og en faktisk klikk-test som åpner Settings, finner Lukk-knappen, klikker, og verifiserer at modalen lukkes. Tidligere smoke-test sjekket bare at Settings-modalen åpner — ikke at den lukker via knappen. 19/19 tester grønne.

## 2026-05-27 — Flerdagsbar + state.settings-opprydding

- **Flerdagshendelser tegnes som sammenhengende bar i månedsvisning** — multi-day events vises nå som én visuelt sammenhengende bar over alle dagene de spenner (innenfor samme ukerad). Tidligere fikk hver dag en separat boks med «↳» / «→»-piler. Endringene: negative horisontalmarginer i `.ev.multi`-CSS bløder boksene over cellegrensene, første-dag beholder tittel og avrundet venstrekant, mellomdager og siste dag dropper venstrekant og tittel (`&nbsp;`-plassholder), siste dag avrunder høyrekanten. `eventsOnDay` sorterer flerdags-hendelser først per celle slik at baren ligger på samme vertikale slot fra dag til dag.
- **`state.settings` ryddet bort permanent** — migreringen 2026-05-26 etterlot vestigial `settings`-felt i lagrede blobs dersom `ui`/`sync` allerede fantes. Nå stripper `loadState` **alltid** `merged.settings` etter merge, uavhengig av om ui/sync også finnes. Legacy-fold (settings → ui/sync) skjer fortsatt kun når ui/sync mangler. Hindrer at stale `settings.icsUrl` o.l. blir liggende i evig tid.
- **Røyktesten oppdatert** — `test.html` brukte fortsatt `state.settings.view`-referanser (4 steder). Ryddet til `state.ui.view`. Ny assertion sjekker at `state.settings === undefined` etter loadState.
- **Helligdager til og med 2040 verifisert** — `generateNorwegianHolidays(year)` er allerede dynamisk via Easter-computus. Test-kjøring bekrefter 17. mai 2027 håndterer overlappet med 2. pinsedag, og at 2028, 2029, 2030 alle returnerer 15 helligdager med riktige datoer.
- Verifisert med 34-tests jsdom-røyktest (boot + helligdager + flerdagsrendering + 8 visninger + migrasjons-edge-cases). Alle grønne.

## 2026-05-27 — Kvalitetskontroll runde 2: 4 bugs til

- **Sync-credentials bevart riktig etter pull/restore** — `pullFromRemote` og `restoreCloudBackup` skrev fortsatt til den gamle `state.settings`-noden (regresjon fra splittingen 2026-05-26). Nå skriver de til `state.sync` slik at lokale syncUrl/syncToken/icsUrl faktisk preserves.
- **5 race-condition-kasts fjernet** — `addProjectMilestone`, `quickAddMilestone`, `addProjectPerson`, `addProjectLink`, `saveProjectForm`, `saveTaskForm`, `saveEventForm`, `saveProjectTaskForm`, `openProjectTaskForm` kastet alle `Cannot read properties of undefined` hvis entiteten ble slettet mellom skjema-åpning og lagring. Lagt til defensive `if (!p) return;` på alle 9 stedene.
- **`renderMarkdown` slettet** (38 linjer) — død funksjon, aldri kalt. Foreldet etter overgang til rich-text-noteList.
- **Notat-innhold sanitiseres ved rendering** — ny `sanitizeNoteHTML` stripper inline event-handlers (`onerror=`, `onclick=` osv.), `<script>`/`<iframe>`/`<object>`/`<embed>`, og `javascript:`/`data:`-URLs fra notatinnhold før det skrives til innerHTML. Beskytter mot uventet HTML lagret via copy-paste fra eksterne sider.
- Verifisert med 79-tests jsdom-suite (58 standard + 11 race-condition + 10 sanitizer).

## 2026-05-27 — Kvalitetskontroll: 39 inline-handler-bugs + 3 oppryddinger

- **39 ubeskyttede inline-kall fikset** — etter event-delegation-refaktoren (2026-05-26) gjensto en bug-klasse: `onchange="..."`, `ondragstart="..."`, `ondragover="..."` osv. kalte HANDLERS-funksjoner uten `HANDLERS.`-prefiks og ville kaste `ReferenceError` første gang de ble utløst. Berørte UI-elementer: kanban-dra-og-slipp (5), to-do-dra-og-slipp (6), dag-visning-dra (4), avkrysningsbokser (7), hurtigfangst-nedtrekk (5), personstatus-velgere (1), tema-bytte (1), dobbeltklikk-rediger (2), klikk-på-listerad (4). Samme mønster som `importData`-bugen. Verifisert med 58-tests jsdom-røyktest.
- **`importData` migrerer nå riktig** — gamle JSON-backups (pre-2026-05-26 med flatt `state.settings`) kan nå importeres uten brudd. Skriver til `localStorage` og kjører `loadState()` på nytt så alle migrasjoner utløses.
- **"Personer"-seksjon koblet inn på prosjektsiden** — `renderProjectPeople` + `HANDLERS.addProjectPerson` var orphan-kode (schemaet støttet `p.people`, men ingen UI utløste det). Lagt til `_projectPeopleSectionHTML` i `renderProjectPage` med inline `+ Legg til`-form, slik som Delmål/Lenker.
- **Død kode slettet** (~100 linjer) — `function habitsActive` (aldri kalt), `HANDLERS.toggleMilestone` (refererte `state.goals` uten render), hele Goal-form-blokken (`openGoalForm` + 2 HANDLERS), hele Habit-form-blokken (`openHabitForm` + 3 HANDLERS). Alt er rester etter Fokus-fjerningen 2026-05-26.

## 2026-05-26 — Dyp opprydding (10-årshorisont)

- **state.settings splittet** i `state.ui` (visning, filtre, ankre, tema, projectViewMode, openProjectId, notifications) og `state.sync` (icsUrl, lastSync, syncUrl, syncToken, lastWeeklyExport). Migrering i `loadState` håndterer gammel lagret state. Meta-versjon bumpet til 4.
- **Inline JS-uttrykk eliminert** — alle ~40 `onclick="..."` med inline kode er konvertert til `data-action="..." data-args='[...]'`. Listener-en utvidet med `data-stop="1"` og `data-preventDefault="1"` for hendelses-modifikatorer. 11 nye HANDLERS lagt til (execCmd, openProject, switchView, toggleShowCompleted, m.fl.). Notatredaktørens 12 formatknapper deler nå én generisk `HANDLERS.execCmd(cmd, value)`.
- **Inline styles → CSS-klasser** — 51 av 144 statiske inline-styles erstattet med 16 nye utility-klasser i `<style>`-blokken (`.text-alert`, `.text-muted-sm`, `.btn-sec`, `.flex-row-gap`, `.section-title`, m.fl.). De gjenværende 95 statiske og 15 dynamiske styles er ekte engangsbruk, ikke verdt å klasse-ifisere.

## 2026-05-26 — Oppryddings-økt

- **App.js skilt ut fra index.html** — JavaScript-koden (4500+ linjer) bor nå i en sidecar-fil. Index.html er nede i ~1100 linjer (struktur + CSS). Supersede av ADR 0001.
- **«Oppdater nå» for Outlook** — ny knapp i innstillinger som tvinger umiddelbar ICS-sync uten å vente på neste auto-runde.
- **Røyk-testen utvidet** — `test.html` tester nå klikk-nivå atferd (settings åpner, FAB åpner, knapper utløser handlere) i tillegg til at hver visning rendrer.
- **`CHANGELOG.md` opprettet** — denne filen.
- **Backup-mappen ryddet** — fra ~3,3 MB til 1,4 MB. Beholdt siste pre-edit HTML, siste JSON-eksport, og arkivert worker.js.
- **`docs/handoff-2026-05-23.md` slettet** — foreldet.
- **`docs/architecture-review-2026-05-23.md` oppdatert** med statusboks som markerer hva som er gjort siden.

## 2026-05-26 (tidligere på dagen)

- **`importData`-bugen fikset** (`65bb344`). Reglet hadde gått glipp av én bare-referanse under event-delegation refactoren. Settings frøs på «Henter…».
- **Automatisk ukentlig JSON-backup til valgt mappe** (`f6acfc0`). Bruker File System Access API til å skrive direkte til en mappe du velger (typisk `OneDrive\Claude\Planner\backups`). Faller tilbake til Nedlastinger på iPhone/uvalgt-mappe.
- **Personvern: fjernet personlige referanser fra kildekoden** (`719c620`). Hardkodet "Maria"-hilsen + placeholder-URL erstattet med anonyme verdier. Live-URL inneholder ingen ord som identifiserer eieren.
- **Event delegation refactor** (`1cb1a28`). 76 `window.*`-globale handlere → 1 (`HANDLERS`). 76 inline `onclick="fn(...)"` → `data-action="fn" data-args='[...]'`. Sentralisert click-listener. Se ADR 0012.
- **Fokus-visningen fjernet** (`cb2f974`). Maria brukte den aldri. ADR 0011 superseder ADR 0008. Lagrede Fokus-data beholdt i state men ikke rendret.

## 2026-05-24

- **`strategy` → `fokus` rename** (`58099dd`). Internt navn på Fokus-visningen samsvarer nå med UI-etiketten. Migrering: gammel `view:'strategy'` mappes til `'fokus'`. Også fjernet dødt kode (`WINDOW`-konstant, `_LEGACY_HOLIDAYS`).
- **GitHub Pages tatt i bruk** (`64cb7a4`). Planleggeren serveres nå på `mariabenedictef.github.io/Planner`. Worker.js arkivert til backups. ADR 0010 superseder ADR 0009.

## 2026-05-23

- **Arkitekturgjennomgang utført** ([docs/architecture-review-2026-05-23.md](docs/architecture-review-2026-05-23.md)). Identifiserte tier-1-til-tier-4-forbedringer.
- **Reorder-helpers konsolidert**. 5 nær-identiske funksjoner deler nå `_spliceByTargetId` + `_renumberOrder`-primitiver.
- **`renderProjectPage` splittet i 8 seksjons-helpers** (header, tasks, milestones, notes, links, backlinks, actions, reorder-wire-up).
- **CONTEXT.md opprettet** + ADR-er 0001–0009 backfilled.
- **Matt Pocock-prinsipper tatt i bruk** som arbeidsmåte: grilling, CONTEXT.md, ADR-er, periodisk arkitekturoppfølging.

## Pre-2026-05-23 (tidligere)

Planleggeren ble bygget over flere økter. Hovedstruktur, datamodell (projects-as-life-events), kategorier (først 4, så 2), Outlook ICS-sync via Cloudflare-worker, Cloudflare KV cross-device-sync, mobil-optimalisert UI, og første Fokus-implementasjon. ADR-ene 0001–0008 dokumenterer beslutningene fra denne perioden, backfilled i den første gjennomgangs-økten 2026-05-23.
