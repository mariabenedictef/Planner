# ADR 0022 — Lasting og lagring av state skal aldri degradere stille

**Status:** Accepted
**Date:** 2026-08-10

## Context

Helsesjekken 2026-08-10 fant fire uavhengige steder der data kunne forsvinne uten at brukeren fikk vite noe. Felles for alle: koden fortsatte som om ingenting var galt.

**1. `loadState` var alt-eller-ingenting.** Én feiltypet bøtte kastet, og catch-en returnerte `DEFAULT_STATE`. Kjørt:

```
lagret: { projects: [2 prosjekter], tasks: {}, events: [1 hendelse] }
etter loadState: 0 prosjekter, 0 hendelser
```

`(merged.tasks||[]).forEach` kaster fordi `{}` ikke har `forEach`. Og fordi `render()` avsluttes med `saveState()`, ble den tomme defaulten skrevet over `planlegger.v1` innen ~1 sekund. Originalbytene var borte. En `JSON.parse`-feil ga samme utfall: tom app, ingen melding, original overskrevet.

**2. `null`-bøtter slapp gjennom utypet.** `tasks: null` overlevde `loadState` (migreringene bruker `(merged.tasks||[])` og tolererte det), og boot-renderen kastet på `state.tasks.filter(...)`. Det avbrøt resten av oppstarten, så Settings ikke kunne åpnes — og dermed var både Reset og «Gjenopprett backup» utilgjengelige. Blank side, ingen vei ut fra appen selv.

**3. `saveState` hadde ingen kvote-håndtering.** `localStorage.setItem` sto uten try/catch. Med base64-bilder i notater (ADR 0020) er ~5 MB-grensen nåbar, og backup-ringene beskjæres på *antall*, ikke bytes — 7 daglige kopier pluss 5 preSync-kopier av en 1 MB state er 12 MB. Kastet den, skjedde det inne i en `setTimeout`, så ikke engang klikk-dispatcherens catch så det. Editoren viste innholdet, alt så normalt ut, og hver påfølgende lagring i sesjonen feilet også.

**4. `importData` validerte bare JSON-syntaks.** `[1,2,3]` eller en `package.json` passerte, `loadState` lot defaults vinne, og alt ble erstattet av ingenting — uten øyeblikksbilde, i motsetning til `pullFromRemote` og `restoreCloudBackup` som begge tar ett. Importen satte heller ikke `meta.lastModified`, så 60-sekunders-pollen så filens gamle tidsstempel som eldre enn skyens og erstattet det nettopp importerte. Og fordi `loadState` fletter `sync` fra filen, byttet importen ut enhetens sync-credentials.

Ingen av disse var teoretiske. Alle fire ble utløst med kjørbare tester.

## Decision

**Fire regler for state-laget.**

### 1. Normalisér typer før noe itererer dem

`loadState` sjekker og fjerner feiltypede bøtter *før* migreringene kjører, slik at defaults fyller inn:

```js
['events','tasks','projects','outlookEvents','inbox','goals','habits']
  .forEach(k => { if (!Array.isArray(parsed[k])) delete parsed[k]; });
['ui','sync','themes','quarterly','yearFocus','quarterFocus','monthFocus','reviews','notes','meta']
  .forEach(k => { if (parsed[k] === null || typeof parsed[k] !== 'object' || Array.isArray(parsed[k])) delete parsed[k]; });
```

Konsekvensen er at én ødelagt bøtte koster den bøtta, ikke hele lageret.

### 2. En uleselig state skal aldri overskrives

Klarer `loadState` likevel ikke å lese blobben, kopieres råbytene til `planlegger.unreadable.<timestamp>` før defaults returneres, og `meta.loadFailed` settes. Da er `render()`s påfølgende `saveState()` ikke lenger en ensrettet dør.

### 3. Lagring som feiler skal si det

`saveState` fanger, rydder og varsler, i den rekkefølgen: fjern gamle `preSync`/`unreadable`-nøkler og alle unntatt de to nyeste `backup`-nøklene, prøv én gang til, og først da vis en toast som ber brukeren eksportere til JSON nå. Én advarsel per sesjon, ikke én per tastetrykk.

