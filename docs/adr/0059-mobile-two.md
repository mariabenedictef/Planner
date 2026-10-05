# ADR 0059 — Mobil 2.0: én rad er én linje, ett trykk åpner alle valgene

**Status:** Accepted
**Date:** 2026-10-05
**Bygger på:** 0045 («Fra prosjekter»), 0050 (mobilmodellen), 0051 (44 px avkryssing), 0055 (telefonradens budsjett), 0056–0058 (designsystemet)
**Erstatter delvis:** 0050 («Mer ▾»-menyen og knapperaden på telefon), 0055 (stjerneknappen i raden, og at et trykk på datoen setter fristen til i dag)

## Context

Maria: «Planner er fortsatt vanskelig å bruke på mobilversjonen.» Hun ga full kreativ frihet: så enkelt, brukervennlig og pent som mulig.

Målt på hennes egne data på en 390 px iPhone-visning:

- **To Do's var 6 184 px høy** — over sju skjermer. Før første oppgave kom 250 px med hurtigfelt (tekstfelt, fire prioritetsknapper, prosjektvalg, «Tale»). **Tre rader var synlige** uten å scrolle (innboksraden og to oppgaver).
- Hver rad hadde ★, ✎ og × med 44 px treffområde, til sammen 130 px. **Titlene fikk 152 px** og brøt over tre–fire linjer; median radhøyde var 79 px.
- «Fra prosjekter» hadde 34 rader og ingen måte å legge dem bort.
- **Kalenderen lå bak «Mer ▾»**, og bunnmenyen hadde bare tekst.
- Et trykk på datoen satte fristen til i dag, og et trykk på prosjektnavnet fjernet prosjekttaggen. Begge var stille endringer fra trykk som like gjerne var ment for raden.
- **Årsoversikten klippet stolpene**: et 750 px bredt rutenett i en 358 px kolonne.
- Hurtignotat-arket (+-knappen) hadde fortsatt ⚠ ↗ ⤳ og de gamle fargefylte knappene.
- **I mørk modus var «Lagre» og «Legg til» ikke til å lese**: hvit tekst på `--accent`, som er nesten hvit i mørkt tema. Gjaldt alle skjemaer, også på PC.

## Decision

**En rad viser det man leser, et ark det man gjør.** Ingen knapper i radene på telefon: avkryssing, tittel, og dato og prosjekt i flyten etter tittelen (★ foran når den er stjernemerket). **Et trykk på tittelen — eller datoen, eller prosjektnavnet — åpner arket** fra bunnen:

- **Frist:** I dag · I morgen · Om en uke · Ingen frist (delmål: «Dato»). Med angring, som «I dag».
- **Prioritet** for frie oppgaver (gjeldende markert); **«Flytt til»** Urgent / Short term / Long term for innboksen.
- Stjernemerk · Prosjekt · Kategori · Rediger · Åpne prosjektet · Slett.

Prosjektoppgaver og delmål får ikke Slett eller prioritet i arket, av samme grunn som før (ADR 0045, 0054). Arket går gjennom de samme handlerne som knappene på PC (`HANDLERS.rowSheetDo` → `setTaskPriority`, `toggleStar`, `deleteFreeTask` …), uten egne kopier. Det åpnes fra en lytter i fangstfasen, slik at tittelens egen PC-handling ikke også går. Sveip virker som før: høyre = gjort, venstre = slett.

**Innboksen beholder de tre prioritetene synlige, med ord** — sortering er hele poenget med den. Resten ligger i arket.

**+-knappen er det ene stedet man legger inn noe nytt.** Hurtigfeltene øverst på Hjem og To Do's er skjult på telefon. Arket: «Hva må gjøres?», «Legg i» (Innboks er valgt; Urgent, Short term, Long term), eller et prosjekt, eller «Lag en hendelse i stedet» / «Snakk inn». «Legg til» bekrefter med en beskjed («Lagt i Urgent»). Samme ark på PC — de gamle fargede knappene og ⚠ ↗ ⤳ er borte der også.

**Bøttene kan brettes sammen** ved å trykke på overskriften (vinkel til høyre). **«Fra prosjekter» er sammenbrettet som standard.** Valget huskes på enheten, i en egen localStorage-nøkkel `planlegger.mobil.v1`, ikke i `state`: det synkes ikke til PC-en, der det ikke betyr noe. Hjelpeteksten om å dra er skjult på telefon.

