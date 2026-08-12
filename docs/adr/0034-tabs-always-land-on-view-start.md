# ADR 0034 — Fanene lander alltid på startsiden i visningen

**Status:** Accepted
**Date:** 2026-08-12

## Context

`state.ui.openProjectId` bestemmer om Prosjekter-visningen tegner kortrutenettet eller én prosjektside. Den er **del av den lagrede ui-tilstanden** (`loadState` tar den med i det saniterte settet), så den overlever både visningsbytte og sidelasting.

`HANDLERS.switchView` — som er det fanemenyen kaller — satte bare `state.ui.view`. Konsekvensen:

- Sto man inne i et prosjekt, gjorde et klikk på «Prosjekter» ingenting synlig. Visningen var alt `projects`, `openProjectId` sto igjen, og man ble tegnet tilbake inn i samme prosjektside. Det fantes ingen vei til startsiden via fanen; bare «← Tilbake til prosjekter».
- Gikk man fra prosjektet til «Hjem» og deretter til «Prosjekter», landet man **inne i prosjektet igjen** — fanen «husket» noe man ikke hadde bedt den huske.
- Samme etter en sidelasting, siden tilstanden er lagret.

Maria ba om at «Prosjekter» alltid skal føre til startsiden i Prosjekter.

## Decision

**`switchView` nullstiller `state.ui.openProjectId`.** Ikke bare når målet er `projects` — alltid. En fane er en forespørsel om å komme til *starten* av en visning, og et åpent prosjekt er en posisjon inne i én av dem.

Kallstedene er sjekket: `switchView` brukes bare av desktop-navigasjonen, «Mer»-menyen på mobil, og «Se alle To Do's →». Ingen av dem har grunn til å beholde et åpent prosjekt. Alle rutene som *åpner* et prosjekt setter `openProjectId` selv og går ikke via `switchView`.

**Samtidig: `HANDLERS.openProject` er nå faktisk den ene døren inn.** Kommentaren over den har siden ADR 0018 sagt at den «erstatter inline `state.ui.openProjectId=…; state.ui.view='projects'; render()`», men seks kallsteder gjorde det fortsatt inline — kortklikk (aktive og arkiverte), to søketreff-typer, og to wikilink-stier. De bruker helperen nå. Det var pattern-sveipet i sjekklista som fant dem, og poenget er ikke ryddighet: så lenge det finnes seks ulike steder som setter tilstanden, er det seks steder en framtidig endring av «hva betyr det å åpne et prosjekt» kan bli glemt.

**Bevisst ikke endret:** `openProjectId` er fortsatt lagret. Laster man siden mens man står i et prosjekt, kommer man tilbake til prosjektet — det er nyttig, og det er ikke det Maria klaget på. Det som var galt var at *fanen* ikke kom seg ut av den tilstanden.

Ett kallsted er også fortsatt inline: lagring av et **nytt** prosjekt setter `openProjectId` og faller så gjennom til en felles `closeModal(); view='projects'; render()`. Å bruke helperen der ville gitt to tegninger. Strukturelt annerledes, latt stå.

## Consequences

**Vi aksepterer:**

- Å bytte til en annen visning glemmer nå hvilket prosjekt man hadde åpent. Går man Prosjekt → Uke → Prosjekter, må man klikke seg inn igjen. Det er den tilsiktede oppførselen, men det er et tap av bekvemmelighet for den som brukte fanene som en måte å «kikke bort» og komme tilbake.
- `switchView` gjør nå én ting mer enn navnet sier. Alternativet — en `resetViewPosition()`-funksjon — er mer presist navngitt, men ville vært en indirektion for tre linjer.

**Vi får:**

- Fanen oppfører seg som en fane: den fører til starten av visningen, hver gang, uansett hvor man kom fra.
- 11 nye assertions, fire av dem feiler mot forrige commit — inkludert både tilfellene Maria beskrev, og en regresjonstest på at kalendervisningene fortsatt nullstiller ankeret til i dag.
- Seks inline-sett færre av `openProjectId`.

## Alternatives considered

**Nullstille bare når målet er `projects`.** Minst mulig endring, og løser det hun spurte om. Forkastet: da ligger `openProjectId` og lever videre mens man er i andre visninger, og neste gang noe leser den i en annen sammenheng er feilen tilbake i en ny form. Å nullstille en posisjon når man forlater visningen er det ærlige.

**Gjøre «Prosjekter» til en toggle** — klikk inne i et prosjekt går ut, klikk på startsiden gjør ingenting. Forkastet: en fane som betyr to ting avhengig av hvor du står er vanskeligere å forutse enn en fane som alltid betyr det samme.

**Slutte å lagre `openProjectId`.** Ville løst tilfellet med sidelasting, men ikke det med visningsbytte i samme økt — og det ville tatt bort noe nyttig.

**Legge inn ekte ruting (hash-basert)** slik at nettleserens tilbakeknapp virker. Riktigere på sikt, men det er en ny arkitektur for navigasjon, ikke en fiks av denne feilen.
