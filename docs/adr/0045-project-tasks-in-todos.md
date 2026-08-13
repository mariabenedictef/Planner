# ADR 0045 — Prosjektoppgaver i To Do's: én bøtte, samme objekt

**Status:** Accepted
**Date:** 2026-08-13
**Bygger på:** 0033/0037 (`projectTasksMerged`), 0040 (relative datoer), 0041 (prosjektfarge), 0042 (velg-modus)

## Context

Toveisheten var halv. Siden [ADR 0033](0033-project-cards-show-todo-list.md) og [0037](0037-kanban-merges-tagged-tasks.md) har en **fri To Do tagget til et prosjekt** vist seg inne i prosjektet — i lista, på brettet og i tellerne — og kunnet krysses av der. Den andre retningen fantes ikke: **prosjektenes egne underoppgaver var usynlige i To Do's.**

Maria jobber fra To Do's. Konsekvensen var at oppgaver hun selv hadde lagt inn under «Meox AS» bare eksisterte hvis hun husket å gå inn i Meox-prosjektet. Hennes egne data: elleve slike underoppgaver fordelt på fem prosjekter, flere med frister som alt var passert.

## Decision

**En egen bøtte, «◈ Fra prosjekter», under de fire prioritetsbøttene, gruppert per prosjekt.**

Valgt framfor å blande dem inn i Urgent/Short/Long. Prosjektoppgaver har ingen `priority`, så alle elleve ville landet i **«Ukategorisert»** — bøtta hun bruker til «disse trenger en plassering» — og druknet dens betydning i rader som ikke handler om plassering. De fire bøttene er *hennes* prioritering; prosjektoppgaver har sin egen kontekst (saken de hører til), og det er den grupperingen viser.

```js
projectTodoGroups()      // [{p, open, done, sortKey}] — sortert etter tidligste åpne frist
projectTaskRowHTML(p,t)  // avkryssing | tittel + relativ dato | ▸ Utsett  ✎
projectTodosBucketHTML() // hele bøtta, '' når det ikke finnes noen
```

**Det er samme objekt, ikke en kopi.** Raden i To Do's og raden på prosjektsiden peker på det samme elementet i `p.tasks`, og avkryssingen går gjennom samme `HANDLERS.toggleProjectTask`. Toveisheten er derfor ikke en synkronisering som kan drifte — det finnes ingen andre kopi å drifte fra. Gjentakelse (`recurring`) og `doneAt` (ADR 0037) oppfører seg identisk begge steder, gratis.

**Bare prosjektenes egne underoppgaver.** Taggede frie To Do's står allerede i prioritetsbøttene; å ta dem med her ville vist samme oppgave to ganger på én side. En test vokter nettopp det.

**Sortering:** gruppene etter tidligste åpne frist (uten frist sist, deretter tittel), radene innenfor gruppa etter `_dateThenOrderCmp` — samme regel som prosjektsiden og kortene, så rekkefølgen er den samme overalt.

**Gruppeoverskriften bærer prosjektets farge** (`--pc-h`, ADR 0041) og åpner prosjektet ved klikk. Ingen chip på hver rad: gruppeoverskriften sier alt chipen ville sagt.

**Tre handlinger, ikke ni:** krysse av, «▸ Utsett», og ✎ som åpner oppgaven. **Ingen slett.** Å slette prosjektinnhold fra en liste der resten av saken ikke er synlig er lettere å gjøre ved et uhell enn å angre — og sletting hører hjemme på prosjektsiden. Venstresveip på mobil er av samme grunn koblet fra for disse radene; høyresveip fullfører, som ellers.

**Bøtta vises ikke når den er tom** (samme regel som «uten frist» på Hjem, ADR 0038) og **skjules i velg-modus** (radene kan ikke masseredigeres — ADR 0042 dekker frie To Do's, og en synlig liste med rader man ikke kan velge er en gåte).

`_postponeDue(t, by)` er trukket ut av `HANDLERS.postponeTask` slik at frie og prosjektoppgaver deler samme datologikk i stedet for to kopier.

## Consequences

**Vi aksepterer:**

- **To Do's-siden blir lengre.** Elleve rader pluss fem gruppeoverskrifter nederst. Det er poenget — de var usynlige.
- **Prosjektoppgaver kan ikke prioriteres.** De har ingen `priority`, og de får den ikke her. Vil hun prioritere en, hører den egentlig hjemme som en fri To Do tagget til prosjektet — som er den veien som alt finnes.
- **Prosjektoppgaver er ikke med i masseredigering.** ADR 0042 gjelder frie To Do's; bøtta skjules i velg-modus i stedet for å vise rader man ikke kan velge.
- **Ingen manuell omsortering i bøtta.** Rekkefølgen der følger frist; manuell rekkefølge bor på prosjektsiden, der draghåndtakene er.
- **Delmål er ikke med.** De har `date`, ikke `due`, går ikke gjennom `_setDone` (ADR 0037), og er milepæler — ikke oppgaver. De står fortsatt på Hjem når de forfaller.
- **Merkelappen på To Do's-fanen er uendret** (urgent + innboks). Å legge elleve prosjektoppgaver inn i tallet ville gjort merkelappen til «antall ting som finnes» i stedet for «antall ting som haster».

**Vi får:**

- 35 nye assertions, og de dekker **begge** retningene eksplisitt: avkryssing i To Do's setter `done` + `doneAt` på prosjektobjektet og viser den som fullført på prosjektsiden; avkryssing på prosjektsiden setter `done` på en tagget fri To Do. Pluss: arkiverte prosjekter utelatt, filteret følger prosjektets kategori, ingen dobbeltføring, ingen slett-knapp i raden, bøtta forsvinner når den er tom og i velg-modus.
- Negativ kontroll: 8 feiler mot forrige commit.
- Visuelt verifisert på 1280 og 390 px, lys og mørk modus. Median radhøyde i bøtta: 42 px på desktop, 57 px på telefon.

## Alternatives considered

**Blande prosjektoppgaver inn i prioritetsbøttene** og gi dem et `priority`-felt. Kraftigst — én liste å prioritere i. Forkastet nå: alle elleve ville startet i «Ukategorisert» og gjort den bøtta ubrukelig, og det er en datamodell-endring (`priority` på underoppgaver) for en gevinst hun ikke har bedt om. Døra står åpen: den som vil prioritere en prosjektoppgave kan gjøre den til en tagget fri To Do.

**Én samlet bøtte sortert etter frist, uten gruppering.** Enklere å skanne kronologisk, og hver rad ville hatt prosjekt-chip. Forkastet: hun tenker i saker («hva gjenstår på Meox?»), og grupperingen svarer på det uten at man må lese elleve chips.

**Full redigering i raden** — prioritet, flytt til annet prosjekt, slett. Forkastet etter spørsmål til henne: sletting av prosjektinnhold hører hjemme der resten av saken er synlig.

**Slå sammen `p.tasks` og `state.tasks` til én liste i datamodellen** og bare skille dem med et `projectId`. Den *riktige* modellen, antakelig — og den ville gjort hele denne ADR-en unødvendig. Men det er en `version: 5`-migrasjon av all oppgavedata hennes, og `loadState` er der en feil koster ekte data. Egen runde, egen ADR.

**Vise prosjektoppgaver i «Ukategorisert» med en visuell markør.** Halvveis mellom de to hovedalternativene, og arver ulempen fra begge: bøtta mister betydning, og oppgavene får ingen egen gruppering.
