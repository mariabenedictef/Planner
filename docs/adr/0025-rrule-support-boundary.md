# ADR 0025 — Hva RRULE-ekspansjonen støtter, og hva den bevisst ikke støtter

**Status:** Accepted
**Date:** 2026-08-10

## Context

Helsesjekken 2026-08-10 fant seks bekreftede feil i ICS/RRULE-ekspansjonen. Alle viste gale datoer eller tider *uten feilmelding* — kalenderen så riktig ut og var feil. Verifisert med håndskrevne ICS-fixtures mot `parseICS`:

| Feil | Bekreftet resultat |
|---|---|
| MONTHLY kollapset til den 1. | `DTSTART 15. aug` + `FREQ=MONTHLY;COUNT=5` → 15. aug, **1. sep, 1. okt, 1. nov, 1. des** |
| COUNT-budsjettet brukt opp i fortiden | `FREQ=WEEKLY` fra 2016 → **0 hendelser**. `UNTIL=2030` hjalp ikke |
| `BYDAY` parset men ubrukt | `FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=9` → **9 mandager på rad** |
| `EXDATE` ikke parset | Avlyste enkeltforekomster vist videre for alltid |
| `TZID` ignorert | `TZID="Eastern Standard Time":140000` vist som **14:00**, ikke 20:00 |
| Sommertid | `07:00Z` ukentlig → **07:00 for alle**, altså én time feil fra 26. oktober |

Årsakene var forskjellige, men to var strukturelle. `addMonths(d,n)` er `new Date(y, m+n, 1)` — den snapper til den 1. med vilje, for kalender-navigasjon, og ble gjenbrukt i RRULE-ekspansjonen. Og forekomstene ble beregnet *iterativt* (`cur = neste(cur)`), som gjør at enhver avrunding akkumulerer, samtidig som telleren `n` ble økt også for forekomster før visningsvinduet — så en serie som startet for år siden brukte hele COUNT-budsjettet på 500 i fortiden og forsvant.

De to siste (TZID og sommertid) er av en annen art: de krever tidssone-kunnskap. Outlook sender Windows-sonenavn (`W. Europe Standard Time`), ikke IANA-navn, så en korrekt implementasjon trenger en Windows→IANA-tabell pluss offset-oppslag per forekomst. Det er å reimplementere en bit av det Microsoft Graph gir oss ferdig ekspandert fra serveren (ADR 0003 valgte ICS-proxy nettopp for å unngå Graph-avhengigheten).

Vi trengte derfor både å fikse det som er lokalt løsbart, og å **skrive ned grensen** — så neste person som ser en feil dato vet om det er en bug eller en dokumentert begrensning.

## Decision

### Forekomster beregnes fra DTSTART, ikke iterativt

Ny `_rruleOccurrences(baseStart, params, winEnd, maxOcc)` returnerer datoene i kronologisk rekkefølge, hver beregnet direkte fra `baseStart`. Ingen akkumulert drift. Ny `addMonthsKeepDay(d, n)` bevarer dag-i-måned med klamping (31. januar + 1 måned = 28./29. februar), og er eksplisitt navngitt for å ikke bli forvekslet med `addMonths`, som fortsatt snapper til den 1. for navigasjon.

### COUNT betyr antall forekomster, og mangler COUNT er det ingen grense

`COUNT` honoreres som spesifisert, talt fra DTSTART. **Uten** `COUNT` er det ingen forekomst-grense — visningsvinduet (12 måneder bak, 24 fram) og `UNTIL` avgrenser løkka, med `MAX_OCC = 20000` som sikkerhetsnett (~54 år daglig, ~384 år ukentlig). Den gamle defaulten på 500 var årsaken til at gamle serier forsvant.

### Støttet

`FREQ` DAILY/WEEKLY/MONTHLY/YEARLY · `INTERVAL` · `COUNT` · `UNTIL` · `BYDAY` for WEEKLY (`MO,WE,FR`) og for MONTHLY med ordinal (`1MO`, `3WE`, `-1FR` = siste fredag) · `EXDATE` · flerdagsvarighet bevart over gjentakelser · `DURATION` når `DTEND` mangler · linjebrytning, escaping, LF/CRLF · all-dag med eksklusiv `DTEND` · `STATUS:CANCELLED` ekskludert · `VALARM`-blokker hoppes over slik at alarmens `DESCRIPTION` ikke overskriver hendelsens · hendelser uten `SUMMARY` vises som «(uten tittel)» i stedet for å forsvinne.