I tillegg en global feilflate: `window.addEventListener('error' | 'unhandledrejection')` rapporterer én gang per sesjon, med egen ordlyd for kvotefeil. Uten den forsvinner alt som kastes fra en `setTimeout` eller et promise rett i konsollen.

### 4. Destruktive operasjoner validerer form og tar øyeblikksbilde

`importData` sjekker at filen er et objekt og inneholder minst én av `projects`/`tasks`/`events`/`inbox`/`outlookEvents` som array, viser hva den fant («12 projects, 40 tasks»), tar et `preSync`-øyeblikksbilde, bevarer enhetens egne sync-credentials, og setter `meta.lastModified = Date.now()` så pollen ikke reverserer importen. `restoreBackup` tar nå også øyeblikksbilde, slik `restoreCloudBackup` alltid har gjort.

**Og:** `meta.version` stemples ved hver load (`STATE_VERSION = 4`). Det ble aldri skrevet tilbake før, så feltet var meningsløst — alle migreringer kjørte på hver load. De er verifisert idempotente over tre runder, så det er ikke ødelagt i dag, men den første versjons-gatede migreringen noen skriver ville misfyrt på alle eksisterende installasjoner.

## Consequences

**Vi aksepterer:**

- En feiltypet bøtte fører nå til *stille tap av den ene bøtta* i stedet for et synlig totaltap. Det er et bevisst bytte: å miste oppgavene men beholde prosjektene er bedre enn å miste alt, og `meta.loadFailed` finnes for den dagen vi vil vise det i UI-et.
- `planlegger.unreadable.*`- og `preSync`-nøkler tar plass i localStorage. `_pruneStorage` rydder dem først når det trengs, så de kan ligge en stund.
- Prune-strategien kan slette en backup Maria hadde bruk for, hvis kvoten er sprengt. Alternativet er å ikke kunne lagre i det hele tatt. De to nyeste daglige backupene er beskyttet.
- Global feilhåndtering viser tekniske meldinger til en bruker som ikke kan gjøre noe med dem. Ordlyden peker derfor på handlingen som faktisk hjelper: eksportér nå.
- Import kan fortsatt overskrive alt — den ber bare om bekreftelse med tall, og legger igjen et øyeblikksbilde.

**Vi får:**

- Verifisert: `{projects:[2], tasks:{}, events:[1]}` gir nå 2 prosjekter og 1 hendelse. `tasks:null` blir `[]`. `meta.version` blir 4. `saveState` har try/catch. Import avviser fremmed JSON og bevarer credentials.
- Feilklassen «appen ser fin ut, dataene er borte» er lukket på de fire stedene vi fant den.

## Alternatives considered

**Validere med et skjema (Zod eller lignende).** Riktig i et prosjekt med byggesteg. Forkastet: ADR 0001/0013 holder appen byggefri, og et håndskrevet skjema for hele state-treet er mer kode å vedlikeholde enn den type-normaliseringen som faktisk trengs.

**Versjonere lagringsnøkkelen (`planlegger.v2`).** Ville gjort migrering eksplisitt og gitt en trygg fallback. Forkastet nå — det krever en migreringsplan for alle enhetene hennes samtidig, inkludert iPhone-PWA-en, og løser ikke kvote- eller import-problemene.

**Ikke la `render()` kalle `saveState()`.** Fjerner mekanismen som overskrev den uleselige blobben. Forkastet: den automatiske lagringen ved rendering er et bærende premiss overalt ellers i koden (enhver handler som kaller `render()` regner med at det persisteres). Å bevare originalen er en mindre inngripende fiks enn å snu det premisset.

**Vise en «kunne ikke lese dataene»-skjerm ved `loadFailed`.** Bedre for brukeren, men krever en UI-flate som ikke finnes, og som må fungere når resten av appen kanskje ikke gjør det. Feltet settes nå, så det kan bygges senere uten nye antakelser.
