# Endringslogg — Planlegger

Hver vesentlig endring blir notert her med dato + commit-referanse. Holder oversikt over hva som har skjedd over tid og når. ADR-ene forklarer *hvorfor* — denne loggen forklarer *hva* og *når*.

Nye innslag legges øverst.

---

## 2026-06-08 — Bugfix: topbar nav resetter nå faktisk anker + kategori-toggle på inbox

- **Bugfix:** Topbar-knappene `Dag`/`Uke`/`Måned`/`Årsoversikt` bypasset `HANDLERS.switchView` og satte `state.ui.view` direkte i sin egen `onclick`. Reset-til-i-dag-logikken fra forrige commit ble derfor aldri kjørt for de faktiske UI-klikkene. Maria rapporterte at hun fortsatt så Uke 22 (mai) selv etter å ha klikket Uke. Topbar-nav (linje 950 + 956) kaller nå `HANDLERS.switchView(b.dataset.view)` istedenfor inline-mutering. Smoke-testen er utvidet til å gjøre faktiske `button.click()`-kall istedenfor å invokere handleren direkte — så denne typen omgåelse vil bli fanget i framtiden.
- **Kategori-toggle (●) på inbox-rader** — samme knapp som på vanlige To Do's. `HANDLERS.toggleInboxCategory` flipper mellom 'arbeid' og 'privat'. `inboxToTodo` bevarer nå kategorien når en innboks-oppføring promoteres til fri oppgave (tidligere ble alle promoteringer hardkodet til 'arbeid'). Defensiv mot ukjent id. Rapportert av Maria.
- Verifisert med 30-tests jsdom-suite: faktiske button-klikk for alle fire kalender-views resetter anker, To Do's-klikk lar anker stå, toggle flipper begge veier, knapp rendres med riktig farge per kategori, promotering til fri oppgave bevarer privat-status, alle 8 visninger fortsatt grønne, tidligere HANDLERS (inboxEditStart, taskToProject, toggleTaskCategory, closeModal) intakte.

## 2026-06-08 — Inbox-rediger + kalender-anker-reset + plassholder-rydding + tag-til-prosjekt-uten-å-flytte

Fire forbedringer fra dagens runde, alle pushet i samme commit.

