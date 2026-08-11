# ADR 0023 — Felt lagrer på `input` (strupet), og vi stempler ikke suksess vi ikke kan bekrefte

**Status:** Accepted
**Date:** 2026-08-10

## Context

To beslektede mønstre, begge funnet i helsesjekken 2026-08-10, begge med samme signatur: koden antar at noe skjedde uten å sjekke.

### A. Felt som bare lagrer på `blur`

Notat-feltet i Dag-visningen lagret bare i `blur`-lytteren. `bootSync` poller skyen hvert 60. sekund, og en pull kaller `render()`, som erstatter `viewEl.innerHTML`. **Å fjerne et fokusert element fra DOM-en utløser ikke `blur` i noen nettleser.** Verifisert: skrev i feltet, kalte `render()`, teksten var borte fra både DOM og state.

Konkret: Maria skriver en lang refleksjon på PC-en. iPhonen gjør sin timesvise Outlook-sync og pusher. PC-en poller innen 60 sekunder. Avsnittet er borte. Samme mekanisme rammet `pms-title`, `pl-url`, `pp-name` og tittel-redigering på To Do's.

Og en felle i den nærliggende løsningen: en `debounce` som *restarter* timeren på hvert tastetrykk commiter aldri mens man skriver sammenhengende. Notat-editoren hadde nøyaktig det mønsteret (400 ms debounce med `clearTimeout`), så «skriv i to minutter uten pause» ga null lagringer.

### B. Suksess som stemples uten bevis

`autoWeeklyExport` satte `state.sync.lastWeeklyExport` rett etter `a.click()` på et nedlastings-anker, og viste toasten «💾 Ukentlig sikkerhetskopi lagret til Nedlastinger-mappen». `a.click()` gir ingen tilbakemelding. På iOS, eller når nettleseren blokkerer flere nedlastinger, skjer ingenting — men 7-dagers-telleren var stemplet, så neste forsøk kom om en uke. `lastWeeklyExport` vises ikke noe sted i UI-et, så backupene kunne ha «kjørt» ut i løse luften i månedsvis.

Samme mønster tre steder til: `syncOutlook(true).then(r => { if (r.ok) render(); })` forkastet alle feil; `loadCloudBackups` returnerte `[]` både ved 401 og ved nettverksfeil, så et utløpt token ble presentert som «Ingen sky-backups enda» med en oppfordring til å oppdatere workeren; og push/pull delte én statusindikator, så en vellykket pull malte over en mislykket push innen 60 sekunder — grønn indikator, endring som aldri nådde skyen.

Og `dirHandle.requestPermission()` ble kalt under boot. Spec-en krever brukeraktivering; Chrome kaster `SecurityError`, som ble fanget og bare logget — så mappevalget degraderte stille til Downloads ved hver nettleser-omstart.

## Decision

**1. Felt commiter på `input`, strupet — ikke debounce'et.**

```js
input.addEventListener('input', () => {
  if (_timer) return;                     // en commit er allerede planlagt
  _timer = setTimeout(() => { _timer = null; commit(); }, 400);
});
input.addEventListener('blur', commit);
```

Å returnere tidlig i stedet for å restarte timeren garanterer en commit hvert 400. ms *mens* man skriver. `blur` beholdes som umiddelbar commit. Anvendt på dag-notatet og på notat-editorens autolagring.

**2. Vi stempler ikke tilstand vi ikke kan verifisere.** `autoWeeklyExport` setter ikke lenger `lastWeeklyExport` i Downloads-grenen — bare i grenen som `await`-er `writable.close()` mot en valgt mappe. Toasten sier «lastes ned» i stedet for «lagret», og peker på mappevalget i Innstillinger. Konsekvensen er at nedlastings-grenen prøver på nytt ved hver load, som er riktig oppførsel for noe vi ikke vet gikk bra.

**3. En feil som ikke vises, finnes ikke.** Outlook auto-sync viser en toast og setter `_outlookStatus` ved feil. `loadCloudBackups` returnerer `{error}` og skiller 401/403 («Ikke autorisert — sjekk synk-tokenet») fra andre feil, og lista viser årsaken. Push-feil spores i `_lastPushError`, og en vellykket pull maler ikke over en uoppgjort push-feil — indikatoren blir stående rød til opplastingen faktisk lykkes.

**4. Nettleser-API-er som krever brukeraktivering kalles bare med brukeraktivering.** `requestPermission` kalles kun når `navigator.userActivation.isActive`; ellers hoppes den over med en `console.warn`, og Settings viser «⚠» som før.

