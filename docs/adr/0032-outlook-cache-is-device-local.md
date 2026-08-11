# ADR 0032 — Outlook-cachen er enhetslokal, gjentakelser bevarer dagen i måneden, og resten av stillheten

**Status:** Accepted
**Date:** 2026-08-11
**Fullfører:** de fire utsatte punktene i 0030/0031, og retter en feil i 0025 sin andre kodesti

## Context

Etter ADR 0031 sto åtte punkter igjen: fire bevisst utsatt, fire åpne. Maria ba om at alt ble tatt. Det som fulgte er verdt å skrive ned fordi to av dem viste seg å ikke være avveininger i det hele tatt.

### A. Månedlig gjentakelse var samme feil i den andre kodestien

`recurringInstanceOnDay` brukte `addMonths`, som **snapper til den 1.** i måneden — den finnes for kalendernavigasjon. En månedlig serie fra 31. januar ble derfor 31/1 → 1/2 → 1/3 og lå på den 1. for alltid.

Kommentaren over `addMonthsKeepDay` i samme fil sier det rett ut:

> Distinct from addMonths(), which snaps to the 1st on purpose for calendar navigation — **using that one for RRULE expansion collapsed every monthly recurrence onto the 1st.** See ADR 0025.

Altså: presis denne feilen ble funnet og rettet for ICS-serier. Den manuelle gjentakelsen ble aldri rettet. ADR 0031 klassifiserte den som «bevisst ikke endret» fordi en endring ville flytte hendelser i kalenderen — men det er en **feil i den andre instansen av et mønster som alt er avgjort**, ikke et designvalg. Sjekklista mi har et eget punkt om nettopp dette (mønster-sveip), og det ble ikke fulgt.

Marias kalender hadde **null** manuelt opprettede gjentakende hendelser da dette ble målt, så ingenting flyttet seg.

### B. 5-årstaket fantes bare for å bremse en loop som ikke lenger stepper

`if (target > baseStart + 5 år) return null` ble skrevet da forekomster ble enumerert ett steg av gangen. ADR 0031 gjorde beregningen aritmetisk; begrunnelsen for taket forsvant, men taket sto. En ukentlig hendelse laget i dag sluttet å vises i 2031, uten et ord.

### C. Outlook-cachen hørte ikke hjemme noe av stedene den lå

ADR 0030 målte den: 652 kB state, ~95 % `outlookEvents`, 12,1 ms per `saveState`. Den ble utsatt fordi det er en formatendring med migrering. Men det som ble tydelig ved gjennomgangen er at cachen er **enhetslokal**: hver enhet henter ICS-feeden selv (`autoSyncOutlook` kjører per enhet). Da hører den verken i hovednøkkelen (som skrives ved hver render), i sky-blobben (som lastes hvert 60. sekund) eller i øyeblikksbildene (0030 tok den ut derfra allerede).

Det gjør dette til én endring som løser to av de gjenstående punktene: lagringskostnaden **og** dataoverføringen.

### D. Pollingen var feil på frekvens, ikke bare på størrelse

Hvert 60. sekund, døgnet rundt, uansett om fanen var i bruk. ~39 MB/time nedlastet mens PC-en sto låst.

### E. De øvrige stille punktene

Mikrofonknappen (`catch(_){ cleanup(); }` — knappen så ut som den ikke gjorde noe) · `clearBackupDirHandle` (`catch {}`, og kalleren toastet suksess uansett) · uvoktet `JSON.parse` av `fired` i et intervall som kjører hvert minutt · to `.then()` uten `.catch()` · sluttdato tidligere enn startdato ble stille erstattet med `''` · «Lagre» uten tittel gjorde ingenting uten å si hvorfor · fullførte oppgaver akkumulerte for alltid (visningen kappet til 20, lageret ubundet — 82 av Marias 108 oppgaver var fullført).

## Decision

**1. Månedlig og årlig gjentakelse bruker `addMonthsKeepDay` — i alle fire kodestiene.** Mønster-sveipet i pre-push-sjekklista fant to flere forekomster rett før push: `HANDLERS.toggleTask` og `HANDLERS.toggleProjectTask` flytter fristen på en gjentakende oppgave når den krysses av, og begge brukte `addMonths` — en månedlig oppgave med frist den 25. hoppet til den 1. neste måned og ble liggende der. Fire kodestier, samme feil, tre runder med å finne dem.

Regelen er nå den samme overalt: dagen i måneden bevares og klamres til månedens siste dag — 31/1 → 28/2 → 31/3 → 30/4. For hendelser regnes forekomsten fra basen, ikke kumulativt, så det ikke kan drifte. Samme regel som ICS-serier har hatt siden 0025. Verifisert mot en referanse-implementasjon over 154 000 tilfeller.

**2. Horisonten er `RECUR_HORIZON_YEARS = 25`**, en navngitt konstant i stedet for et magisk 5 begravd i en betingelse. `recurringUntil` overstyrer som før.

**3. Outlook-cachen bor i `planlegger.outlook.v1`.**