**Bunnmenyen har fire faner med linjeikoner: Hjem, To Do's, Kalender, Prosjekter.** «Mer ▾» og menyen den åpnet er fjernet. **Kalender** går til sist brukte kalendervisning (husket på enheten), og øverst i kalenderen står en bryter **Dag | Uke | Måned | År**. Ikonene er SVG som følger tekstfargen, ikke emoji. Telleren er en liten rød pille på ikonet.

**Topplinja** har ikke lenger «Planlegger» — fanen sier hvor du er. Filteret står til venstre, søk og innstillinger til høyre.

**Hjem:** tittelen først, datoen til høyre. Samme ark ved trykk.

**Dag:** dagens oppgaver først, timene under, notatene sist (`display:contents` på sidepanelet og `order`).

**Årsoversikt:** hvert prosjekt er navnet over en 8 px tidslinje i full bredde. Månedsetikettene er skjult, bortsett fra årsskiftene.

**Arkene** har håndtak øverst, 16 px hjørner og plass til iPhone-ens hjem-indikator. **Mørk modus:** hovedknappen i arkene får `color:var(--bg)`.

## Consequences

**Vi aksepterer:**

- **Alt man gjør med en oppgave på telefon er ett trykk lenger unna** (trykk → valg) enn knappene var. Til gjengjeld ser hun sju rader på første skjerm i stedet for tre. «Gjort» er fortsatt ett trykk (avkryssing) eller ett sveip.
- **Trykk på datoen setter ikke lenger fristen til i dag direkte.** «I dag» er øverst i arket. Ett trykk på raden betyr én ting.
- **Hurtigfeltene er skjult på telefon.** +-knappen gjør det samme, og står der tommelen er.
- **Sammenbrettede bøtter er per enhet.** Bretter hun sammen «Long term» på iPhonen, er den åpen på iPaden.
- **Telefonen og PC-en er mer ulike enn før.** PC-en er uendret, bortsett fra det nye hurtignotat-arket og knappefargen i mørk modus.

**Vi får** (målt, 390 px, hennes data):

| | Før | Etter |
|---|---:|---:|
| To Do's, sidehøyde | 6 184 px | 2 106 px |
| Tittelbredde i en rad | 152 px | 324 px |
| Median radhøyde | 79 px | 48 px |
| Rader på første skjerm, To Do's | 3 | 7 |
| Knapper i en oppgaverad | 3 | 0 |
| Kalender | bak «Mer ▾» | egen fane |

## Verifisering

- `tests/run.mjs`: 710 → **745**, grønt i UTC og Europe/Oslo. Nye: fanene (fire, med ikon, ingen «Mer»), bøttene (standard, bretting, husket på enheten, ingenting brettet på PC), kalenderbryteren (telefon ja, PC nei, sist brukte husket), arket (valg, gjeldende prioritet, «I morgen» med angring, «Ingen frist», prioritet/stjerne/kategori/slett, ingen Slett for prosjektoppgaver), hurtignotatet (ingen ⚠ ↗ ⤳ eller hardkodede farger, valgt bøtte, bekreftelse), mørk modus-knappen. **Mot forrige versjon feiler 25.**
- `tests/browser.mjs` §5 er skrevet om for den nye modellen. Det er det sjuende og største skiftet av tester i prosjektet: ADR 0055s krav om synlig stjerneknapp, synlig ✎ og trykk-på-dato-setter-i-dag er snudd. Budsjettet er skjerpet: tittel ≥ 280 px (var 150), median radhøyde ≤ 72 px (var 100). Den tester med ekte trykk: arket, stjerne lagret, «I dag» med angring, at datoen åpner arket og ikke endrer noe, bretting, Kalender-fanen og bryteren, og +-knappen hele veien. **43 → 57 tester, alle grønne. Mot forrige versjon feiler 11 før seksjonen stopper.**
- §6 kontrastrevisjonen fant den røde telleren på det aktive ikonet (en eldre regel tok bort bakgrunnen) — rettet før push. 0 brudd.
- `tests/ics.mjs`: 80/80.
