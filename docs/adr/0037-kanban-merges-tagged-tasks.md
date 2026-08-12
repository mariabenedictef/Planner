# ADR 0037 — Kanban-brettet viser hele prosjektet, og «ferdig» settes ett sted

**Status:** Accepted
**Date:** 2026-08-12
**Fullfører:** 0033 (`projectTasksMerged` som én kilde)

## Context

`renderProjectKanban` leste bare `p.tasks`. Det var det siste stedet som ikke brukte `projectTasksMerged` — notert som gjenstående i ADR 0033 og i CONTEXT.md.

Det var ikke en kosmetisk mangel. Marias **Dealflow**-prosjekt brukes som en pipeline: To Do'ene der er selskapsnavn — «Shive», «Akvavet Gulen AS» — og de ligger som *taggede frie To Do's*, ikke som prosjektets egne underoppgaver. Brettet var altså tomt for nettopp den bruken det passer best til. En case i en pipeline har en **fase**, ikke en frist, og kolonner er den riktige formen for fase.

Under arbeidet dukket en andre feil opp, som brettet gjorde synlig:

**`status` og `done` var to uavhengige sannheter.** `taskStatus(t)` er `t.status || (t.done ? 'done' : 'todo')`. Fire steder satte `t.done` direkte og rørte aldri `status`. Så en oppgave med `status:'doing'` som ble krysset av i lista **ble liggende i «I gang»-kolonnen** selv om den var ferdig. Med brettet tomt for taggede oppgaver var dette lett å ikke se; nå ville det stått midt på skjermen.

Og et tredje hull, som blokkerte ADR 0038: **ingen sted registrerte når noe ble gjort.** Uten et tidsstempel er en ukesoppsummering umulig å regne ut.

## Decision

**1. Brettet bruker `projectTasksMerged(p)`.** `_origin` følger med på hvert kort, fordi de to kildene bor i ulike lagre og skal treffes ulikt:

- kortet åpnes med `openTaskForm` for en fri To Do, `openProjectTaskForm` for en underoppgave
- drag-and-drop legger `{id, origin}` i `dataTransfer`, og slippet slår opp i `state.tasks` eller `p.tasks` etter opprinnelse

En ren id i `dataTransfer` — formatet fra før denne endringen — behandles fortsatt som en underoppgave, så et drag som starter i en gammel fane ikke ender i tomrommet.

**2. `_setDone(t, done)` er den ene døren for «ferdig».** Den setter `done`, stempler `doneAt`, og holder `status` i takt: ferdig ⇒ `status:'done'`, ikke-ferdig ⇒ `'todo'` hvis den sto på `'done'`, ellers uendret. Alle fire stedene som satte `t.done` direkte går gjennom den nå, inkludert sveipe-gesten på mobil og slippet i «Ferdig»-kolonnen.

**3. `doneAt` fylles fra og med i dag.** Den er grunnlaget for ADR 0038. Oppgaver som var ferdige før dette har den ikke, og ukesoppsummeringen sier det i klartekst i stedet for å vise en tom liste som om ingenting var gjort.

**Bevisst ikke endret:** delmål (`p.milestones[].done`) har fortsatt ingen `doneAt` og går ikke gjennom `_setDone`. De er ikke på brettet, og de har `date` i stedet for `due`. De vises i ukesoppsummeringens «glippet» og «neste 7 dager», men ikke i «gjort».

## Consequences

**Vi aksepterer:**

- **Å krysse av en oppgave flytter den nå til «Ferdig» på brettet.** Det er hele poenget, men det er en adferdsendring: før kunne en avkrysset oppgave ligge i «I gang», og hvis noen brukte det som «gjort, men ikke helt lukket», forsvinner den nyansen.
- **`doneAt` er ny i datamodellen.** Den skrives til sky-blobben og eksporten. Ingen migrering trengs — fraværet av feltet er en gyldig tilstand som betyr «vi vet ikke når».
- **Brettet kan bli langt** for et prosjekt med mange taggede To Do's. Kolonnene har ingen visningsgrense; det er akseptabelt for et brett man skal jobbe i, men det er en forskjell fra kortene (som kapper på 3).
- Fri To Do og underoppgave ser like ut på brettet. De oppfører seg ulikt ved klikk, og det er ikke synlig før man klikker. Samme avvik som listevisningen alltid har hatt.

**Vi får:**

- Dealflow kan faktisk brukes som et brett med faser.
- 15 nye assertions, og negativ kontroll som viser presis feilen: mot forrige commit rendrer brettet **1 kort der det nå rendrer 3**.
- Konsistensen `status`/`done` lukket, og fundamentet for ukesoppsummeringen på plass.

## Alternatives considered

**La brettet være, og lag en egen «pipeline»-visning.** Riktig hvis en case er noe annet enn en oppgave. Forkastet: kanban *er* den visningen, og den fantes alt — den manglet bare halvparten av dataene. En ny visning ville vært en ny ting å vedlikeholde for samme formål.

**Gi kortene visuell forskjell etter opprinnelse.** Vurdert, forkastet som støy: hun vet hvilke som er taggede To Do's, og brettet handler om fase, ikke om hvor dataene bor.

**Utlede `status` fra `done` alene og droppe feltet.** Enklere modell, men da mister man «I gang», som er hele grunnen til å ha et brett.

**Skrive `doneAt` retroaktivt** (f.eks. sette den til `due`-datoen for alt som alt er ferdig). Ville gitt en ukesoppsummering med innhold umiddelbart. Forkastet: det er oppdiktede data i et panel som skal fortelle hva som faktisk skjedde. Å si «vi vet ikke» er mer verdt enn et plausibelt tall.
