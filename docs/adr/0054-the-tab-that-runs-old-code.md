# ADR 0054 — Fanen som kjører gammel kode, delmål i To Do's, og restlista gjort opp

**Status:** Accepted
**Date:** 2026-09-21
**Bygger på:** 0036 (adressen er posisjon), 0037 (`_setDone`), 0039 (angring), 0045/0049 (ett oppgavelager), 0052, 0053

## Context

Maria ba om at hele «fortsatt uavklart»-lista ble gjort opp. Lista hadde tre slag på seg, og de fortjener ikke samme behandling: **hull i verifikasjonen**, **ting som aldri var bestilt**, og **valg som er avvist med vilje**. Det siste slaget skal ikke «løses» — det skal begrunnes på nytt eller omgjøres.

To ting pekte seg ut.

**Hver eneste runde endte med «husk å laste appen på nytt på iPhonen».** Det er ikke en fotnote — det er en instruksjon appen tvinger et menneske til å huske, hver gang, for alltid. Og konsekvensen av å glemme den er ikke kosmetisk: en klient som kjører v4-kode og puller et v5-blob plasserer underoppgavene feil (ADR 0049). En PWA på hjemskjermen kan stå åpen i ukevis uten å hente `app.js` på nytt; `index.html` peker på `app.js` uten versjonsparameter, og det finnes ingen service worker. Beskjeden var det eneste vernet, og den lå hos henne.

**Delmål sto i ingen To Do-visning i det hele tatt.** De finnes på prosjektsiden, i kalenderen, og på Hjem for i dag og for forfalte. Men To Do's — sida hun bruker når hun spør «hva skal jeg gjøre» — viste dem ikke. Et delmål 5. oktober var usynlig der helt til dagen kom.

Bugjakten denne runden fant for øvrig ingenting nytt: 105 handlere uten duplikater eller døde, ingen `data-action` uten handler, ingen bare `HANDLERS`-kall, ingen lytterlekkasje (57 `addEventListener`, alle på modulnivå — ingen inne i en render-vei), ingen ufangede `await`, ingen `console.log`, og hvert navn `CONTEXT.md` nevner finnes i koden.

## Decision

### Appen oppdager selv at den kjører gammel kode

```js
const [kjører, ute] = await Promise.all([
  fetch('app.js', { cache: 'force-cache' }).then(r => r.ok ? r.text() : ''),
  fetch('app.js', { cache: 'no-store'   }).then(r => r.ok ? r.text() : '')
]);
if (_sourceFingerprint(kjører) !== _sourceFingerprint(ute)) /* vis melding */
```

Kjernen er hvordan vi vet hva som **kjører** uten et byggnummer: `cache:'force-cache'` gir bytene nettleseren allerede har — altså dem som ble kjørt — uten å røre nettet. `no-store` gir det som ligger ute nå. **Ingen konstant å glemme å bumpe, og ingen ekstra fil som kan komme ut av synk med koden.** Det var hele grunnen til å velge denne varianten framfor et versjonsnummer: et versjonsnummer er en påstand noen må vedlikeholde, og denne loggen er full av påstander som sluttet å stemme.

Avtrykket er FNV-1a pluss lengden — ingen krypto-krav, vi trenger bare å se at to strenger er *ulike*, og `crypto.subtle` finnes ikke over http på eldre iOS. Sjekken kjører 20 sekunder etter oppstart og når fanen blir synlig igjen, strupet til maks fire ganger i døgnet. Feiler den — offline, server nede — sier den ingenting: **en falsk «ny versjon» er verre enn ingen.** Meldingen er en toast med lang varighet og en «Last på nytt»-knapp (ADR 0039 ga toasten knappen allerede; en ny komponent for én melding er ikke verdt det), og knappen kjører `saveState()` før `location.reload()`, så alt hun har skrevet i økta ligger trygt før vinduet kastes.

### Delmål står i «Fra prosjekter», i sin egen liste

De hører ikke hjemme i prioritetsbøttene — de bærer `date`, ikke `due`, og de har ingen prioritet, så å plassere dem der ville krevd en oppfunnet en. Men bøtta «Fra prosjekter» grupperer allerede på prosjekt, og der trengs ingen prioritet.

