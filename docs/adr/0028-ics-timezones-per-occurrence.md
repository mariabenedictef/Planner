# ADR 0028 — ICS-tider konverteres per forekomst, med TZID

**Status:** Accepted (avgrenser 0025, avslutter 0003-avhengigheten)
**Date:** 2026-08-10

## Context

Helsesjekken samme dag fant seks feil i RRULE-ekspansjonen og fikset fire. To ble parkert eksplisitt:

> **B3–B6 (BYDAY, TZID, sommertid, EXDATE)** — større arbeid; her er spørsmålet egentlig om ICS-parsing skal fortsette å være vår jobb, eller om Microsoft Graph (ADR 0003 / `docs/graph-it-request.md`) er svaret.

BYDAY og EXDATE ble likevel fikset. TZID og sommertid ble stående, med Graph som forutsetningen for å avgjøre dem.

**Den forutsetningen falt bort.** Maria, 2026-08-10: «Nr. 2 kommer aldri til å skje, for den tilgangen får vi ikke.» Azure-app-registrering hos Bluefront IT skjer ikke. ICS-parsing *er* vår jobb, permanent. Da er de to feilene ikke parkert lenger — de er ufikset.

**Hva de gjorde:**

- **B4 — TZID ble ignorert.** `parseICSDate(str)` fikk bare verdien til høyre for kolon. TZID står i propertyens *parameterliste* på venstre side (`DTSTART;TZID="Eastern Standard Time":20260115T140000`), og den siden ble kastet. Et møte satt opp fra New York ble vist med råtiden: 14:00 i stedet for 20:00.
- **B5 — sommertid.** `expandRRule` kopierte `{...baseEv}` for hver forekomst, og `baseEv.start` var en ferdig konvertert lokal klokketid-streng. Alle forekomster arvet basetidens konvertering. En ukentlig 07:00Z-serie fra 12. oktober ble vist 09:00 hele veien — riktig til og med 19. oktober, én time feil fra 26. oktober og resten av serien. Feilen dukker altså opp av seg selv ved tidsomstillingen, uten at noe endres.

Det er også en tredje feil ingen hadde beskrevet, som følger av de to: fordi forekomst-datoene ble regnet ut fra den *lokale* datoen til basehendelsen, ville en serie i en sone langt øst eller vest blitt enumerert på gale ukedager. Et 07:00-møte hver tirsdag i Tokyo er mandag kveld i Oslo; `BYDAY=TU` mot en lokal mandag-dato treffer ikke.

## Decision

**Én tid har to representasjoner, og de er ikke utbyttbare.** `parseICSDate(str, tzid)` returnerer begge:

- `srcDate` / `srcTime` — kildekalenderens egen dato og veggklokke, slik den står i filen
- `date` / `time` — samme øyeblikk i nettleserens lokale sone
- `mode` — `allday` | `floating` | `utc` | `zoned`, pluss `zone` og `instant`

Tre regler følger:

1. **Gjentakelser enumereres på kilde-kalenderen.** `expandRRule` bruker `srcDate`, ikke `date`. En ukentlig avtale er ukentlig der den ble laget.
2. **Hver forekomst konverteres på sin egen dato.** `_resolveICSTime(srcDateKey, spec)` kalles per forekomst, ikke én gang for serien. Det er hele sommertid-fiksen: klokketiden regnes ut på nytt for hver dato i stedet for å arves.
3. **Sluttiden utledes fra varighet, ikke fra en streng.** Basens varighet i minutter regnes fra start- og slutt-*øyeblikkene* og legges på hver forekomsts eget startøyeblikk. Det holder også når en forekomst ligger på hver side av en omstilling.

**TZID → IANA.** Outlook publiserer Windows-navn («W. Europe Standard Time»), ikke IANA. `_WINDOWS_TZ` mapper ~55 soner som realistisk kan dukke opp. Et navn som ikke står der men inneholder `/` prøves som IANA. Alt annet, og alt `Intl.DateTimeFormat` avviser, degraderer til **flytende tid** — altså presis oppførselen vi hadde før denne ADR-en. En ukjent sone gjør ingenting verre enn det var.

