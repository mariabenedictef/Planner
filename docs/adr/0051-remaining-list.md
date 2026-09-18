# ADR 0051 — Restlista: angring for endringer, dagsagenda i Måned, ekte 44 px

**Status:** Accepted
**Date:** 2026-09-18
**Bygger på:** 0039 (angre sletting), 0042 (masseredigering), 0048 (RECURRENCE-ID), 0050 (mobilmodellen)

## Context

Etter ADR 0050 sto det igjen en liste med «bevisste begrensninger» og «reelt åpne» punkter. Maria ba om at den ble gjort opp. Gjennomgangen skilte tre slag:

1. **Punkter som var reelle mangler, bare aldri bestilt.** Angring dekket sletting, men ikke *endring* — masseredigering kunne treffe tjue oppgaver på ett klikk og var uopprettelig (ADR 0042 nevnte det selv). Måned på telefon viste prikker og ingen tekst; ADR 0050 skrev selv at en dagsagenda var «det naturlige neste steget».
2. **Punkter jeg hadde beskrevet som umulige, men som viste seg å være løsbare.** ADR 0050 slo fast at avkryssingsboksene måtte bli 24 px fordi «en native `<input>` ignorerer polstring». Det stemmer — men med `appearance:none` er den ikke lenger et erstattet element, og da virker både størrelse og `::before`.
3. **Ett punkt jeg hadde beskrevet som teoretisk, men som var reelt.** ADR 0048 skrev at to forekomster på samme kildedato «ikke finnes i Marias kalender» og at nøkkelen derfor var praktisk talt unik. Målt: `FREQ=MONTHLY;BYDAY=1MO,1MO` ga **hver forekomst to ganger**, fordi ordinalene løkkes uten deduplisering. Da er kildedatoen ikke en unik nøkkel, og både `EXDATE` og `RECURRENCE-ID` ville truffet feil.

Og ett funn som ikke sto på lista i det hele tatt: **månedsrutenettet var ragget på desktop også.** Hver ukerad er sitt eget `display:grid`, så kolonnene sizes uavhengig per rad og etter innhold. Målt på 1280 px før fiksen: 42 celler med bredder fra **26 til 474 px**. Det er samme `1fr`-felle som gjorde Prosjekter 652 px bred (ADR 0050) — jeg fikset den bare for telefon fordi det var der jeg så etter.

## Decision

**Angring for endringer, ikke bare slettinger.** `registerUndo` har fått et `verb`-argument (standard `'Slettet'`), og to nye funksjoner ligger ved siden av `deleteWithUndo`:

```js
_snapshotFields(tasks, fields)          // { id, had:[...], <felt>:<verdi> } per oppgave
registerFieldUndo(snapshot, fields, label, verb)
```

Øyeblikksbildet tar vare på **feltene**, ikke objektene, og gjenopprettingen slår opp på `id` — samme grunn som `deleteWithUndo` slår opp lista på nytt (ADR 0039): et sky-pull mellom endring og angring bytter ut hele `state`, og en fanget referanse ville vært frakoblet. `had`-lista skiller «feltet var tomt» fra «feltet fantes ikke», så angringen kan *fjerne* en frist som ikke var der før.

Alle tre masseoperasjonene som endrer er dekket: frist, prosjekt, og «merk gjort». Massesletting hadde angring fra før.

**«Merk gjort» gjenopprettes uten `_setDone`,** og det er et bevisst unntak fra én-dør-regelen i ADR 0037: `_setDone(t, true)` stempler et *ferskt* `doneAt`, mens poenget her er å få tilbake nøyaktig det som sto. `done`, `doneAt` og `status` skrives derfor tilbake samlet. Trioen er hentet fra en tilstand `_setDone` selv har laget, så invarianten er like hel etterpå som før — og en test sjekker at `doneAt` er det gamle tidsstempelet og ikke et nytt.

**Dagsagenda under minikalenderen i Måned.** `_dayAgendaHTML(d, todayK, opts)` er skilt ut av `_renderWeekAgenda`, så ukeagendaen og dagsagendaen ikke kan drifte fra hverandre. På telefon velger et trykk på en dag dagen og fyller agendaen under rutenettet; visningen blir i Måned, ankeret flyttes, og adressen blir `#/maned/<dato>` (ADR 0036). På desktop går trykket til Dag som før. `opts.long` skriver ukedagen helt ut og sier «Ingenting denne dagen» i stedet for tankestrek, fordi seksjonen der står alene.

