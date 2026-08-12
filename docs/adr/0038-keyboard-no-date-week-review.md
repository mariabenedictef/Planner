# ADR 0038 — Hurtigtaster, «uten frist», og ukesoppsummering

**Status:** Accepted
**Date:** 2026-08-12
**Bygger på:** 0037 (`doneAt`)

## Context

Tre uavhengige mangler i en app Maria er i daglig, samlet fordi de alle handler om å få tak i noe som *finnes* men ikke er synlig:

1. **Søket lå bak et museklikk,** og resultatlista kunne bare klikkes. Enter i søkefeltet gjorde ingenting.
2. **En To Do uten frist er praktisk talt usynlig.** Dag, Uke og Måned viser ting på en dato; en oppgave uten dato har ingen. Målt på hennes data: flere prosjekter har To Do's uten frist, og de dukker bare opp hvis man går inn i To Do's-visningen og leter.
3. **Ingen oversikt over uka.** Hva ble gjort, hva glapp, hva kommer — tre spørsmål som krever tre forskjellige visninger og litt hoderegning.

## Decision

### 1. Hurtigtaster

- **`/`** åpner søket — men bare når markøren ikke står i et felt, ellers kunne man ikke skrevet skråstrek.
- **Ctrl/Cmd+K** åpner søket uansett hvor markøren står.
- **↑ ↓** flytter en markering i resultatlista, **Enter** åpner den markerte. Uten markering åpner Enter det øverste treffet, som er det man mener når man har skrevet et søk og trykker Enter.
- Markeringen er tydeligere enn hover (`box-shadow: inset 3px 0 0 var(--accent)`), fordi den forteller hvor Enter kommer til å treffe.

Klikk og Enter går gjennom **samme funksjon** (`_searchOpenHit`). Åpne-logikken hadde sju grener; å duplisere dem for tastaturet ville garantert drift.

### 2. «Uten frist» på Hjem

En seksjon mellom «Forfaller i dag» og «Aktive prosjekter», som viser alt som gjenstår og mangler dato — både frie To Do's og prosjektenes egne oppgaver, med prosjekt-chip. Maks 8, deretter «+N til».

**Seksjonen vises ikke i det hele tatt når den er tom.** En permanent tom boks på den viktigste skjermen er kostnad uten nytte.

### 3. Ukesoppsummering

Et panel med tre bolker, åpnet fra en knapp ved datoen på Hjem:

- **Gjort siste 7 dager** — fra `doneAt` (ADR 0037)
- **Glippet** — forfalt og ikke gjort, inkludert delmål
- **Neste 7 dager** — frister framover, inkludert delmål

Alt regnes ut av data som finnes; ingenting lagres. Radene er klikkbare inn til oppgaven eller prosjektet. Respekterer Jobb/Privat-filteret, som resten av appen.

**`doneAt` finnes bare fra 2026-08-12.** Er det fullførte oppgaver uten tidsstempel og ingen med, viser panelet en merknad om at tidspunktet ikke har blitt lagret før i dag, med antallet — i stedet for en tom liste som leses som «du gjorde ingenting».

## Consequences

**Vi aksepterer:**

- **`/` er en global tast.** Den er avvergt inne i felt og når en dialog er åpen, men den er nå reservert. Det er den vanlige konvensjonen, og alternativet — ingen hurtigtast — var problemet.
- **Hjem blir lengre** når det finnes oppgaver uten frist. Det er tilsiktet: det er poenget at de blir synlige. Grensen på 8 holder seksjonen fra å dominere.
- **«Gjort» er tomt den første uka.** Ærlig, men det betyr at panelets mest motiverende bolk er den siste som fylles.
- **Ukesoppsummeringen er et vindu, ikke en logg.** Den lagrer ingenting, så den kan ikke vise «forrige uke» retrospektivt senere. Å lagre ukentlige snapshots ville vært en datamodell-endring for et panel man leser og lukker.
- Tastaturnavigasjonen dekker søket, ikke hele appen. Piltaster i lister og visninger er en større sak.

**Vi får:**

- 25 nye assertions: `/` åpner søket, `/` gjør det **ikke** mens man skriver, Ctrl+K virker, piltastene flytter markeringen begge veier, Enter åpner det markerte · «uten frist» finner riktig utvalg og forsvinner når den er tom · alle tre bolkene i oppsummeringen bøtter riktig, delmål er med i «glippet», og merknaden om manglende tidsstempel vises når den skal.
- Visuelt verifisert: Hjem med seksjonen, panelet med hennes egne prosjekter, og Dealflow som brett.

## Alternatives considered

**Cmd+K som eneste hurtigtast.** Mer moderne, men `/` er raskere med én hånd og er konvensjonen i verktøy man søker mye i. Begge koster to linjer.

**En full kommandopalett** (Cmd+K som «gjør hva som helst», ikke bare søk). Fristende og en naturlig utvidelse, men det krever et register over handlinger med navn og synonymer — en egen sak.

**«Uten frist» som egen visning eller filter i To Do's.** Ryddigere skille, men da må man oppsøke det. Poenget er at de skal møte henne der hun alt ser.

**Vise «uten frist» i Dag-visningen** som en ekstra boks. Forkastet: Dag handler om en dato, og disse har ingen.

**Ukesoppsummering som fast innslag på Hjem** i stedet for et panel. Forkastet: det er en ukentlig handling, ikke noe man vil se hver gang man åpner appen.

**Lagre ukentlige snapshots** så historikken finnes senere. Vurdert og utsatt — det er en datamodell-endring, og `doneAt` gir allerede grunnlaget for å regne det ut når som helst framover.