## Consequences

**Vi aksepterer:**

- En commit hvert 400. ms mens man skriver betyr flere `saveState`-kall, og `saveState` serialiserer hele state. Med base64-bilder i notater er det målbart. Det er billigere enn tapt tekst, men det er en reell kostnad, og gjør serialiseringen til en kandidat for optimalisering senere.
- Strupingen kan fortsatt miste opptil 400 ms med tasting hvis en pull lander i akkurat det vinduet. Å eliminere det helt krever at `render()` bevarer fokuserte felt eller utsetter seg selv mens brukeren skriver — riktigere, men en større endring i render-kontrakten enn denne feilen berettiget.
- Nedlastings-grenen i den ukentlige backupen prøver nå ved hver load til en mappe er valgt. Det er med vilje, men det betyr en toast oftere for den som aldri velger mappe.
- Flere toaster ved feil. Vi bytter stillhet for støy, bevisst.

**Vi får:**

- Verifisert: tekst skrevet i dag-notatet overlever et `render()` nå. Alle fire slette-knappene på rad-nivå bekrefter. Push-feil overlever en vellykket pull.
- Prinsippet er formulert og gjelder neste gang noen legger til et felt eller en «lagre til disk»-operasjon: commit på `input`, og ikke stemple det du ikke har ventet på.

## Alternatives considered

**La `render()` bevare fokuserte felt** — les verdien før `innerHTML` settes og skriv den tilbake etterpå. Løser hele klassen i ett grep. Forkastet nå: krever at hvert felt har en stabil id og at render-funksjonene samarbeider, og en delvis implementasjon er verre enn ingen (feltene som glemmes ser trygge ut). Verdt å vurdere hvis flere felt-tap dukker opp.

**Utsette bakgrunns-pull mens brukeren skriver** — flagg som settes på `input` og nullstilles etter noen sekunders ro, og som `pullFromRemote` respekterer. Enkelt og effektivt, men gjør sync-timingen avhengig av UI-tilstand. Notert som mulig neste steg.

**Bruke `beforeunload` som sikkerhetsnett** — fanger tab-lukking, men ikke bakgrunns-render, som var den faktiske feilen.

**Fjerne den ukentlige nedlastings-grenen helt** og kreve mappevalg. Ærligere, men tar bort det eneste som virker på iPhone.

## Etterslep — `ics-url` ble oversett (2026-08-11)

Beslutningen over ble anvendt på dag-notatet, notat-editoren, `pms-title`, `pl-url`, `pp-name` og tittel-redigering på To Do's — men **ikke** på ICS-URL-feltet i Innstillinger, som fortsatt bare lagret på `blur`.

Tapsveien er en annen enn i A: Innstillinger overlever en bakgrunns-`render()`, men **Esc kaller `closeModal`, som fjerner feltet fra DOM-en — og fjerning utløser ikke `blur`.** Å klikke «Lukk» eller «Oppdater nå» flytter fokus først og lagret altså riktig, så feltet oppførte seg trygt i den vanlige flyten og mistet bare data i Esc-varianten. Det gjorde den vanskelig å oppdage.

Konsekvensen var ikke hypotetisk: den ble funnet 2026-08-11 mens vi feilsøkte at Outlook-synken hadde stått stille siden 23. mai. Symptomet var villedende — 555 gamle hendelser lå der og så ut som data.

Feltet bruker nå samme strupede `input`+`blur`-mønster som resten. `commitIcsUrl` sammenligner mot gjeldende verdi før `saveState()`, så et åpent Innstillinger-vindu ikke lenger pusher ved hvert blur uten endring.

**Bevisst ikke endret:** `sync-url` og `sync-token` har ingen `blur`-lytter i det hele tatt — de lagres kun med «Lagre»-knappen. Eksplisitt lagring er et sammenhengende valg for et felt med en synlig knapp, og et token som lagres halvskrevet ved hvert tastetrykk er verre, ikke bedre. Forskjellen fra `ics-url` var at *det* feltet hadde en `blur`-lytter og dermed lovet en implisitt lagring det ikke holdt.

**Prinsippet skjerpet:** når en beslutning som denne tas, skal den anvendes ved å søke opp *alle* forekomster av mønsteret i samme change-set, ikke bare de som utløste funnet. Revisjonen som fant dette var `grep -n "addEventListener('blur'"` — seks treff, ett uten `input`-makker.
