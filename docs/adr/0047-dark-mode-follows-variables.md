# ADR 0047 — Ingen hardkodede lyse flater: mørk modus følger variablene

**Status:** Accepted
**Date:** 2026-09-17
**Bygger på:** 0046 (stilarket er ryddet), palettvariablene fra første versjon

## Context

Bøtteoverskriftene i To Do's — Urgent, Short term, Long term — var hardkodet hex (`#fce8e8`, `#fbf1e1`, `#e8eef7`) og ble derfor stående lyse i mørk modus, mens nabobøtta `.bh.proj` gikk på variabler og tilpasset seg. Det var notert 2026-08-13 og latt stå, fordi det er Marias palett.

Da fiksen først var bestemt, krevde mønsterregelen en sveip: når en fiks etablerer en regel, skal man `grep`-e etter hver eneste forekomst av mønsteret og enten fikse den eller skrive ned hvorfor den står.

Sveipen ble gjort som en **måling, ikke et søk**: appen ble rendret i mørk modus i alle sju visningene, og hvert element med lys bakgrunn (relativ luminans > 0,55) ble logget. Det ga **11 unike selektorer**.

Den alvorligste var ikke bøtteoverskriftene:

> **Hurtigfeltet på To Do's (`input.qtxt`) hadde ingen bakgrunnsdeklarasjon i det hele tatt.** Det arvet nettleserens hvite standard, mens teksten fulgte `--ink`. I mørk modus var det lys tekst på hvit bakgrunn — praktisk talt usynlig mens man skrev.

Og en detalj som forklarer hvorfor dette ikke var fikset før: **tolv av forekomstene lå som inline-stiler i `app.js`**, ikke i stilarket. Inline slår ethvert stilark, så de kunne ikke fikses i CSS-en uansett hvor grundig man leste den.

## Decision

**Ingen hardkodet lys flate i kode som renderes i begge modi. Alt går på variabler.**

- Tre nye variabelpar for bøttepaletten, med kantfarger: `--bh-urgent-bg/-ink/-line`, `--bh-short-*`, `--bh-long-*`. Definert på `:root` med **nøyaktig dagens lyse verdier**, og på `[data-theme="dark"]` med dempede varianter av de samme nyansene.
- `background:#fff` → `background:var(--surface)` overalt, både i stilarket og i de tolv inline-stilene i `app.js`. Utskriftsregelen (`@media print { body { background:#fff !important } }`) er unntaket, og skal være det.
- `.todo-quick input.qtxt` og nedtrekket `#qt-project` får eksplisitt `background:var(--surface)` og `color:var(--ink)`.
- **Hurtigknappene deler palett med bøtta de mater.** «⚠ Urgent» i hurtigfeltet og Urgent-bøtta bruker nå de samme tre variablene. De var to kopier av de samme seks hex-verdiene.

Mørke verdier, med målt kontrast mot sin egen bakgrunn:

| | Bakgrunn | Blekk | Kontrast |
|---|---|---|---|
| urgent | `#3b2826` | `#e3a79f` | 6,8:1 |
| short | `#3a3226` | `#dcbd8d` | 7,0:1 |
| long | `#28303d` | `#adc0dc` | 7,2:1 |

Til sammenligning ligger de lyse på 7,0 / 5,6 / 7,7:1, så mørk modus er ikke svakere enn lys. Bakgrunnene ligger 1,22–1,34:1 fra `--bg`, samme avstand som `--surface-2` har (1,29:1) — de leses som flater i samme sett, ikke som farget støy.

## Consequences

**Vi aksepterer:**

- **Paletten i mørk modus er min utledning, ikke hennes valg.** Nyansene er dempede varianter av hennes egne, valgt etter samme oppskrift som `--alert-bg`/`--alert` alt brukte. Hun har sett dem på skjermbilde og kan justere verdiene ett sted hver.
- **Tolv inline-stiler er endret.** Antallet inline `style="` i `app.js` står uendret på 142 — verdier er byttet, ingen er lagt til — men de burde egentlig vært klasser. Det er en egen runde; terskelen på 150 er ikke passert.
- **Tre lyse flater står igjen med vilje:** merkeprikken i logoen, FAB-en og toasten. Alle tre bruker `--accent`, som *skal* være lys i mørk modus — det er invertert kontrast, ikke en glemt hex.

**Vi får:**

- Målt: 11 lyse flater i mørk modus → **3**, og alle tre er tilsiktet.
- **Lys modus er verifisert bit for bit uendret** — computed style på hvert input, select, button, `.bh`, `.todo-row` og `.pcard` i fire visninger, ingen diff mot forrige commit. Det var kravet: dette skal fikse mørk modus, ikke redesigne den lyse.
- Feilen i hurtigfeltet er borte. Den har vært der siden mørk modus kom.

## Alternatives considered

**Bare fikse de tre bøtteoverskriftene, som var det som var meldt inn.** Forkastet etter sveipen: den fant en verre feil enn den som var meldt, i nabokomponenten. Å fikse overskriften og la feltet rett over stå med usynlig tekst ville vært å velge den lille halvdelen.

**En blank basisregel `input,select,textarea{background:var(--surface)}`.** Prøvd, og målt: den endret lys modus — inputs gikk fra gjennomsiktig til hvit, som er synlig der et felt ligger på `--surface-2`. Rullet tilbake til fordel for målrettede regler. Kravet om uendret lys modus er det som fanget den.

**Legge de mørke verdiene i en `@media (prefers-color-scheme: dark)` i stedet.** Forkastet: appen styrer tema fra `state.ui.theme` via `[data-theme]`, ikke fra systemet. En `prefers-color-scheme`-regel ville truffet feil når hun velger tema manuelt — og det var nøyaktig den feilen jeg selv gjorde i første måling, der mørk modus så identisk ut med lys fordi bare nettleserens `colorScheme` var satt.
