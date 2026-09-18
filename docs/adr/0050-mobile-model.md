# ADR 0050 — Mobilmodellen: to smale bånd, innhold for tommelen

**Status:** Accepted
**Date:** 2026-09-17
**Bygger på:** 0044/0046 (media-spørringer sist), 0047 (variabler i mørk modus), 0036 (hash-ruting), 0045 (prosjektoppgaver i To Do's)

## Context

Maria bruker planleggeren på iPhone, og opplevde den som dårlig der. Revisjonen ble gjort på 390 px med berøringsemulering (blink-flagget fra ADR 0044) og **hennes egne data** — eksporten fra 26. mai, migrert til v5, datoflyttet 129 dager fram slik at uka så ut som i dag, og med synk-nøklene fjernet. Funnene, med tall:

- **Prosjekter var 652 px bred på en 390 px telefon.** `.projects-grid{grid-template-columns:1fr}` — og `1fr` er `minmax(auto,1fr)`, der auto-minimum er innholdets minste bredde. Én nowrap-tittel på 518 px gjorde hele siden bred, nettleseren zoomet ut, og den faste bunnmenyen havnet på y=1352 — utenfor skjermen. På den visningen hadde hun ingen navigasjon.
- **Måned var ikke en kalender.** Samme `1fr`-feil: dager med hendelser ble brede, tomme dager 15 px-striper. 72 av 73 berøringsmål under 44 px, 130 av 177 tekster under 13 px.
- **Uke var desktop-rutenettet klemt til 45 px per kolonne.** Ett ord per linje. 24 av 25 mål under 44 px.
- **Hendelser tegnet seg over bunnmenyen** i Uke og Dag. Menyen bor *inne i* den klebrige topplinja, som har `z-index:10`; hendelser har `z-index` 1–99 (ADR-kommentaren i `evDurationStyle`), og alt over 10 legger seg over hele topplinjas stableringskontekst — meny inkludert.
- **23 % av skjermen var ramme.** Topplinje 119 px + filterrad 44 px før innholdet, 59 px meny under.
- **Minste skrift 9,5 px**, og 60 av 131 tekstelementer på Hjem under 13 px.
- Dag viste «📧 📧» på heldagshendelser — CSS (`.ev.ics::before`) og JS la på hvert sitt.

Underveis fant revisjonen en feil i min egen verifikasjon fra samme dag: rutene er norske (`#/hjem`, `#/uke/…`, `#/maned/…`), og skjermbildene i ADR 0046/0047 hadde brukt engelske. Ukjente ruter faller tilbake til fixturets visning, så «sju visninger» var i praksis én. Mørk modus-sveipen ble kjørt om med riktige ruter og fant tre hardkodede flater til.

## Decision

**Én modell for telefon, ikke femti småfikser.** Rammen krymper til to smale bånd; innholdet tilpasser seg tommelen. CSS der det holder, JS der DOM-en må være en annen. Alt ligger som én blokk sist i stilarket, slik ADR 0046 krever, og `_isPhone()` bruker samme grense (700 px) som stilarket, så JS og CSS aldri er uenige om modus.

**Rammen.**
- Topplinja er én rad på 52 px: merke, filter i midten, ikoner til høyre. Innholdet starter på 67 px i stedet for 133. `z-index:300`, så menyen ligger over alt innhold og under modalen (5000).
- Bunnmenyen er en tab-bar: fire like felt, 11,5 px etiketter som ikke avkortes ved 360 px, aktiv fane markert med blekkfarge og en 2 px strek — ikke en fylt mørk pille. `env(safe-area-inset-bottom)` for hjemmeindikatoren. `main` får bunnpolstring så innholdet aldri ender under menyen, og FAB-en løftes over den.

**Innholdet.**
- **Prosjekter:** `minmax(0,1fr)` og `.pcard{min-width:0}`. Den kanoniske kuren for rutenett som sprenges av innhold.
- **Måned er en minikalender.** Sju like kolonner (`minmax(0,1fr)`), hver hendelse én 6 px prikk i kategorifargen, «+N til» en grå prikk, `pointer-events:none` på prikkene så trykket alltid treffer dagen. Trykk åpner Dag — det har `renderMonth` alltid gjort. Helligdag farger tallet i stedet for å skrive navnet. Flerdagsstrekene fra ADR 0014/0027 nøytraliseres eksplisitt med matchende spesifisitet; de er meningsløse som prikker.
- **Uke er en agenda.** `_renderWeekAgenda` tegner de sju dagene nedover, hver med hendelser og åpne oppgaver som rader — klokkeslett, tittel, sted — med samme datakilder (`eventsOnDay`, `tasksOnDay`) og samme handlere (`act('openOutlookEvent'|'editEvent'|'openProject'|'openTaskForm'|'openProjectTaskForm')`) som rutenettet. Dagshodet åpner Dag via ny `HANDLERS.openDay(key)`, som avviser alt som ikke er en datonøkkel. Desktop tegner rutenettet nøyaktig som før; forgreningen er én linje i `renderWeek`.
- **Årsoversikt:** tidslinja ruller sidelengs med klebrige radetiketter, så man vet hvilket prosjekt man ser på.
- **Hjem:** Urgent-lista er ikke lenger en fylt rød boks men en liste med rød venstrekant; hurtigfeltets desktop-forklaring skjules.
- **Skriftgulv 12 px** for løpende tekst (kategoripillene 11,5 i versaler med sporing), målt element for element. Ingenting settes til én felles størrelse — hierarkiet skal stå.
- **Berøringsmål 44 px** på radknappene ✎/× og slett-knappene på prosjektsiden; avkryssingsbokser 24 px.
- Dupliserte Outlook-ikonet: JS-et fjernet, CSS-et beholdt.
- Tre siste hardkodede flater på variabler: `--surface-dim` (helg og andre måneds dager) og `--ics-bg`/`--ics-line` (Outlook-hendelser). Lys modus bruker nøyaktig dagens hex.

Tre inline-stiler ble klasser underveis (`.cd-next`, `.wr-btn`, `.pnext`) fordi gulvet ikke kunne håndheves på dem ellers: 142 → 138.

## Consequences

**Vi aksepterer:**

- **Avkryssingsboksene er 24 px, ikke 44.** Det er en native `<input>`; polstring og pseudo-elementer treffer ikke hit-boksen på tvers av Safari og Chrome. Høyresveip fullfører raden (ADR 0045), så det finnes et stort mål for handlingen. Dette er den ene bevisste avviket fra 44 px.
- **Filterknappene er 32 px høye.** Én rad i topplinja er verdt mer enn 12 px ekstra høyde per knapp; Apples egne segmentkontroller er 32.
- **Måned viser ikke tekst.** Prikkene sier *at* det skjer noe og i hvilken kategori, ikke hva. Det er Dag sin jobb, ett trykk unna. En agenda under kalenderen for valgt dag er neste naturlige steg — ikke bygget nå.
- **`:has()`** brukes for undernavigasjon med piler og for helligdagsfarge. Krever iOS 15.4+ (mars 2022). Uten støtte degraderer det til dagens layout, ikke til brudd.
- **Desktop er uendret.** Målt: computed style på 320 elementer i sju visninger på 1280 px, null avvik utenom de tre elementene som fikk klassenavn med identiske verdier.

**Vi får:**

- Målt før → etter: Prosjekter 652 → 390 px; innhold fra 133 → 67 px; Uke 24/25 → 8/35 små mål (de åtte er filteret og pilene); Måned 60 → 0 mål under 32 px; minste skrift 9,5 → 12 px; hendelser over menyen: borte.
- `tests/run.mjs` 529 → **555**. Seksjon 39 tester agendaen med telefon-`matchMedia`, at desktop fortsatt tegner rutenettet, `openDay`, og stilarkets kontrakt (mobilblokka er siste `@media`, `minmax(0,1fr)` på begge rutenettene, `z-index:300`, ingen hardkodede lyse flater). **24 av 555 feiler mot koden før runden.**
- Mørk modus verifisert på alle sju visninger på 390 og 1280 px: tre lyse flater, alle `--accent` med vilje.

## Alternatives considered

**Egen mobil-app / eget mobil-HTML.** Full frihet. Forkastet: to kilder til samme funksjonalitet er to steder å glemme det andre lageret — nøyaktig feilklassen ADR 0049 nettopp fjernet fra datamodellen.

**Uke som horisontalt rullende rutenett** (som Årsoversikt). Bevarer tidsaksen. Forkastet: et rutenett med 42 px timeslots er et desktop-verktøy for å *plassere* møter med mus; på telefon er spørsmålet «hva skjer denne uka», og det svarer en liste på.

**Måned med forkortet tekst i cellene.** Beholder informasjon. Forkastet etter måling: på 51 px kolonnebredde blir det tre bokstaver per hendelse — støy som ser ut som innhold. Prikkene er ærlige om hva de kan si.

**Skjule filteret bak «Mer»-menyen** for å spare plass. Forkastet: Jobb/Privat-skillet er hennes primære filter i hverdagen; det skal være ett trykk, ikke to.
