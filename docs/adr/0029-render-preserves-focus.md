# ADR 0029 — `render()` bevarer fokuserte felt, og redigeringer som ikke bor i state lagres før DOM-en byttes ut

**Status:** Accepted
**Date:** 2026-08-11
**Avløser:** alternativet «la `render()` bevare fokuserte felt» som ADR 0023 forkastet

## Context

ADR 0023 fant klassen: `render()` setter `viewEl.innerHTML`, og **å fjerne et fokusert element fra DOM-en utløser ikke `blur` i noen nettleser.** Et bakgrunns-pull hvert 60. sekund kunne dermed slette tekst midt i en setning.

Forsvaret den gang var å strupe lagringen: commit på `input` hvert 400. ms. Det var riktig, og det stoppet de store tapene. Men det løser ikke hele problemet, og ADR 0023 sa det selv i «Consequences»:

- **Strupingen mister fortsatt opptil 400 ms** med tasting hvis et pull lander i akkurat det vinduet.
- **Markøren flyttes til slutten** etter tegningen, fordi feltet blir tegnet på nytt fra state.
- **Fokuset forsvinner**, så neste tastetrykk går i ingenting.

I praksis betyr det at Maria kan skrive i dag-notatet, få et pull i fanget, og oppdage at markøren står et annet sted enn der hun skrev. Det er ikke tapt tekst, men det er en app som rykker under hendene.

Og én kategori var fortsatt ubeskyttet: **innebygd tittelredigering** (dobbeltklikk på en To Do). Feltet lages med `document.createElement` og settes inn med `span.replaceWith(input)` — det finnes ikke i noen mal. Det kunne derfor ikke gjenopprettes etter en tegning, bare mistes. `Escape` = avbryt er tilsiktet der; et bakgrunns-pull skal ikke oppføre seg som `Escape`.

ADR 0023 forkastet den strukturelle løsningen med denne begrunnelsen, som fortsatt er den riktige innvendingen:

> krever at hvert felt har en stabil id og at render-funksjonene samarbeider, og en delvis implementasjon er verre enn ingen (feltene som glemmes ser trygge ut)

To feltap på tre måneder — dag-notatet (ADR 0023) og ICS-URL-en (ADR 0023, «Etterslep») — gjør at avveiningen har snudd.

## Decision

**1. `render()` fanger og gjenoppretter fokusert felt.** Ett sted, rundt utsendelsen til visningsfunksjonene:

```js
const focus = _captureFocus();     // id, verdi, markørposisjon, scrollTop
… tegn visningen …
_restoreFocus(focus);
```

`_captureFocus` returnerer `null` med mindre det aktive elementet ligger inne i `#view` og er et tekstfelt. Verdien skrives tilbake etter tegningen, så lokal skriving vinner over det tegningen la inn — brukeren står i feltet nå. Markørposisjonen settes med `setSelectionRange` i en `try` (input-typene `date`/`time`/`number` kaster).

**2. Innvendingen fra 0023 møtes med en advarsel og en assertion, ikke med håp.** Et fokusert felt uten `id` kan ikke finnes igjen etter tegningen. Da sier det fra:

```js
console.warn('[render] fokusert felt uten id — det du skriver her overlever ikke en render():', …)
```

og `tests/run.mjs` enumererer hvert tekstfelt som tegnes i `#view` i alle sju visningene og feiler hvis noe mangler `id`. Alle ni felt hadde id da dette ble skrevet. **Det er den assertionen som gjør dette komplett i stedet for delvis** — «feltene som glemmes ser trygge ut» slutter å gjelde når de roper.

**3. Redigeringer som ikke bor i state lagres FØR DOM-en byttes ut.** Et lite register:

```js
const _pendingCommits = new Set();
function registerPendingCommit(fn){ _pendingCommits.add(fn); return ()=> _pendingCommits.delete(fn); }
```

`render()` tømmer settet først. Innebygd tittelredigering registrerer sin `commit` og melder seg av når den er ferdig. Konsekvensen er at et pull **lagrer** redigeringen i stedet for å forkaste den, mens `Escape` fortsatt forkaster.

**4. `render()` er re-entrans-trygg.** En pending commit kaller `render()` på slutten. Uten vakt blir det uendelig rekursjon. Et indre kall returnerer nå umiddelbart; den ytre tegningen produserer fersk HTML uansett.

## Consequences

**Vi aksepterer:**

- `render()` gjør nå tre ting til: tømmer pending commits, leser `document.activeElement`, og skriver tilbake. Kostnaden er neglisjerbar mot en tegning, men `render()` er ikke lenger «bare tegn».
- Gjenopprettingen krever `id` på feltet. Nye felt inne i `#view` **må** ha en. Advarselen og dekningstesten fanger brudd, men regelen er reell, og den står i CONTEXT.md.
- Lokal verdi vinner over et innkommende pull for det feltet som har fokus. Det er riktig for én som skriver, men det betyr at en fjern endring i nøyaktig det feltet blir overskrevet uten varsel.
- Innebygd redigering lagres av et bakgrunns-pull. Hvis Maria dobbeltklikker, skriver halvveis og ombestemmer seg, må hun bruke `Escape` — å bare vente forkaster ikke lenger.
- Elementer som settes inn imperativt kan fortsatt ikke gjenopprettes. De må bruke `registerPendingCommit`. Det er bare ett slikt felt i dag, og det er merket `data-transient="1"`.

**Vi får:**

- Verifisert i jsdom: tekst, markørposisjon og fokus overlever en `render()` i både dag-notatet og hurtignotatet. Innebygd redigering lagres av tegningen. `Escape` avbryter fortsatt. Advarselen kommer når id mangler. Alle ni felt har id. Re-entrant `render()` løper ikke løpsk.
- De to gjenstående punktene i ADR 0023 sin «Consequences» — 400 ms-vinduet og markørhoppet — er borte.
- Klassen er lukket, ikke bare de kjente instansene av den.

## Alternatives considered

**Utsette bakgrunns-pull mens brukeren skriver** — et flagg som settes på `input` og respekteres av `pullFromRemote`. ADR 0023 noterte den som mulig neste steg. Forkastet: den gjør sync-timingen avhengig av UI-tilstand, og den hjelper ikke for de mange andre grunnene `render()` kalles (103 kallsteder). Fokusbevaring virker uansett hvorfor tegningen skjer.

**Bytte til en diff-basert tegning** (bevar DOM, oppdater bare det som er endret). Løser problemet ved rot og ville gjort tegningen raskere. Forkastet nå: det er en omskriving av alle sju visningsfunksjonene, altså en helt annen størrelse enn feilen berettiget. Verdt å vurdere hvis tegningen blir en flaskehals.

**Bare gjenopprette fokus, ikke verdien.** Enklere, men da mister man fortsatt de siste 400 ms — som var halve poenget.

**Kreve at hvert felt melder seg på bevaring eksplisitt.** Sikrere mot overraskelser, men det er nøyaktig den delvise implementasjonen ADR 0023 advarte mot: feltene ingen husket å melde på ser trygge ut.