**Ekte 44 px avkryssingsboks.** `appearance:none` + `::before` som tegner en 22 px rute; boksens treffområde er 44 × 44, og **negative marginer (`margin:-11px`) gjør at layout-bredden er 22**, så raden ikke mister plass til tittelen. Målt: treffområde 24 → 44 px, median radhøyde uendret (61 px på ekte data), tittelen ble 9 px *bredere*. Filterknappene i topplinja er 32 → 40 px; topplinja er fortsatt 57 px.

**Én forekomst per kildedato, alltid.** `_rruleOccurrences` dedupliserer på datonøkkel før den returnerer. Ingen av grenene kan normalt gi to forekomster samme dato, men en gjentatt ordinal kunne — og nå er kildedatoen en **bevislig** unik nøkkel, ikke bare en praktisk talt unik. Det er nøkkelen `EXDATE` og `RECURRENCE-ID` matcher på.

**`minmax(0,1fr)` på månedsradene i BASISregelen**, ikke i mobilblokka. Kolonnene står nå i linje både innenfor en uke og mellom uker, på alle bredder. Mobil-overstyringen er fjernet som overflødig.

## Consequences

**Vi aksepterer:**

- **Avkryssingsboksene er tegnet av oss, ikke av systemet.** `appearance:none` betyr at de ikke lenger følger iOS' egen stil. De er 22 px med samme kantfarge som resten av rammeverket og en hake i `--accent` når de er krysset av — roligere enn systemets blå, men det er en endring hun vil se. Det er prisen for et treffområde som faktisk er 44 px.
- **Det negative marginet lar treffområdet blø 11 px inn i tittelens venstrekant.** Tittelen er et stort mål; å miste 11 px der er billigere enn å miste 20 px tittelbredde.
- **Desktop Måned ser annerledes ut.** Kolonnene er like brede nå. Det er en retting, men det er synlig, og hun har ikke bedt om det.
- **Angring for endringer gjelder masseredigering, ikke alt.** Å endre én oppgave i skjemaet kan fortsatt ikke angres. Et generelt angresystem er en kommandolog over hver mutasjon — egen runde, og det er masseoperasjonene som gjør skade på ett klikk.

**Vi får:**

- `tests/run.mjs` 555 → **588 assertions**. Seksjon 40 dekker øyeblikksbildets `had`-skille, at angring fjerner et felt som ikke fantes, at `doneAt` er det gamle og ikke et ferskt stempel, at angring på et tomt lager ikke kaster, dagsagendaens innhold og `long`-varianten, at telefon blir i Måned mens desktop går til Dag, og at en gjentatt `BYDAY`-ordinal ikke lenger gir dubletter. **23 av 588 feiler mot ADR 0050-bygget.**
- Målt: avkryssingsboks 24 → 44 px treffområde med uendret radhøyde · desktop-månedsceller fra 26–474 px til **171 px jevnt** · mørk modus fortsatt 3 tilsiktede lyse flater · 0 konsollfeil · desktop ellers uendret (månedscellenes høyder identiske, agendaen tom).

## Alternatives considered

**Wrappe avkryssingsboksen i en `<label>` på 44 px.** Standardløsningen, og den beholder systemets egen avkryssingsboks. Forkastet: det er en markup-endring i sju renderere, og den ville ikke løst at boksen da spiser 44 px av radbredden — som var grunnen til at 0050 lot være i utgangspunktet.

**La Måned navigere til Dag også på telefon, og droppe agendaen.** Færre begreper. Forkastet: å miste måneden for å se én dag er nettopp det som gjorde en telefonkalender tungvint; agendaen under lar henne bla gjennom dagene uten å forlate oversikten.

**Generell angring via en kommandolog.** Ville dekket alt, inkludert enkeltredigeringer. Forkastet nå: det krever at hver mutasjon går gjennom én dør, og appen har elleve skrivesteder for oppgaver alene. Feltøyeblikksbildet dekker skaden som faktisk skjer på ett klikk, og koster tjue linjer.

**La `RANGE=THISANDFUTURE` bli implementert samtidig.** Fortsatt forkastet, av samme grunn som i ADR 0048: Outlook lager ny UID, så koden ville ikke kunne testes mot ekte data.
