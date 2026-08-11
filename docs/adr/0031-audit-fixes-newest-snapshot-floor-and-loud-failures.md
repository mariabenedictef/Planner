# ADR 0031 — Gulv for nyeste øyeblikksbilde, én dør for øyeblikksbilder, og resten av stillheten

**Status:** Accepted
**Date:** 2026-08-11
**Utvider:** 0022 (state degraderer ikke stille), 0029, 0030

## Context

En full revisjon 2026-08-11, etter at ADR 0029 og 0030 var pushet, fant **to feil i ADR 0030 sin egen fiks** og en rekke instanser av samme klasse ADR 0022 formulerte. Revisjonen gikk i fire spor: stillhetsmønstre, grenser uttrykt i antall, tapsveier for data, og dokumenterte-men-ufiksede ting. Alle funn ble reprodusert før de ble ansett som ekte.

### A. Beskjæringen slettet det nyeste øyeblikksbildet

`_pruneSnapshotsToBudget()` gikk nyeste-først og droppet alt som ikke fikk plass i 1,5 MB. Den hadde **ingen bunn**: er ett øyeblikksbilde alene større enn budsjettet, tas slette-grenen på første iterasjon. Reprodusert:

| localStorage før | etter beskjæring |
|---|---|
| `backup.2026-08-11` = 2 MB (nyeste), `backup.2026-08-10` = 1 MB | **den nyeste slettet**, den eldre beholdt |

Og `autoBackup()` skrev nøkkelen, kalte beskjæringen, og satte så `_backupStatus = { ok: true }` — altså kunne den slette det den nettopp skrev og melde suksess. Det er `catch(_){}` med et hyggeligere ansikt. Ett innlimt bilde i et notat er nok til å komme dit (se F).

### B. Sorteringen var ikke kronologisk

`_snapshotKeys()` sorterte strengen. Leksikografisk kommer **alle** `planlegger.backup.*` før **alle** `planlegger.preSync.*` (`b` < `p`), så etter `.reverse()` rangerte hvert preSync som nyere enn hver dagsbackup. Reprodusert: et preSync fra **juni** beholdt, dagsbackupen fra **11. august** slettet. To av fire skrivesteder brukte i tillegg `Date.now()` og to brukte ISO — `'1' < '2'`, så `Date.now()`-nøklene sorterte alltid eldst uansett når de ble skrevet.

### C. Fire skrivesteder, fire forskjellige oppførsler

Øyeblikksbildet før en destruktiv operasjon er den eneste veien tilbake. Likevel: to steder hadde antallsgrense, ett beskar før skriving, ett gjorde ingen av tingene — og **alle fire svelget feilen i `catch(_){}`** mens koden gikk videre til å erstatte all data. Bare JSON-importen hadde fått en høylytt variant (og den hadde ikke antallsgrense).

### D. Påminnelser ble stemplet som sendt uten å ha blitt sendt

```js
try { new Notification(...); } catch(_){}
fired.push(e.id); sessionStorage.setItem('fired', JSON.stringify(fired));
```

`fired` **er** suksessregisteret, og det ble skrevet uansett. På iPhone kaster konstruktøren (varsler krever `ServiceWorkerRegistration.showNotification`, og ADR 0010 fjernet service workeren), så hver møte- og fristpåminnelse ble svelget og deretter markert som levert — aldri forsøkt igjen i den økten. Innstillinger sa «På». Samme signatur som ICS-URL-en og dagsbackupen: **noe slutter å virke, og stillheten er identisk med at det virker.**

`toggleNotifications` kastet dessuten resultatet av `requestPermission()`, så et avslag etterlot «På» for alltid, og `setupNotifications()` ble bare kalt ved oppstart — å skru påminnelser på gjorde ingenting før neste sidelasting.

### E. Fem andre stille degraderinger

