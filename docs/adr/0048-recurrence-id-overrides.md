# ADR 0048 — RECURRENCE-ID: overstyrte forekomster kobles til serien

**Status:** Accepted
**Date:** 2026-09-17
**Bygger på:** 0025 (RRULE-grensen), 0028 (tidssoner per forekomst), 0032 (Outlook-cachen)

## Context

[ADR 0025](0025-rrule-support-boundary.md) satte grensen for RRULE-støtten og listet `RECURRENCE-ID` som ikke støttet. Symptomet som var notert: «flytter du én forekomst av en serie i Outlook, vises den fortsatt på det opprinnelige tidspunktet».

Det var en undervurdering. Da koden ble lest, var oppførselen verre på to måter:

1. **En flyttet forekomst sto to steder samtidig.** Masteren genererte forekomsten på gammelt tidspunkt, *og* Outlooks overstyrings-VEVENT ble lest som en helt egen hendelse og lagt til. Begge fikk id-rot `ics-<uid>`, så de kolliderte også.
2. **En enkeltavlysning forsvant sporløst.** Avlyser man ett møte i en serie, sender Outlook en VEVENT med samme UID, en `RECURRENCE-ID` og `STATUS:CANCELLED`. Leseløkka kastet alt med `STATUS:CANCELLED` før noen så at den pekte på én forekomst — så beskjeden om avlysning ble kastet, og møtet ble stående.

Grunnen til at ingen av delene kunne kobles: `parseICS` bygget hendelser fortløpende mens den leste. En overstyring kan stå hvor som helst i filen, også **før** serien den hører til, så ingenting kan avgjøres underveis.

## Decision

**`parseICS` leser i to omganger.**

Første omgang samler rå VEVENT-poster og filtrerer ingenting bort. Andre omgang, `_assembleICS(records)`, kobler dem:

- Poster **uten** `RECURRENCE-ID` er mastere. En master med `STATUS:CANCELLED` er en avlyst hendelse eller serie og gir ingen forekomster, som før.
- Poster **med** `RECURRENCE-ID` er overstyringer, gruppert på UID.
- Ved ekspansjon av en master sendes overstyringenes kildedatoer inn i `expandRRule` og legges i **samme hoppesett som `EXDATE` allerede bruker**. Den sjekken ligger før tidssonekonverteringen, så koblingen koster ingenting i ytelse.
- En overstyring som ikke er avlyst blir sin egen hendelse, med id `ics-<uid>-ovr-<kildedato>` — som ikke kan kollidere med seriens `ics-<uid>-<n>`.
- En overstyring som *er* avlyst gir ingen hendelse. Forekomsten er allerede hoppet over i serien, og det er hele poenget med den.
- En **foreldreløs** overstyring (ingen master med samme UID i filen) blir en frittstående hendelse framfor å forsvinne.

`_buildICSEvent(cur)` er skilt ut av den gamle løkka og bygger én hendelse av én post. Ingen logikk er endret der.

**Koblingsnøkkelen er kildekalenderens dato** (`srcDate`, [ADR 0028](0028-ics-timezones-per-occurrence.md)), samme nøkkel som `EXDATE` matcher på.

## Consequences

**Vi aksepterer:**

- **To forekomster av samme serie på samme dato i kildekalenderen kan ikke skilles.** Nøkkelen er dato, ikke tidspunkt. `EXDATE` har hatt nøyaktig samme begrensning siden 0025, og å ha to ulike nøkkelregler i samme sett ville vært verre enn begrensningen. En serie som går to ganger samme dag finnes ikke i Marias kalender.
- **`RANGE=THISANDFUTURE` behandles som en vanlig enkeltoverstyring.** Parameteren leses ikke i det hele tatt — et felt vi lagrer uten å bruke er en forpliktelse, ikke en ressurs. I praksis avslutter Outlook serien med `UNTIL` og starter en ny UID når man endrer «denne og påfølgende», så den veien er dekket. Endrer en avsender likevel med `RANGE`, blir de senere forekomstene stående med gamle verdier — som er dagens oppførsel, altså ingen regresjon.
- **En uleselig `RECURRENCE-ID` gjør posten til en frittstående hendelse**, og skriver til konsollen. Å kaste den stille var det gamle problemet.

**Vi får:**

- `tests/ics.mjs` 61 → **80** assertions. **11 av de 19 nye feiler mot forrige commit.** De åtte som passerer begge veier er regresjonsvakter — foreldreløs overstyring, avlyst master, `EXDATE` — og teller ikke som bevis for endringen.
- Målt forskjell på en ukentlig serie med fem forekomster: én flyttet ga **6** hendelser før (den gamle sto igjen), **5** nå, på ny dato og nytt klokkeslett. Én avlyst ga **5** før, **4** nå. Én med endret tittel ga **6** før med 10. juni to ganger, **5** nå med én rad og ny tittel.
- Rekkefølgen i filen har ikke lenger noe å si.

## Alternatives considered

**Matche på hele tidsstempelet i stedet for datoen.** Presist, og ville løst tvillingforekomstene. Forkastet: da har `EXDATE` og `RECURRENCE-ID` ulike nøkkelregler i samme hoppesett, og den billige forhånds-sjekken før tidssonekonvertering (0032) må gjøres to ganger med to semantikker. Prisen er høyere enn begrensningen.

**Implementere `RANGE=THISANDFUTURE` ved å avslutte serien og starte en ny internt.** Riktig etter spesifikasjonen. Forkastet nå: Outlook gjør det med ny UID uansett, koden ville vært umulig å teste mot ekte data vi ikke har, og halvveis implementert ville den gitt dubletter der dagens kode i det minste er konsekvent feil.

**Beholde énpass-lesingen og etterbehandle hendelseslista.** Mindre omskriving. Forkastet: da må man rekonstruere hvilken hendelse som kom fra hvilken VEVENT etter at informasjonen er kastet, og `STATUS:CANCELLED`-postene er allerede borte på det tidspunktet.
