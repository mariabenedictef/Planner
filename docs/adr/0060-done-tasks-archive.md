# ADR 0060 — Fullførte oppgaver forsvinner fra prosjektlista og samles i et arkiv

**Status:** Accepted
**Date:** 2026-10-14
**Bygger på:** 0037/0052 (`_setDone` og `doneAt`), 0049 (ett oppgavelager), 0056 (designsystemet)

## Context

Maria sendte et skjermbilde av Anteo AS: alle ni oppgavene var krysset av og sto gjennomstreket i lista. Hun ba om at fullførte oppgaver skal forsvinne og ligge «i typ et arkiv man kan åpne hvis man vil se, typ "Fullførte oppgaver"».

Prosjektsiden sorterte de fullførte sist, men viste dem i samme liste. På et prosjekt som har pågått en stund blir lista lengre for hver ting som blir gjort, og de åpne oppgavene drukner. To Do's og «Fra prosjekter» viste allerede bare åpne oppgaver — prosjektsiden var unntaket.

## Decision

**Prosjektlista viser bare åpne oppgaver.** Under dem står en dempet linje, **«Fullførte oppgaver 9 ›»**, lukket som standard. Et trykk åpner den, og da står de fullførte under:

- **Sist fullført øverst**, etter `doneAt`. Oppgaver fullført før ADR 0052 har ikke tidsstempel og står nederst, etter frist.
- **Datoen i arkivet er når den ble fullført** (tittel «Fullført …»), ikke fristen.
- **Fjerner du haken, kommer oppgaven tilbake i lista** — samme handler som før (`toggleTask` / `toggleProjectTask`), ingen egen angre-mekanisme.
- Arkivrader kan ikke dras (rekkefølgen er tidspunktet); ✎ og × virker som før.

**Er alle oppgavene gjort**, står det «Alle oppgavene er fullført» med «+ Ny oppgave», og arkivet under.

**Arkivet åpnes per prosjekt og huskes bare til siden lastes på nytt** (`_doneArchiveOpen`, i minnet). Det er et sted man kikker innom, ikke en innstilling — det skal være lukket neste gang.

Avkryssingen animeres ut som før (`_animateCompletion`), så raden glir bort i stedet for å blinke vekk, og telleren i arkivlinja går opp.

**Utenfor:** Kanban beholder sin «Ferdig»-kolonne — der er status hele poenget. Delmål er uendret; de er sjekkpunkter i prosjektets tidslinje, og det er nyttig å se hvilke som er nådd.

## Consequences

**Vi aksepterer:**

- **En fullført oppgave er ett trykk unna**, ikke synlig. Det er det hun ba om.
- **Arkivet lukkes når appen lastes på nytt.** Åpent arkiv er et unntak, ikke en tilstand.
- **Oppgaver fullført før 21. september har ingen fullføringsdato** og står nederst i arkivet.

**Vi får:** prosjektsider som viser det som gjenstår, uansett hvor lenge prosjektet har gått.

## Verifisering

- `tests/run.mjs`: 745 → **753**, grønt i UTC og Europe/Oslo. **Én test er snudd:** «prosjektsiden viser den som fullført» (gjennomstreket i lista) er nå «står ikke lenger i prosjektlista» + «ligger i arkivet, som er lukket». Nye: antall i arkivlinja, åpnet arkiv viser raden som fullført med fullføringsdato og uten dra, haken av gir den tilbake, «Alle oppgavene er fullført», og rekkefølgen sist-fullført-først med tidsstempelløse nederst. **Mot forrige versjon feiler 8.**
- `tests/browser.mjs`: 57/57 (kontrast 0 brudd, telefonradene uendret). `tests/ics.mjs`: 80/80.
- Skjermbilder PC og telefon, lys og mørk, med arkivet lukket og åpent.