- **Push stanset uten spor.** Sletter du det siste prosjektet, hopper `scheduleRemoteSync` over pushen (riktig vakt mot å tømme skyen) men rører ikke `_syncStatus`, så indikatoren blir stående grønn. Pullet henter ikke slettingen tilbake heller, siden lokal `lastModified` er nyere. To enheter kan divergere permanent mens begge sier «synket».
- **`_outlookStatus` ble skrevet og aldri lest.** Eneste spor etter en feilet Outlook-sync var en toast som forsvant, mens `state.outlookEvents` (aldri invalidert ved feil, med vilje) fortsatte å vise forrige ukes møter som om alt var i orden.
- **Fem lagre-handlere forkastet redigeringen** når posten var forsvunnet (`if (!ex){ closeModal(); render(); return; }`) — dialogen lukket seg presis som ved suksess. Realistisk utløser: 60-sekunders-pullet erstatter hele state mens dialogen står åpen.
- **Ukjent ICS-tidssone degraderte til flytende tid uten et ord.** Et møte i en umappet sone vises på kildens veggklokke som om den var lokal — 14:00 New York blir 14:00 norsk tid, seks timer feil, og ser helt normalt ut.
- **«✓ Backup-mappe satt» ble vist uten at skrivingen var bekreftet,** og `getBackupDirHandle` returnerte `null` både for «ingen mappe valgt» og «klarte ikke lese IndexedDB».

### F. Ubundet vekst og kostnad som vokser med kalendertid

- **Innlimte bilder ble lagret i full størrelse.** Ingen grense, ingen nedskalering. Målt: én skjermdump tok state fra 569 kB til 2617 kB — og kvoten er ~5 MB. Dette er den ene handlingen som kan ta hele lagringsplassen på ett klikk, og den mater rett inn i A.
- **`renderWeek` kalte `eventsOnDay()` 112 ganger per tegning** (16 timer × 7 dager), 16 av dem med identisk nøkkel, hver et fullskann av 627 Outlook-hendelser. `renderDay` gjorde det riktig hele tiden.
- **`recurringInstanceOnDay` gikk ett intervall av gangen fra seriens start,** to `Date`-allokeringer per steg. Kostnaden vokste med kalendertid, ikke med dataene: en daglig serie fra 2022 målte 124 ms per ukesvisning-tegning.
- **`saveState` serialiserte hele staten to ganger** — én gang for endringssammenligningen, én gang for skrivingen — og skrev den på nytt ved hver `render()` og hvert 400. ms mens hun skriver, også når resultatet var byte for byte identisk.
- **Sju skjemaer hadde `setTimeout(()=>document.getElementById(x).focus(), 50)`** uten null-sjekk. Lukkes dialogen innen 50 ms, kaster den en uncaught `TypeError`. Fanget av en test som ved uhell traff timingen.

## Decision

**1. Beskjæringen har et gulv: det nyeste øyeblikksbildet står alltid, uansett størrelse.** Det er rullback-punktet; å slette det for å holde et budsjett er å vinne feil kamp.

**2. Sortering skjer på parset tid** (`_snapshotTime`), som håndterer ISO-nøkler, `YYYY-MM-DD` og arvede `Date.now()`-nøkler. `planlegger.unreadable.*` regnes med i budsjettet — den lå utenfor og kunne okkupere ~650 kB permanent, usynlig.

**3. Én dør for øyeblikksbilder.** `_writePreSyncSnapshot()` beskjærer først, skriver, håndhever antallsgrensen, beskjærer igjen, **sjekker at nøkkelen fortsatt finnes**, og returnerer `{ok}`. Alle fire kallsteder bruker den. `autoBackup` sjekker på samme måte før den stempler `ok`.

**4. Stemple bare det som faktisk skjedde.** `_fireNotification()` returnerer `true` bare hvis varselet ble konstruert; `fired` skrives bare da. Feiler det, sies det én gang — ikke hvert minutt. `toggleNotifications` leser permission-resultatet, nekter å skru på det som ikke kan virke, og starter/stopper intervallet der og da.

**5. Tilstand som betyr noe i morgen skal stå et sted.** Innstillinger viser nå påminnelses-status (tillatt / blokkert / kan ikke vises), Outlook-status (siste synk feilet, med årsak; eller ingen vellykket synk på N døgn), og backup-status (fra ADR 0030). Stanset push får egen indikator-tilstand `blocked` med forklaring i tooltip. En forkastet lagring sier fra. Ukjent tidssone advarer én gang per sonenavn.

**6. Bildene skaleres ned før de havner i state** — maks 1400 px på lengste side, JPEG 0.85, og en beskjed om hvor stort resultatet ble. Løftet innfris **alltid**, med tidsvakt: fyrte verken `onload` eller `onerror`, ble bildet aldri satt inn i det hele tatt.

**7. Ytelse: gjør arbeidet én gang.** `eventsOnDay` hentes ut av time-loopen (112 → 7 kall). `daily` og `weekly` hopper aritmetisk til området rundt måldatoen. `saveState` returnerer tidlig når ingenting er endret og forrige skriving gikk bra og nøkkelen står der. `_focusLater()` null-sjekker.