Raden er **bevisst ulik en oppgaverad**: rombe i stedet for firkant, dempet farge, og ingen utsett-nedtrekk — et delmål er en dato man når eller bommer på, ikke en frist man skyver. De står etter oppgavene i gruppa, og **de er ikke valgbare i velg-modus**: masseoperasjonene setter `due` og `projectId`, og et delmål har ingen av delene. Gruppas sorteringsnøkkel ser nå på delmålene også, så et prosjekt hvis nærmeste hendelse er et delmål ikke havner nederst.

**To eldre assertions er snudd med vilje**, av samme grunn som i ADR 0052: «delmål er ikke med i bøtta» og «bøtta vises ikke når det ikke finnes prosjektoppgaver» beskrev begge oppførselen vi nettopp rettet. Den andre var dessuten for løs — den ville godtatt en bøtte som skjulte delmål. Den er delt i to: bøtta står så lenge det finnes et åpent delmål, og forsvinner først når verken oppgaver eller delmål er igjen.

### Resten av lista, punkt for punkt

| Punkt | Avgjørelse |
|---|---|
| Delmål-`doneAt` og den høylytte veien i drop-handlerne var bare testet i jsdom | **Lukket.** Verifisert i ekte Chromium mot en fixtur av hennes egne data: ekte klikk på avkryssingsboksen, `doneAt` lest tilbake fra `localStorage`. Den høylytte veien med **feilinjeksjon** — én linje endret i en kopi, og kopien lagt tilbake og byte-sjekket etterpå. |
| «Last appen på nytt på iPhonen» | **Lukket.** Se over. |
| Delmål usynlige i To Do's | **Lukket.** Se over. |
| Delmål krysset av før i dag har ikke `doneAt` | **Kan ikke lukkes.** Tidspunktet finnes ikke noe sted. Å sette `date` eller dagens dato som `doneAt` ville vært å finne på data — verre enn å mangle dem. Ukesoppsummeringen teller dem videre som «gjort uten tidsstempel», som er sant. |
| Prosjektunderoppgaver har ingen `priority` | **Fortsatt avvist.** De arver prosjektets kategori (ADR 0049). En egen prioritet ville vært en andre akse uten noe sted å vises: prioritetsbøttene leser `kind:'free'`, og å slippe underoppgaver inn der ville gjort «Fra prosjekter» overflødig og prosjektsiden til en dublett. |
| Generell angring via kommandolog | **Fortsatt avvist, men restfeltet er mindre.** Etter 0051 og 0052 dekker feltøyeblikksbildet masseoperasjonene *og* skjemaet. Det som står igjen uten angring er sletting av et helt prosjekt, alle forekomster av en gjentakende hendelse, og massesletting — og alle tre står bak `confirm()` (ADR 0039). En kommandolog måtte gått gjennom elleve skrivesteder for å dekke det siste. |
| Kalenderpilene pusher ikke historikk | **Fortsatt avvist** (ADR 0036). Å bla fire uker fram ville lagt fire oppføringer i tilbakeknappen; på telefon, der bla er en sveip, ville den blitt ubrukelig. |
| Ukesoppsummeringen er beregnet, ikke lagret | **Fortsatt avvist, og det er en styrke.** En lagret oppsummering er en cache som kan bli gammel — nøyaktig feilen ADR 0030 og 0032 handler om. Beregnet kan den ikke lyve. |
| En masseoperasjon kan treffe begge slag oppgaver | **Ikke en feil.** Akseptert konsekvens i ADR 0052, og den følger av at hun valgte radene. |
| Tre lyse flater i mørk modus | **Med vilje** — merkeprikk, FAB og toast er alle `--accent`. |
| `RANGE=THISANDFUTURE` | **Fortsatt avvist** (ADR 0048). Outlook lager ny UID, så en implementasjon kunne ikke testes mot ekte data — og utestet kode i ICS-laget er dyrere enn en manglende funksjon. |
| Microsoft Graph | **Dødt.** «Nr. 2 kommer aldri til å skje». |
| Kommandopalett, `.ics`/`mailto`, personer på kort, 141 inline-stiler | **Ikke uavklarte punkter** — forslag jeg har lagt fram og hun ikke har bedt om. De blir stående som forslag. |

