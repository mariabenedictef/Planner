# ADR 0030 — Øyeblikksbilder beskytter brukerdata, ikke cachen, og ringene beskjæres på bytes

**Status:** Accepted
**Date:** 2026-08-11

## Context

Målt på Marias faktiske data 2026-08-11, mens vi lette etter noe annet:

| | |
|---|---|
| `planlegger.v1` (levende state) | 649 kB |
| 5 × `planlegger.preSync.*` | ~615 kB hver |
| 3 × `planlegger.backup.*` | 615, 615, 1 kB |
| **Totalt i localStorage** | **4951 kB** |
| Tilgjengelig kvote | ~5120 kB |

Å skrive én ekstra kopi av state kastet `QuotaExceededError` umiddelbart. Med andre ord: appen sto ~170 kB fra veggen, og hadde stått der siden slutten av mai.

Tre ting traff hverandre:

**1. Ringene ble beskåret på antall, aldri på bytes.** Grensene er «5 preSync» og «7 backup». Da de ble valgt var state liten. Etter at Outlook-synken begynte å hente 600+ hendelser ble hvert øyeblikksbilde 615 kB, og de samme grensene tillater da 7,4 MB — mer enn kvoten. Grensene var trygge den dagen de ble skrevet og en tidsinnstilt bombe etterpå.

**2. Øyeblikksbildene inneholdt Outlook-cachen.** `outlookEvents` var 95 % av hver blob. De er *hentbare*: én knapp, tre sekunder, og de er tilbake. Å bruke 585 kB per øyeblikksbilde på å bevare noe som kan hentes igjen er å bruke plassen på det minst verdifulle.

**3. `autoBackup` svelget feilen.** Koden var:

```js
try {
  …
} catch(_){} // localStorage might be full or unavailable
```

Kvoten ble full rundt 26. mai. Siden da har hver eneste daglige backup kastet og blitt slukt av den tomme `catch`-en. **Maria har vært uten lokal dagsbackup i 2,5 måneder, og ingenting sa fra.** Den nyeste `planlegger.backup.*` var fra 26. mai — det var hele symptomet, og ingen så det, fordi ingenting viser det noe sted.

Dette er tredje gang på to dager vi finner samme signatur: ICS-URL-en (ADR 0023, «Etterslep»), dagsbackupen her — noe slutter å virke, og stillheten er identisk med at det virker. ADR 0022 formulerte prinsippet. Denne `catch(_){}` var skrevet før det.

## Decision

**1. Øyeblikksbilder utelater det som kan hentes igjen.**

```js
const SNAPSHOT_OMITS = ['outlookEvents'];
function _snapshotJSON(){ /* state uten SNAPSHOT_OMITS, + _snapshotOmits-markør */ }
```

615 kB → ~35 kB. Alle fire skrivestedene (`pullFromRemote`, `restoreCloudBackup`, `restoreBackup`, JSON-import) bruker den.

**2. Gjenoppretting tømmer ikke kalenderen.** `_mergeSnapshot()` leser `_snapshotOmits` og beholder det som står i state nå for hver utelatt nøkkel. Uten dette ville en gjenoppretting satt `outlookEvents` til `DEFAULT_STATE`s tomme liste — altså «fikset» ved å slette kalenderen.

**3. Ringene beskjæres på bytes, med antallsgrensene som førstelinje.** `_pruneSnapshotsToBudget()` går nyeste-først gjennom alle øyeblikksbilder og dropper alt utover 1,5 MB til sammen. Den kalles ved boot (før `autoBackup`, så dagens backup har plass), og etter hver skriving. Antallsgrensene står — dette er nettet som fanger opp at state har vokst siden de ble satt.

**4. `autoBackup` rapporterer.** Feilen setter `_backupStatus = {ok:false, error}`, logger, og viser en toast som sier hva Maria skal gjøre (eksportér til JSON). Samme for øyeblikksbildet før JSON-import — det er den ene veien tilbake fra en destruktiv operasjon, og at det feilet må sies.

**5. `restoreBackup` skriver øyeblikksbildet etter `confirm()`, ikke før.** Å avbryte dialogen flyttet ringen framover og kastet det eldste øyeblikksbildet uten å ha gjort noe.

## Consequences

**Vi aksepterer:**

- **Et gjenopprettet øyeblikksbilde har ikke sin egen kalender.** Det tar med seg den som står nå. For Outlook-hendelser er det riktig — de er et speil av Outlook, ikke historikk — men det er en reell semantisk endring: øyeblikksbildet er ikke lenger et fullt bilde av fortiden.
- **Beskjæringen sletter data ved boot.** Den er nyeste-først og rører aldri `planlegger.v1`, men den sletter uten å spørre. Alternativet er en app som ikke kan lagre.
- **1,5 MB er et valgt tall.** Med ~35 kB per øyeblikksbilde er det rikelig (≈40 stykker), men det er ikke utledet fra noe. Hvis notater med innlimte bilder begynner å dominere state, må tallet vurderes igjen.
- **Gamle øyeblikksbilder er fortsatt fete.** De 8 som lå der er skrevet med den gamle koden. Boot-beskjæringen dropper dem ned til budsjettet ved første kjøring — det frigjør ~3,7 MB, men det betyr også at 6 av Marias 8 mai-øyeblikksbilder forsvinner. Hun har OneDrive-backupene, sky-backupene og JSON-eksportene i tillegg.
- **Flere toaster.** Vi bytter stillhet for støy, bevisst, som i ADR 0023.

**Vi får:**

- Verifisert i jsdom, som håndhever en ekte 5 MB-kvote: øyeblikksbildet utelater cachen og er 2 kB mot 315 kB, gjenoppretting beholder kalenderen, beskjæringen beholder nyeste og dropper eldste innenfor budsjett, dagsbackupen virker igjen etter beskjæring — og når det virkelig ikke er plass, blir feilen **rapportert** i stedet for slukt.
- Marias situasjon reprodusert i test: fyll kvoten med 8 gamle øyeblikksbilder, kall `autoBackup()`, og se at den lykkes etter beskjæring.
- ~3,7 MB tilbake, og et tak som ikke kan vokse forbi kvoten igjen.

## Alternatives considered

**Flytte `outlookEvents` ut av `planlegger.v1` også**, til sin egen nøkkel som bare skrives når synken kjører. Det ville kuttet `saveState` fra målte 12,1 ms til under 1 ms, siden 95 % av blobben er cache. Fristende, men det er en endring av lagringsformatet med migrering — og migreringsfeil mister data. Utsatt bevisst, med tallene skrevet ned her: 649 kB, 3,7 ms `JSON.stringify`, 12,1 ms totalt per `saveState`, ved strupet skriving hvert 400. ms ≈ 3 % av hovedtråden. Ikke vondt nok i dag.

**Komprimere øyeblikksbildene** (LZ-string eller liknende). Kutter plassen uten å endre semantikken, og beholder full historikk. Forkastet: legger et bibliotek og et format til for å løse et problem som forsvinner helt av å ikke lagre cachen.

**Flytte øyeblikksbildene til IndexedDB**, som har mye høyere kvote. Riktigere sted for store blober, og mappehåndtakene ligger der allerede. Forkastet nå: asynkront API i alle lese- og skrivestier, altså mye mer kode enn feilen berettiget. Verdt å vurdere hvis budsjettet blir trangt.

**Bare øke antallsgrensene ned** (f.eks. 2 preSync + 2 backup). Enkleste fiksen, og den ville løst kvoten i dag. Forkastet fordi den ikke fjerner årsaken: grensen er fortsatt i antall, og neste gang state vokser er vi tilbake her.