- **Pennknapp (✎) på inbox-rader** — innboks-elementer kunne kun redigeres ved dobbeltklikk på tittelen, noe som ikke var oppdagbart. Ny synlig pennknapp matcher den på vanlige To Do's. `HANDLERS.inboxEditStart` finner tittel-span via DOM-query og kaller eksisterende `inlineEditStart` med kind `'inbox'` — ingen ny modal eller dupliserende logikk. Defensiv mot ukjent id.
- **Kalender-visninger åpner alltid på i dag** — klikk på `Dag`/`Uke`/`Måned`/`Årsoversikt` resetter `state.ui.anchor` (og `state.ui.overviewAnchor` for årsoversikten) til dagens dato før render. `HANDLERS.switchView` sjekker mot ny `CALENDAR_VIEWS`-konstant. Ikke-kalender-visninger (Hjem/Prosjekter/To Do's) påvirkes ikke. Browsing innen visningen via `‹ ›`-pilene fungerer som før — kun selve view-bytte-knappen resetter. **NB: denne fixen var ikke koblet inn på topbar-knappene — se neste entry.**
- **Plassholdertekst «dump alt som dukker opp» fjernet** — undertittel under «To Do's»-overskriften (utviklerstandard fra tidligere). Headingen er nå bare «To Do's».
- **«Til prosjekt» tagger nå, flytter ikke** — `HANDLERS.taskToProject` har endret oppførsel. Tidligere ble taska splicet ut av `state.tasks` og pushet inn i `project.tasks` med ny id og uten prioritet/kategori — så den forsvant fra To Do's-listen og mistet prioritet. Nå settes bare `t.projectId = projectId`; tasken blir stående i sin prioritetsbøtte med sine egne felter intakt. Render-laget viser «· prosjekt-tittel» (kursiv, dempet) etter tittelen. Klikk på tag-en fjerner den (`HANDLERS.untagTaskProject`).
- Verifisert med 38-tests jsdom-suite.

## 2026-06-08 — Delmål kan nå redigeres etter opprettelse

- **`openProjectMilestoneForm` modal lagt til** — klikk på et delmåls tittel eller dato på prosjektsiden åpner en modal med Tittel, Dato (valgfritt) og Ferdig-avkrysning, samt Lagre/Avbryt/Slett-knapper. Tre nye HANDLERS: `openProjectMilestoneForm`, `saveProjectMilestoneForm`, `deleteProjectMilestoneAndClose`. Mønstret følger `openProjectTaskForm`.
- **Bug-klasse:** Delmål-raden hadde tittel som passiv `<span>` uten klikk-handler eller dobbeltklikk-redigering — det fantes ingen vei å endre verken tittel eller dato etter at delmålet var opprettet. Bare avkrysning, dra-for-sortering og sletting fungerte. Rapportert av Maria (skjermbilde fra Porto-bryllup-prosjektet).
- Verifisert med 32-tests jsdom-suite.

## 2026-05-27 — Kategori-toggle på To Do-rad + tooltip-fiks

- **Ny `●`-knapp på hver To Do-rad** — vippe mellom Jobb ↔ Privat uten å åpne redigeringsskjemaet. Vises mellom prioritet-knappene og «Utsett»-dropdownen. Fargen følger kategorien: slate-blå for Jobb, støvrosa for Privat. Tooltip viser nåværende verdi og hva klikk gjør. `HANDLERS.toggleTaskCategory` lagt til (defensiv mot manglende id). Standard-kategori for nye To Do-er er fortsatt 'arbeid' (Jobb).
- **Tooltip-fiks** — `○`-knappen for å fjerne prioritet hadde tooltip «Fjern kategori», som var misvisende (den nullstiller prioritet, ikke kategori). Rettet til «Fjern prioritet».
- Verifisert med 25-tests jsdom-suite.

## 2026-05-27 — Lukk-knappen i Settings (og 10 andre modaler) fungerer igjen

- **`HANDLERS.closeModal` lagt til** — `data-action="closeModal"` brukes 11 steder, men `closeModal()` eksisterte bare som modul-lokal funksjon, ikke på HANDLERS. Den sentrale klikk-lytteren slo opp `HANDLERS[action]`, fant ingenting, og returnerte stille. Rapportert av Maria.
- **Root cause:** Samme klasse bug som de 39 inline-handler-bugsa tidligere på dagen, men inversen. Krysset av alle 52 unike data-action-verdier — bare `closeModal` manglet.
- Verifisert med 19-tests jsdom-suite.

## 2026-05-27 — Flerdagsbar + state.settings-opprydding

- **Flerdagshendelser tegnes som sammenhengende bar i månedsvisning** — multi-day events vises nå som én visuelt sammenhengende bar over alle dagene de spenner (innenfor samme ukerad). Negative horisontalmarginer i `.ev.multi`-CSS bløder boksene over cellegrensene. `eventsOnDay` sorterer flerdags-hendelser først per celle.
- **`state.settings` ryddet bort permanent** — `loadState` stripper nå **alltid** `merged.settings` etter merge.
- **Røyktesten oppdatert** — `test.html` brukte fortsatt `state.settings.view`-referanser (4 steder). Ryddet til `state.ui.view`.
- **Helligdager til og med 2040 verifisert** — `generateNorwegianHolidays(year)` er allerede dynamisk via Easter-computus.
- Verifisert med 34-tests jsdom-røyktest.

## 2026-05-27 — Kvalitetskontroll runde 2: 4 bugs til

- **Sync-credentials bevart riktig etter pull/restore** — `pullFromRemote` og `restoreCloudBackup` skrev fortsatt til den gamle `state.settings`-noden.
- **5 race-condition-kasts fjernet** — defensive `if (!p) return;` på 9 steder.
- **`renderMarkdown` slettet** (38 linjer død funksjon).
- **Notat-innhold sanitiseres ved rendering** — ny `sanitizeNoteHTML`.
- Verifisert med 79-tests jsdom-suite.

## 2026-05-27 — Kvalitetskontroll: 39 inline-handler-bugs + 3 oppryddinger

- **39 ubeskyttede inline-kall fikset** — `onchange`, `ondragstart`, `ondragover` osv. kalte HANDLERS-funksjoner uten `HANDLERS.`-prefiks.
- **`importData` migrerer nå riktig** — gamle JSON-backups kan nå importeres uten brudd.
- **"Personer"-seksjon koblet inn på prosjektsiden**.
- **Død kode slettet** (~100 linjer).

## 2026-05-26 — Dyp opprydding (10-årshorisont)

- **state.settings splittet** i `state.ui` + `state.sync`. Meta-versjon bumpet til 4.
- **Inline JS-uttrykk eliminert** — alle ~40 `onclick="..."` er konvertert til `data-action="..." data-args='[...]'`.
- **Inline styles → CSS-klasser** — 51 av 144 statiske inline-styles erstattet med 16 nye utility-klasser.

## 2026-05-26 — Oppryddings-økt

- **App.js skilt ut fra index.html** — JavaScript-koden bor nå i en sidecar-fil. Index.html er nede i ~1100 linjer. Supersede av ADR 0001.
- **«Oppdater nå» for Outlook**.
- **Røyk-testen utvidet**.
- **`CHANGELOG.md` opprettet** — denne filen.
- **Backup-mappen ryddet** — fra ~3,3 MB til 1,4 MB.

## 2026-05-26 (tidligere på dagen)

- **`importData`-bugen fikset** (`65bb344`).
- **Automatisk ukentlig JSON-backup til valgt mappe** (`f6acfc0`).
- **Personvern: fjernet personlige referanser fra kildekoden** (`719c620`).
- **Event delegation refactor** (`1cb1a28`). 76 `window.*`-globale handlere → 1 (`HANDLERS`). Se ADR 0012.
- **Fokus-visningen fjernet** (`cb2f974`). ADR 0011 superseder ADR 0008.

## 2026-05-24

- **`strategy` → `fokus` rename** (`58099dd`).
- **GitHub Pages tatt i bruk** (`64cb7a4`). ADR 0010 superseder ADR 0009.

## 2026-05-23

- **Arkitekturgjennomgang utført**. Identifiserte tier-1-til-tier-4-forbedringer.
- **Reorder-helpers konsolidert**.
- **`renderProjectPage` splittet i 8 seksjons-helpers**.
- **CONTEXT.md opprettet** + ADR-er 0001–0009 backfilled.
- **Matt Pocock-prinsipper tatt i bruk** som arbeidsmåte.

## Pre-2026-05-23 (tidligere)

Planleggeren ble bygget over flere økter. Hovedstruktur, datamodell (projects-as-life-events), kategorier (først 4, så 2), Outlook ICS-sync via Cloudflare-worker, Cloudflare KV cross-device-sync, mobil-optimalisert UI, og første Fokus-implementasjon. ADR-ene 0001–0008 dokumenterer beslutningene fra denne perioden, backfilled i den første gjennomgangs-økten 2026-05-23.
