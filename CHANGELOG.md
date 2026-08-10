# Endringslogg — Planlegger

Hver vesentlig endring blir notert her med dato + commit-referanse. Holder oversikt over hva som har skjedd over tid og når. ADR-ene forklarer *hvorfor* — denne loggen forklarer *hva* og *når*.

Nye innslag legges øverst.

---

## 2026-06-09 — Prosjekt-siden viser nå tagget-frie-tasks under Oppgaver

- **Bug Maria rapporterte:** Når en To Do fikk prosjekt-tag i To Do's-visningen, dukket den ikke opp under «Oppgaver»-seksjonen på prosjektsiden. Kun `p.tasks` (prosjekt-egne subtasks laget med «+ Ny» på prosjektsiden) ble vist. Prosjektet ble halvsynlig — man måtte hoppe tilbake til To Do's for å se hva som var tagget.
- **Fix:** `renderProjectTasks(p)` merger nå to kilder: `p.tasks` (prosjekt-subtasks) og `state.tasks.filter(t => t.projectId === p.id)` (taggede frie tasks). Hver rad rendres med korrekte HANDLERS basert på origin — subtasks bruker `toggleProjectTask`/`openProjectTaskForm`/`deleteProjectTask` som før, frie tasks bruker `toggleTask`/`openTaskForm`/`deleteFreeTask` slik at avkrysning/redigering/sletting går mot rett datastore. Frie tasks er ikke draggable innenfor prosjekt-visningen (rekkefølgen deres tilhører prioritetsbøttene på To Do's-siden).
- Verifisert med 29-tests jsdom-suite: prosjekt-side rendrer alle tre rader (1 subtask + 2 taggede), urelatert fri task ikke synlig, riktige handlere per origin, avkrysning muterer riktig datastore (state.tasks vs p.tasks), tom-tilstand vises kun når begge kilder er tomme, tagget task alene fyller ellers-tomt prosjekt. Alle tidligere HANDLERS intakte.

## 2026-06-09 — Bug-klasse: 5 stille ReferenceError-bugs fikset på én gang

- **Bug Maria rapporterte:** klikk på «+ Nytt notat» gjorde ingenting — notatet ble lagret, men modalen åpnet ikke. Kun etter refresh dukket det opp som en tom rad.
- **Root cause:** `HANDLERS.addProjectNote` kalte `openNoteEditor(pid, n.id)` uten `HANDLERS.`-prefiks. `openNoteEditor` er kun definert på `HANDLERS`, så bare-kallet kastet `ReferenceError: openNoteEditor is not defined`. Den sentrale klikk-lytterens try/catch slukte feilen — modalen åpnet aldri, men noten ble lagret før kastet.
- **Audit + 4 til:** En statisk gjennomgang av samme mønster fant 4 andre bare-HANDLERS-kall som ville ha blitt utløst av kantete brukerhandlinger: swipe-høyre på inbox (`inboxToTodo`), swipe-venstre slett (`deleteFreeTask`, `deleteInbox`), drag-og-slipp av oppgave til prioritetsbøtte (`setTaskPriority`, `inboxToTodo`). Alle fikset i samme commit.
- **Audit-skriptet** lagret som memory (`feedback_planner_handlers_audit.md`) og lagt inn som steg 1.5 i pre-push-sjekklisten. Fanger denne bug-klassen statisk på fremtidige pusher.
- Verifisert med 24-tests jsdom-suite: faktisk `button.click()` på «+ Nytt notat» åpner modalen og legger til notatet, alle 5 navn har 0 bare-kall igjen, alle 5 HANDLERS fortsatt funksjonelle, alle 8 visninger grønne, ingen console-errors under runden.

## 2026-06-09 — Modaler lukker ikke lenger ved utilsiktet drag-out

- **Bug:** Når du markerte tekst i et notat eller skjema-input og slapp musen utenfor modalen (på den mørke bakgrunnen), lukket modalen seg uventet. `click`-eventets target er felles forfedre av mousedown og mouseup — så hvis mousedown var inne i modalen og mouseup på bakgrunnen, ble click-eventet registrert på `modalBg` og lukkemekanismen utløst. Rapportert av Maria (notat-editoren på prosjektsiden).
- **Fix:** Modal-bakgrunnen sporer nå om mousedown faktisk skjedde på den (`_modalMouseDownOnBg`). Modal lukkes kun hvis BÅDE mousedown og click skjedde på bakgrunnen. Tekstmarkering med utenfor-drop blir derfor ignorert. Esc-tasten og «Lukk»-knappen fungerer som før.
- Verifisert med 16-tests jsdom-suite: modal forblir åpen ved drag-out (mousedown på content → click på bg), modal lukkes ved ekte bg-klikk (mousedown + click begge på bg), Escape og Lukk-knappen fortsatt funksjonelle, alle 8 visninger grønne.

## 2026-06-09 — Prosjekt-tag synes nå overalt (ikke bare i To Do's-visningen)

- **Bug:** Forrige commit (`0a3a419`) la prosjekt-tag-rendring kun til `todoRowHTML` (To Do's-visningen). Hjem-visningens Urgent-panel, Hjem-visningens «Forfaller i dag», iPhone-Dag-dashboard, og List-visning brukte andre render-paths som ikke kjente til `t.projectId`. Maria rapporterte at hun ikke så prosjekt-tag på Urgent-panelet på Hjem-siden selv etter hard-reload — det var fordi tag-en aldri ble rendret der.
- **Fix:** Fire steder oppdatert til å rendre prosjekt-tag fra `t.projectId`-oppslag: Hjem Urgent (linje ~1025), iPhone Dag-dashboard urgent (linje ~2844), List-visning fri-task-rad (linje ~3000). Pluss en sentral utvidelse: `tasksOnDay()` setter nå `_projectTitle` på frie tasks med `projectId`, ikke bare på prosjekt-subtasks. Det gjør at alle eksisterende render-paths som allerede håndterer `_projectTitle` (kalender-visninger Uke/Måned, Hjem «Forfaller i dag») nå viser tag-en for frie tasks med prosjekt-tilknytning også.
- Verifisert med 22-tests jsdom-suite: Hjem Urgent viser tag på tagget task, ikke på utagget; `tasksOnDay` setter `_projectTitle` på fri-task med `projectId`; Forfaller-i-dag og List-visning inneholder prosjekt-tittel; alle 8 visninger fortsatt grønne.

## 2026-06-08 — Bugfix: topbar nav resetter nå faktisk anker + kategori-toggle på inbox

- **Bugfix:** Topbar-knappene `Dag`/`Uke`/`Måned`/`Årsoversikt` bypasset `HANDLERS.switchView` og satte `state.ui.view` direkte i sin egen `onclick`. Reset-til-i-dag-logikken fra forrige commit ble derfor aldri kjørt for de faktiske UI-klikkene. Topbar-nav (linje 950 + 956) kaller nå `HANDLERS.switchView(b.dataset.view)`. Smoke-testen er utvidet til å gjøre faktiske `button.click()`-kall istedenfor å invokere handleren direkte.
- **Kategori-toggle (●) på inbox-rader** — samme knapp som på vanlige To Do's. `HANDLERS.toggleInboxCategory` flipper mellom 'arbeid' og 'privat'. `inboxToTodo` bevarer nå kategorien.

## 2026-06-08 — Inbox-rediger + kalender-anker-reset + plassholder-rydding + tag-til-prosjekt-uten-å-flytte

- **Pennknapp (✎) på inbox-rader** — innboks-elementer kunne kun redigeres ved dobbeltklikk på tittelen.
- **Kalender-visninger åpner alltid på i dag** — `HANDLERS.switchView` sjekker mot ny `CALENDAR_VIEWS`-konstant og resetter anker. **NB: var ikke koblet inn på topbar-knappene — se neste entry.**
- **Plassholdertekst «dump alt som dukker opp» fjernet**.
- **«Til prosjekt» tagger nå, flytter ikke** — `HANDLERS.taskToProject` setter `t.projectId` istedenfor å flytte tasken inn i `project.tasks`. Render-laget viser «· prosjekt-tittel»-tag.

## 2026-06-08 — Delmål kan nå redigeres etter opprettelse

- **`openProjectMilestoneForm` modal lagt til** — klikk på et delmåls tittel eller dato åpner modal med Tittel/Dato/Ferdig + Lagre/Avbryt/Slett.
- Verifisert med 32-tests jsdom-suite.

## 2026-05-27 — Kategori-toggle på To Do-rad + tooltip-fiks

- **Ny `●`-knapp på hver To Do-rad** — vippe mellom Jobb ↔ Privat.
- **Tooltip-fiks** — `○`-knappens tooltip rettet fra «Fjern kategori» til «Fjern prioritet».

## 2026-05-27 — Lukk-knappen i Settings (og 10 andre modaler) fungerer igjen

- **`HANDLERS.closeModal` lagt til** — `closeModal()` eksisterte bare som modul-lokal funksjon. Krysset av alle 52 unike data-action-verdier.

## 2026-05-27 — Flerdagsbar + state.settings-opprydding

- **Flerdagshendelser tegnes som sammenhengende bar i månedsvisning**.
- **`state.settings` ryddet bort permanent** — `loadState` stripper nå alltid `merged.settings`.
- **Helligdager til og med 2040 verifisert** — via Easter-computus.

## 2026-05-27 — Kvalitetskontroll runde 2: 4 bugs til

- **Sync-credentials bevart riktig etter pull/restore**.
- **5 race-condition-kasts fjernet** — defensive `if (!p) return;`.
- **`renderMarkdown` slettet** (38 linjer død funksjon).
- **Notat-innhold sanitiseres ved rendering** — ny `sanitizeNoteHTML`.

## 2026-05-27 — Kvalitetskontroll: 39 inline-handler-bugs + 3 oppryddinger

- **39 ubeskyttede inline-kall fikset**.
- **`importData` migrerer nå riktig**.
- **"Personer"-seksjon koblet inn på prosjektsiden**.
- **Død kode slettet** (~100 linjer).

## 2026-05-26 — Dyp opprydding (10-årshorisont)

- **state.settings splittet** i `state.ui` + `state.sync`. Meta-versjon 4.
- **Inline JS-uttrykk eliminert** — `onclick="..."` → `data-action="..."`.
- **Inline styles → CSS-klasser** — 51 av 144 promotert.

## 2026-05-26 — Oppryddings-økt

- **App.js skilt ut fra index.html**. Supersede av ADR 0001.
- **«Oppdater nå» for Outlook**.
- **`CHANGELOG.md` opprettet** — denne filen.
- **Backup-mappen ryddet**.

## 2026-05-26 (tidligere på dagen)

- **`importData`-bugen fikset** (`65bb344`).
- **Automatisk ukentlig JSON-backup til valgt mappe** (`f6acfc0`).
- **Personvern: fjernet personlige referanser fra kildekoden** (`719c620`).
- **Event delegation refactor** (`1cb1a28`). Se ADR 0012.
- **Fokus-visningen fjernet** (`cb2f974`). ADR 0011 superseder ADR 0008.

## 2026-05-24

- **`strategy` → `fokus` rename** (`58099dd`).
- **GitHub Pages tatt i bruk** (`64cb7a4`). ADR 0010 superseder ADR 0009.

## 2026-05-23

- **Arkitekturgjennomgang utført**.
- **Reorder-helpers konsolidert**.
- **`renderProjectPage` splittet i 8 seksjons-helpers**.
- **CONTEXT.md opprettet** + ADR-er 0001–0009 backfilled.
- **Matt Pocock-prinsipper tatt i bruk**.

## Pre-2026-05-23 (tidligere)

Planleggeren ble bygget over flere økter. ADR-ene 0001–0008 dokumenterer beslutningene fra denne perioden.