- `_stateWithoutCache()` er det som lagres i hovednøkkelen, sammenlignes for endring, og pushes til skyen.
- `_saveOutlookCache()` skrives for seg og hopper over skriving når innholdet er uendret. Den kalles **først** i `saveState`, før hurtigveien — ellers ville en Outlook-synk, som bare endrer cachen, blitt lest som «ingenting er endret» og kalenderen aldri lagret. *(Den feilen ble innført og fanget av testen i samme runde.)*
- **Migrering:** egen nøkkel vinner. Finnes den ikke, men hovedblobben har en cache, skrives den over ved første load. Verste utfall hvis skrivingen feiler er en tom kalender til neste synk — ett klikk.
- **Pull og sky-gjenoppretting beholder den lokale cachen** når blobben ikke har en, ellers ville `DEFAULT_STATE` tømt kalenderen. Samme mønster som synk-legitimasjonen (ADR 0022).
- `resetAll` fjerner begge nøklene. **Eksport tar fortsatt med cachen** — en eksport skal være komplett. Import lar filens cache vinne hvis den har en.

**4. Pollingen roer seg.** Pause når fanen er skjult, umiddelbart pull når den blir synlig igjen, og dobling av intervallet 60 s → 8 min når ingenting endrer seg. `_nextPollDelay()` er skilt ut som egen funksjon fordi den er verdt å teste.

**5. Fullførte oppgaver ryddes eksplisitt, aldri automatisk.** Innstillinger viser hvor plassen går (Outlook-cache / oppgaver / prosjekter / dagsnotater), og tilbyr «Rydd bort» når 25 eller flere oppgaver er fullført. Handlingen skriver et øyeblikksbilde først, så den kan angres fra «Lokale backups». Automatisk sletting er datatap og er ikke innført.

**6. Resten av stillheten sier fra**, hver på det stedet Maria ville sett etter: toast for mikrofon og mappevalg, forklaring når «Lagre» avvises, melding når en sluttdato ikke ble tatt imot, og et `fired`-register som nullstilles i stedet for å kaste hvert minutt.

## Consequences

**Vi aksepterer:**

- **To localStorage-nøkler i stedet for én.** Alt som skriver state må gå via `saveState` eller huske `_saveOutlookCache()`. De fire stedene som skriver `STORAGE_KEY` direkte gjør det.
- **Sky-blobben inneholder ikke lenger kalenderen.** En enhet som pulles til uten å ha satt ICS-URL får ingen Outlook-hendelser før den henter selv. Det er riktig — men det er en atferdsendring for en ny enhet.
- **Eksportfiler er fortsatt store** (de inneholder cachen med vilje). En eksport er en full sikkerhetskopi.
- **Pollingen kan ligge opptil 8 minutter bak** på en fane som står åpen uten endringer. Den nullstilles ved fokus og ved første endring, så i praksis merkes det ikke — men det er en reell økning i verste-falls-forsinkelse.
- **Gjentakende hendelser flytter seg** hvis noen hadde en månedlig serie fra en dato etter den 28. Marias kalender hadde ingen; en annen brukers ville flyttet, og det ville sett ut som en feil.
- **«Rydd bort»-knappen er destruktiv.** Den er bak en bekreftelse og et øyeblikksbilde, men den sletter.

**Vi får:**

- 241 assertions (fra 220), grønne i UTC og Europe/Oslo, ICS 61/61. **15 feiler mot forrige commit**, og en sekstende — det ødelagte `fired`-registeret — **krasjer** den gamle koden, som er selve funnet.
- Hovednøkkelen fra 652 kB til ~35 kB, og sky-overføringen fra ~39 MB/time til ~2 MB/time før backoffen regnes med.
- Alle åtte gjenstående punkter fra 0031 lukket, og ingen av dem står igjen som «utsatt».

## Alternatives considered

**Beholde månedlig drift og bare dokumentere den.** Det var ADR 0031 sitt valg, og det var galt: kommentaren i koden viste at avgjørelsen alt var tatt for den andre kodestien. En «bevisst avveining» som viser seg å være en glemt instans av et avgjort mønster skal rettes, ikke dokumenteres.

**Flytte cachen til IndexedDB** i stedet for en egen localStorage-nøkkel. Riktigere sted for store blober og ingen kvotekonkurranse med brukerdata. Forkastet nå: asynkront API i lese-stien betyr at `loadState` må bli async, som forplanter seg til boot-rekkefølgen. Egen nøkkel gir det meste av gevinsten for en brøkdel av endringen. Verdt å vurdere hvis cachen vokser forbi noen få MB.

**Betinget GET med ETag** for pollingen, i stedet for backoff. Ville kuttet overføringen til nær null når ingenting er endret, og er den riktige løsningen. Forkastet nå fordi den krever en endring i Cloudflare-workeren, og workeren er utenfor det denne endringen rører. Notert som neste steg — med backoffen på plass er gevinsten mindre hastende.

**Automatisk arkivering av fullførte oppgaver etter N dager.** Enkelt, og ville holdt lageret lite av seg selv. Forkastet: det sletter data uten at hun ba om det, og «fullført for 90 dager siden» er ikke det samme som «uinteressant».