## Consequences

**Vi aksepterer:**

- **Oppdateringssjekken laster ned `app.js` to ganger** — den ene fra cache (ingen nettrafikk), den andre ~113 kB gzippet. Maks fire ganger i døgnet. På mobildata er det målbart, men lite, og prisen er at hun aldri mer må huske å laste på nytt.
- **`force-cache` er en antakelse om at cachen speiler det som kjører.** Den holder nesten alltid. Er cachen tømt, går den til nett, begge blir like, og ingen melding kommer — feil vei, som er den trygge. Er cachen oppdatert etter at koden ble kjørt, kan hun få en melding hun ikke trengte; å laste på nytt skader ingenting.
- **Meldingen kan komme mens hun holder på med noe.** Den forsvinner ikke av seg selv på et døgn, og knappen lagrer først. Men en toast som står lenge er i veien, og det er et bevisst bytte mot at beskjeden faktisk blir sett.
- **Delmål i To Do's blander to begreper på én side.** Romben, fargen og fraværet av utsett-nedtrekk skal bære forskjellen. Klarer de ikke det, er neste steg en egen overskrift i gruppa — ikke å fjerne dem igjen.
- **Sju av punktene på lista ble avvist på nytt, ikke løst.** Det var det hun ba om at jeg tok stilling til, og et «nei» med grunn er et svar. Men det betyr at lista ikke blir tom.

**Vi får:**

- `tests/run.mjs` 626 → **649 assertions**, og en ny nettlesersuite på **23** som kjører ekte Chromium mot en fixtur av hennes data. **11 av 642 feiler mot live-koden** (`bf598a6`); kontrollen teller sju færre fordi seksjon 43s vakter hopper over undersjekker når funksjonene mangler.
- Målt i ekte nettleser: delmålsrad med rombe og uten utsett, ekte klikk gir `done` + `doneAt` i `localStorage` og **ingen** `status`, 0 horisontal overflyt, 0 konsollfeil; tom nyttelast på en bøtte er stille og rører ingen data; en feilinjisert flytting gir én melding som nevner skjemaet; oppdateringsvarselet dukker opp av seg selv med «Last på nytt».
- 106 handlere, 0 duplikater, 0 `data-action` uten handler, `node --check` OK.

## Alternatives considered

**Et byggnummer i `app.js` + en `version.json`.** Den vanlige løsningen. Forkastet: to steder å holde i synk, og den ene oppdateres for hånd hver runde. Denne loggen er full av påstander som sluttet å stemme fordi noen glemte å oppdatere dem — `CONTEXT.md` sa «ikke støttet: `RECURRENCE-ID`» i en uke etter at det var støttet. Å sammenligne filen med seg selv kan ikke drifte.

**`?v=<hash>` på `<script src>`.** Løser ingenting alene: `index.html` er selv cachet, så en fane som står åpen ser aldri den nye parameteren.

**En service worker med `skipWaiting`.** Den riktige langsiktige løsningen, og den ville dessuten gjort appen brukbar offline. Forkastet nå: en service worker er et nytt cachelag med egen livssyklus over en app som allerede har to (HTTP-cachen og `localStorage`), og feilmodusen er at hun sitter fast på en gammel versjon uten å kunne komme videre. Det er et større inngrep enn denne runden, og det bør være sin egen ADR.

**HEAD-forespørsel og sammenligne `ETag`.** Billigere — ingen kropp å laste. Forkastet: ETag-en vi ville sammenlignet mot er den *serveren* har nå, ikke den koden som kjører, så den fanger bare endringer som skjer etter at fanen ble åpnet. Den vanligste situasjonen — telefonen som har stått åpen siden i går — er nettopp den den ville bommet på.

**Egen bøtte for delmål i To Do's, ved siden av «Fra prosjekter».** Ryddigere begrepsmessig. Forkastet: da står prosjektets navn to steder på samme side, og delmålet mister nærheten til oppgavene det hører sammen med.