### Bevisst ikke støttet — dette er grensen

- **`TZID`.** Tider uten `Z`-suffiks behandles som lokal tid. Et møte satt opp i en annen sone vises med avsenderens klokketid. **Løses av Microsoft Graph, ikke av oss.**
- **Sommertid per forekomst.** Gjentakelser arver basetidens ferdig konverterte klokketid, så en UTC-definert serie er én time feil etter et sommertidsskifte. Samme begrunnelse.
- **`RECURRENCE-ID`-overstyringer.** Et flyttet enkeltmøte i en serie vises både på det opprinnelige og det nye tidspunktet. Krever at master og overstyring parres på UID.
- **`BYSETPOS`, `BYMONTHDAY`, `BYMONTH`, `BYWEEKNO`, `BYYEARDAY`.** Ikke sett i Outlook-feeden hennes.
- **`EXDATE` matches på dato, ikke tid.** To forekomster samme dag kan ikke ekskluderes hver for seg.
- **`[[...]]`-wikilinks over formatering** — hører til ADR 0019, nevnt her fordi grensen er av samme type: dokumentert, ikke glemt.

Denne lista er kontrakten. Dukker en av dem opp som «bug» senere, er svaret å veie Graph mot å utvide parseren — ikke å lappe på den i det stille.

## Consequences

**Vi aksepterer:**

- Kalenderen kan fortsatt vise feil tid for møter fra andre tidssoner, og for UTC-definerte serier etter et sommertidsskifte. Det er nå dokumentert, ikke ukjent — men det er fortsatt feil på skjermen, og det er den vanskeligste konsekvensen å svelge.
- `_rruleOccurrences` er ~70 linjer mer kode enn den gamle løkka, med tre separate grener for BYDAY-varianter.
- Uten COUNT itererer vi til vinduets slutt. For en daglig serie er det ~1 100 iterasjoner per sync — uten praktisk betydning, men det er ikke lenger et konstant tak.
- `MAX_OCC` på 20 000 er vilkårlig. Den finnes for å hindre en løpsk løkke, ikke for å uttrykke noe om data.

**Vi får:**

- Verifisert etter fiksen: MONTHLY fra 15. august gir den 15. hver måned. Ukesmøtet fra 2016 gir 157 forekomster (hele vinduet) i stedet for null. `BYDAY=MO,WE,FR` gir mandag/onsdag/fredag. `EXDATE` ekskluderer. VALARM overskriver ikke. Kontrollen (vanlig ukentlig serie i vinduet) er uendret grønn.
- En skrevet grense, som er det som gjør «vi fikser ikke dette nå» til en beslutning i stedet for en forglemmelse.

## Alternatives considered

**Implementere TZID og sommertid nå.** Windows→IANA-tabell (~20 realistiske oppføringer) pluss `Intl.DateTimeFormat` for offset per forekomst. Teknisk gjørbart uten byggesteg. Forkastet i denne runden: det er det største enkeltarbeidet i hele helsesjekken, og det duplikerer det Graph gir gratis. Beslutningen er utsatt til Graph-forespørselen til Bluefront IT er besvart — se `docs/graph-it-request.md`.

**Bruke et ICS-bibliotek (ical.js, rrule.js).** Løser alt over, godt testet. Forkastet: ADR 0001/0013 holder appen byggefri og avhengighetsfri, og rrule.js alene er større enn hele `app.js`. En CDN-import ville også gjort appen avhengig av at CDN-en svarer, som bryter med offline-PWA-premisset.

**Flytte ekspansjonen til Cloudflare-workeren.** Workeren har allerede feeden, kan bruke npm-pakker, og planleggeren ville bare mottatt ferdige forekomster. Reelt attraktivt, og det er hva Graph i praksis gjør for oss. Verdt å vurdere hvis svaret fra IT blir nei.

**Ikke gjøre noe** — dokumentere alle seks som kjente feil. Forkastet: fire av dem var lokalt løsbare på noen timer, og to av dem (MONTHLY, COUNT) rammer helt vanlige møtemønstre.