**Bevisst ikke endret:**

- **Månedlig gjentakelse stepper fortsatt kumulativt.** Differansetesten (153 600 tilfeller, gammel mot ny) avslørte at `addMonths` *snapper til den 1.*, så en månedlig serie fra 31. januar havner på den 1. hver måned etterpå. Det er sannsynligvis feil, men å endre det **flytter hendelser som alt ligger i kalenderen hennes**, og det hører ikke inn i en ytelsesfiks. Kostnaden er uansett neglisjerbar: 5-årstaket gir maks 60 steg for monthly mot 1826 for daily. Testene dokumenterer dagens oppførsel eksplisitt, så en framtidig endring blir et bevisst valg.
- **Fullførte oppgaver ryddes ikke automatisk.** De akkumulerer i `state.tasks` for alltid (visningen kappes til 20, lageret ikke) — omtrent 1,8 MB på fem år. Å slette dem automatisk er datatap; lagringsindikatoren i Innstillinger gjør veksten synlig i stedet.
- **5-årstaket på gjentakelser står.** En ukentlig hendelse laget nå slutter å vises i 2031, uten melding. Å fjerne taket nå ville endre hva som vises i kalenderen; det er en egen avgjørelse.
- **`outlookEvents` ligger fortsatt i hovednøkkelen.** Se ADR 0030 for tallene og hvorfor det er utsatt.

## Consequences

**Vi aksepterer:**

- Flere toaster og flere statuslinjer i Innstillinger. Vi bytter stillhet for støy, tredje gang bevisst.
- `saveState`-hurtigveien hviler på at `_lastSavedBody` og `_lastWriteOk` faktisk speiler disken. Nøkkelsjekken (`STORAGE_KEY in localStorage`) lukker det åpenbare smutthullet, men skriver noe utenfor `saveState` en *annen* verdi til nøkkelen uten å oppdatere `_lastSavedBody`, tror vi disken er riktig. Kallstedene som gjør det i dag oppdaterer begge.
- Bilder re-kodes til JPEG, så en skjermdump med skarp tekst blir litt mykere, og gjennomsiktighet blir svart. Det er en synlig kvalitetsendring hun vil legge merke til — byttet mot at tre skjermdumper ikke lenger fyller lagringsplassen.
- Den aritmetiske gjentakelsen gjelder bare `daily` og `weekly`. Nye gjentakelsestyper må enten få egen aritmetikk eller falle tilbake til stepping.

**Vi får:**

- 206 assertions (fra 159), grønne i både UTC og Europe/Oslo, ICS-suiten 61/61. **12 av dem feiler mot koden før denne endringen** — inkludert en reprodusert ytelsesregresjon (166 ms mot 26 ms) og den uncaught `TypeError` fra fokuseringen.
- Ukesvisningen målt 195,6 → 49,0 ms med langlevde gjentakelser og 627 Outlook-hendelser.
- Marias faktiske situasjon reprodusert i test på tre punkter: kvoten full av gamle øyeblikksbilder, ett øyeblikksbilde større enn budsjettet, og et juni-preSync som utkonkurrerer dagens backup.

## Alternatives considered

**Slippe gulvet og heve budsjettet i stedet.** Enklere, men problemet er ikke budsjettets størrelse — det er at algoritmen kunne slette rullback-punktet. Et gulv er riktig uansett hvilket tall budsjettet har.

**Skrive om nøkkelformatet til rent `Date.now()` for alle.** Ville gjort sorteringen trivielt korrekt, men gamle nøkler må uansett kunne leses, så parseren trengs likevel — og ISO-navnene er lesbare i Innstillinger.

**La `saveState` skrive hver gang, og heller flytte `outlookEvents` ut av hovednøkkelen.** Den riktigere fiksen på lang sikt, og den står i ADR 0030 med tall. Hurtigveien her er billig, reversibel og løser den målte kostnaden nå.

**Blokkere store bilder helt i stedet for å skalere ned.** Ærligere om begrensningen, men å avvise et innlimt bilde er en dårligere opplevelse enn å ta imot en mindre versjon av det.

**Avvise påminnelser på iPhone eksplisitt** (skjule bryteren der). Forkastet: `Notification` kan bli støttet i en framtidig Safari-versjon, og statuslinjen sier nå sannheten uansett hva nettleseren gjør.