**Konvertering uten bibliotek.** `Intl.DateTimeFormat` med `timeZone` gjør jobben: formatér øyeblikket i sonen, les det tilbake som om det var UTC, og differansen er offset. Veien motsatt vei — veggklokke i en sone til øyeblikk — trenger to pass, fordi offseten man trenger avhenger av øyeblikket man leter etter: gjett med offseten ved det naive øyeblikket, korriger, og sjekk offseten på nytt ved det korrigerte. Det andre passet er det som gjør timene rundt en omstilling riktige.

## Consequences

**Vi aksepterer:**

- **Windows-sonetabellen må vedlikeholdes.** ~55 navn dekker Europa, Amerika, Asia og Oseania. Et navn utenfor lista degraderer stille til flytende tid — samme resultat som før, men fortsatt feil. Om en slik dukker opp, er fiksen én linje i tabellen.
- **Utdata avhenger av nettleserens sone.** Det er riktig — Maria skal se sin egen tid — men det betyr at en test som kjøres i UTC ikke beviser noe. `smoke/ics.mjs` **nekter å kjøre** uten `TZ=Europe/Oslo`, fremfor å passere tomt.
- **Vi eier tidssonelogikk nå.** Det var det ADR 0003 håpet å slippe. Med Graph avvist er alternativet ingen tidssonelogikk, som er verre.
- **`Intl` med `timeZone` kreves.** Alle nettlesere Maria bruker har det (Chrome/Edge på PC, Safari på iPhone). Skulle det mangle, kaster `_tzFormatter` internt og alt degraderer til flytende tid.
- **Sekunder ignoreres fortsatt.** Klokkeslett er `HH:MM` i hele datamodellen.
- **`RECURRENCE-ID`-overstyringer støttes fortsatt ikke** (ADR 0025). Flytter du én forekomst i en serie i Outlook, viser planleggeren den på den opprinnelige tiden. Uendret, og nå den største gjenstående ICS-mangelen.

**Vi får:**

- Møter fra andre tidssoner vises på riktig lokal tid.
- Gjentakende møter er riktige på hver side av en tidsomstilling — inkludert uka mellom EUs omstilling (25. oktober 2026) og USAs (1. november 2026), der differansen til New York er 5 timer og ikke 6. Det er dekket av en test.
- Serier i fjerne soner havner på riktige ukedager.
- ADR 0025s «TZID og sommertid er parkert i påvente av Graph» er nå oppgjort, ikke hengende.

## Alternatives considered

**Vente på Graph likevel.** Ikke et alternativ lenger; tilgangen kommer ikke. Å la to kjente feil ligge i påvente av noe som ikke skjer er den dårligste varianten av begge.

**Ta inn et tidssonebibliotek (Luxon, date-fns-tz, tzdata).** Løser mer enn vi trenger og bryter ADR 0001 («no build step») — vi ville måttet vendore en fil på flere hundre kB, og tzdata går ut på dato. `Intl` har hele soneddatabasen innebygd og oppdateres med nettleseren. ~40 linjer konvertering pluss en navnetabell er billigere og aldri utdatert.

**Konvertere alt til UTC-øyeblikk i datamodellen** og formatere ved rendering. Teknisk renere, og det ville fjernet hele klassen. Forkastet: `date` + `start`/`end` som lokale strenger er gjennomgående i state, i alle syv visninger, i eksportert JSON og i KV-synken. Det er en migrering på nivå med v5-skjemaoppryddingen, ikke en bugfix. Denne løsningen konverterer på inngangen i stedet, som er der ICS-data allerede oversettes.

**Bare fikse TZID og la sommertid ligge.** Halvparten av arbeidet for nesten hele risikoen — begge feilene bor i samme fem linjer av `expandRRule`. Og sommertid-feilen er den som treffer Marias faste møter fra 25. oktober.
