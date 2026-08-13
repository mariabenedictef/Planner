# Endringslogg — Planlegger

Hver vesentlig endring blir notert her med dato + commit-referanse. Holder oversikt over hva som har skjedd over tid og når. ADR-ene forklarer *hvorfor* — denne loggen forklarer *hva* og *når*.

Nye innslag legges øverst.

---

## 2026-08-13 — Angring, relative datoer, prosjektfarger, masseredigering, tomme tilstander og iPhone

Seks punkter, alle visuelle eller brukervennlighetsrettet. ADR 0039–0044.

- **Angre sletting.** Sletting var endelig — og på × for en fri To Do fantes ikke engang en bekreftelse. Alle elleve slettehandlinger går nå gjennom `deleteWithUndo` og gir en toast med «↩ Angre» i åtte sekunder. Ctrl/Cmd+Z virker også, utenfor skrivefelt. Bekreftelsesdialogene er fjernet for enkeltelementer (to sikkerhetsnett som gjør samme jobb betyr bare at man slutter å lese det ene) og beholdt der angring ikke dekker hele tapet: hele prosjektet, alle forekomster av en gjentakende hendelse, massesletting. Gjenopprettingen slår opp lista på nytt, så et sky-pull i mellomtiden ikke gjør angringen til en stille no-op.
- **Relative datoer.** «12. aug» krevde hoderegning i hver rad. Nå står det «i dag», «i morgen», «om 3 dager», «2 dager på overtid» innenfor ±7 dager — med absolutt dato i `title` og utenfor vinduet. Gjelder To Do-lista, Urgent på Hjem, prosjektkortene, prosjektsidens oppgaver og delmål, og kanban-kortene. Datointervaller beholder absolutte datoer i begge ender. `Math.round` og ikke `floor`: et døgn over sommertidsskiftet er 25 timer, og suiten sjekker begge skiftene i 2026 i to tidssoner.
- **Fast farge per prosjekt,** utledet av tittelen. Chipen var grå overalt, så en tagget oppgave måtte leses for å plasseres. Samme prosjekt får samme nyanse på PC og telefon uten at noe synkroniseres, og prosjektkortet får den som venstrekant — så kortet og den taggede oppgaven kjennes igjen som samme sak. Metning og lyshet ligger i CSS, én gang for lys og én for mørk modus. Chipen rendres nå fra én funksjon i stedet for seks strengkonkateneringer.
- **Masseredigering av To Do's.** 23 oppgaver uten frist er trettende å datere én og én. «☑ Velg flere» gir avkryssingsbokser og en handlingslinje: sett eller fjern frist, flytt til prosjekt eller fjern taggen, merk gjort, slett. «Merk gjort» går gjennom `_setDone`, så `doneAt` blir stemplet og ukesoppsummeringen ser dem. Massesletting spør først og kan angres i én operasjon, med rekkefølgen intakt. Utvalget lagres ikke — det er arbeidsminne, og en avkryssing som overlevde en omstart ville vært et gjenferd.
- **Tomme tilstander som fører videre.** Ni av dem har fått en knapp: «+ Ny oppgave», «+ Legg til person», «+ Legg til lenke». De som peker på et felt lenger ned på siden har en test som sjekker at feltet faktisk finnes i DOM. «Ingen urgent-saker — godt jobba» har med vilje ingen knapp.
- **iPhone-gjennomgangen fant to døde CSS-regler.** Media-blokkene for telefon ligger midt i stilarket, og to basisregler lenger ned overstyrte dem: handlingsknappene i To Do-radene var **usynlige** på iPhone men tok fortsatt 126 px høyde i hver rad, og draghåndtaket sto der på touch hvor dra ikke virker i det hele tatt. Målt radhøyde 172 px mot 42 på desktop — fire oppgaver fylte skjermen. Radene viser nå ✎ og × på telefon (prioritet og prosjekt ligger i skjemaet ✎ åpner, og for flere rader finnes velg-modus), tittelen wrapper internt i stedet for å dytte avkryssingsboksen alene opp på egen linje, bøtteoverskriften legger seg ikke lenger oppå hjelpeteksten, og «legg til»-feltene på prosjektsiden er ikke lenger klippet av høyre kant. **Median radhøyde 172 → 60 px.** Nye mobilregler må ligge nederst i arket — det står i en kommentar der.

Testsuiten: 364 → 460 assertions. 11 feiler mot forrige commit, fordelt på alle fem nye seksjoner. Skjermbilder i to bredder, lys og mørk modus; telefonbredden emuleres med blink-flagg, for `viewport: 390px` alene matcher ikke `@media (hover: none)` og måler da en smal skjerm med mus.

---

## 2026-08-12 (natt) — Dealflow som brett, hurtigtaster, uten-frist og ukesoppsummering

Fire ting, hvorav den første lukker det siste punktet fra revisjonen. ADR 0037 og 0038.

- **Kanban-brettet viser hele prosjektet.** Det leste bare prosjektets egne oppgaver, så Dealflow — der casene ligger som taggede To Do's — var tomt for nettopp den bruken brettet passer best til. «Shive» og «Akvavet Gulen AS» står nå i kolonner, og drag-and-drop treffer riktig lager. Negativ kontroll: mot forrige commit rendrer brettet 1 kort der det nå rendrer 3.
- **`status` og `done` var to uavhengige sannheter.** En oppgave med status «I gang» som ble krysset av i lista ble liggende i «I gang»-kolonnen. `_setDone` er nå den ene døren for ferdig, og holder begge i takt. Fire steder satte `done` direkte før.
- **`doneAt` registreres fra i dag.** Ingenting registrerte *når* noe ble gjort, så en ukesoppsummering var umulig å regne ut. Eldre fullførte oppgaver har den ikke, og panelet sier det i stedet for å vise en tom liste.
- **Hurtigtaster i søket:** `/` og Ctrl/Cmd+K åpner det, piltaster flytter markeringen, Enter åpner. `/` er avvergt mens du skriver i et felt. Klikk og Enter går gjennom samme funksjon, så de sju åpne-grenene ikke kan drifte fra hverandre.
- **«Uten frist» på Hjem.** En To Do uten dato er usynlig i Dag, Uke og Måned. Seksjonen viser inntil 8, og vises ikke i det hele tatt når den er tom.
- **Ukesoppsummering** fra en knapp ved datoen: gjort siste 7 dager, glippet (forfalt og ugjort, delmål inkludert), neste 7 dager. Radene er klikkbare. Lagrer ingenting — det er et vindu, ikke en logg.

Testsuiten: 323 → 364 assertions. 24 feiler mot forrige commit.

---

## 2026-08-12 (sen kveld) — Adressen er hvor du er, så tilbakeknappen virker

«Hvor er jeg» bodde bare i lagret state, og nettleserens tilbakeknapp gjorde ingenting — eller forlot appen. Nå står posisjonen i adressen. ADR 0036.

- **Prosjektsider kan bokmerkes og deles:** `#/prosjekter/p-meox`. Norske segmenter, siden URL-en er noe du ser: `#/hjem`, `#/uke/2026-08-10`, `#/arsoversikt/2026-08-01`.
- **Bare ekte navigasjonssteg lager historikk.** Fanebytte, åpne prosjekt og tilbake-knappen pusher. Pilene i kalenderen og et bakgrunns-pull speiler bare adressen — ellers ville hvert ukebytte og hvert 60-sekunders-pull fylt tilbakeknappen med støy.
- **Adressen vinner ved oppstart,** så et bokmerke åpner det det peker på. Uten hash brukes lagret posisjon som før.
- **Ukjent adresse lander deg ikke tilfeldig:** den avvises, og adressen rettes tilbake til der du faktisk er. Peker lenken på et slettet prosjekt, får du kortrutenettet, ikke en tom side.
- **Dette lukker klassen bak ADR 0034,** ikke bare instansen. Da posisjonen var en lagret verdi, måtte hver navigasjonsvei huske å rydde den — og fanen «Prosjekter» hadde glemt det. Nå arver en ny vei riktig oppførsel av å bruke ruten.
- **Utenfor URL-en med vilje:** filteret Alle/Jobb/Privat. Det er en preferanse, ikke en posisjon.

Testsuiten: 296 → 323 assertions.

---

## 2026-08-12 (kveld) — Prosjektnavnet trenger ikke stå i tittelen også

Av 12 taggede To Do's hadde 8 prosjektnavnet skrevet inn i tittelen: «Meox: Sende EOGF protokoll til signering». Dobbelt opp — og etter ADR 0033 spiser prefikset plassen på prosjektkortene der titlene kappes. ADR 0035.

- **Taggen er nå en chip** i stedet for «· Meox AS» i dempet kursiv. Den så ut som en fotnote, og det er antakelig derfor navnet ble skrevet i tittelen i tillegg. Samme utseende overalt taggen vises, og den kan fortsatt klikkes for å fjernes.
- **En opprydding i Innstillinger** fjerner redundante prefikser, viser hver enkelt endring før den skjer, og tar øyeblikksbilde først. Raden dukker bare opp når det finnes noe å rydde.
- **Regelen er streng med vilje, og dataene er grunnen.** «Shive: Lage en peer analyse» er tagget til *Dealflow* — «Shive» er et selskap i pipelinen, ikke prosjektnavnet. En regel som fjernet ledende «Ord:» ville slettet den informasjonen. Prefikset må matche det taggede prosjektets tittel på ordgrense: «Meox» → «Meox AS» ✓, «Shive» → «Dealflow» ✗.
- **Ingen automatikk ved lagring.** Å strippe prefikset når du lagrer ville endret det du nettopp skrev, uten at du ba om det.

Testsuiten: 271 → 296 assertions.

---

## 2026-08-12 (kveld) — Fanen «Prosjekter» går alltid til startsiden

`state.ui.openProjectId` er del av den lagrede ui-tilstanden, og `switchView` — det fanemenyen kaller — rørte den ikke. Sto du inne i et prosjekt, gjorde et klikk på «Prosjekter» ingenting: visningen var alt `projects`, så du ble tegnet tilbake inn i samme prosjektside. Og gikk du innom «Hjem» først, landet du inne i prosjektet igjen. Det fantes ingen vei til startsiden via fanen. ADR 0034.

- **Fanene nullstiller nå posisjonen i visningen.** Ikke bare «Prosjekter» — en fane er en forespørsel om å komme til starten av en visning, uansett hvilken.
- **`openProject` er nå faktisk den ene døren inn til en prosjektside.** Kommentaren over den har sagt det siden ADR 0018, men seks kallsteder satte tilstanden inline: kortklikk på aktive og arkiverte kort, to typer søketreff, og to wikilink-stier. Funnet av pattern-sveipet i sjekklista.
- **Uendret:** `openProjectId` lagres fortsatt, så laster du siden mens du står i et prosjekt, kommer du tilbake dit. Det var ikke problemet.
- **Regresjonstest med:** kalendervisningene nullstiller fortsatt ankeret til i dag, og «← Tilbake til prosjekter» virker som før.

Testsuiten: 260 → 271 assertions. Fire feiler mot forrige commit.

---

## 2026-08-12 — To Do-lista står på prosjektkortene

Kortet viste før bare én linje: «Neste:» med nærmeste dato. Nå står de tre neste To Do'ene der, tidligste frist først, med «+N mer» hvis det er flere. ADR 0033.

- **Forfalt frist er rød og halvfet** — den ene tilstanden som krever handling. Titler kappes på én linje, og datokolonnen har fast bredde så titlene flukter. Radene har ingen egen handling, så et klikk hvor som helst på kortet åpner prosjektet som før.
- **Taggede To Do's er med.** En fri To Do tagget til et prosjekt (ADR 0016/0017) hører til prosjektet, og lista viser den.
- **Tellerne endrer seg, og det er med vilje.** Kortet regnet før bare på prosjektets egne oppgaver mens prosjektsiden flettet begge kilder, så «1/4 oppgaver» kunne stå på et kort der siden viste seks. Nå bruker kort, side, tellere og fremdriftslinje samme kilde (`projectTasksMerged`). Ingen data er endret — kortet sluttet å underrapportere.
- **«Neste:»-linja vises ikke lenger når den gjentar øverste rad i lista.** Delmål (◆) beholdes, siden de ikke står i To Do-lista.
- **Verifisert visuelt** med skjermbilder i både lyst og mørkt tema, ikke bare i DOM-en. Kort med liste måler 253 px, uten 160 px.
- **Arkiverte kort viser ikke lista.** Verifisert på ekte data: to arkiverte prosjekter fikk røde forfalte frister fra mai og juni — varsel på noe som er bevisst lagt bort. Tellerne står fortsatt der.
- **Gjenstår:** kanban-visningen på prosjektsiden viser fortsatt bare prosjektets egne oppgaver. Det er nå det siste stedet som ikke bruker `projectTasksMerged`.

Testsuiten: 241 → 260 assertions.

---

## 2026-08-11 (sen natt) — De åtte gjenstående punktene, inkludert to som ikke var avveininger

Maria ba om at alt utestående ble tatt. To av de fire «bevisste utsettelsene» viste seg å ikke være avveininger i det hele tatt. ADR 0032.

- **Månedlig gjentakelse var samme feil i den andre kodestien.** `recurringInstanceOnDay` brukte `addMonths`, som snapper til den 1., så en serie fra 31. januar lå på den 1. for alltid. Kommentaren over `addMonthsKeepDay` i samme fil sier rett ut at nettopp dette ble rettet for ICS-serier i ADR 0025 — den manuelle stien ble bare aldri rettet. ADR 0031 kalte det et designvalg; det var en glemt instans av et avgjort mønster. Nå: 31/1 → 28/2 → 31/3 → 30/4. Kalenderen din hadde null manuelle gjentakende hendelser, så ingenting flyttet seg.
- **5-årstaket fantes bare for å bremse en loop som ikke lenger stepper.** En ukentlig hendelse laget i dag sluttet å vises i 2031 uten et ord. Horisonten er nå 25 år, som en navngitt konstant.
- **Outlook-cachen har fått sin egen nøkkel** (`planlegger.outlook.v1`) og er ute av både hovednøkkelen og sky-blobben. Den er enhetslokal — hver enhet henter ICS-feeden selv — så den hørte ikke hjemme noen av stedene. Hovednøkkelen: 652 kB → ~35 kB. Sky-overføring: ~39 MB/time → ~2 MB/time. Migreringen skriver den nye nøkkelen ved første load; pull og sky-gjenoppretting beholder den lokale cachen i stedet for å tømme kalenderen.
- **Pollingen roer seg:** pause når fanen er skjult, umiddelbart pull ved fokus, og dobling 60 s → 8 min når ingenting endrer seg. Før pollet den hvert minutt døgnet rundt, også mens PC-en sto låst.
- **Fullførte oppgaver:** Innstillinger viser nå hvor plassen går (Outlook-cache / oppgaver / prosjekter / dagsnotater), og tilbyr «Rydd bort» når 25 eller flere er fullført — med øyeblikksbilde først, så det kan angres. 82 av dine 108 oppgaver var fullført. Ingen automatisk sletting; det er datatap.
- **ICS-ekspansjonen forkaster før den konverterer.** En gammel daglig serie i feeden lagde ~4200 forekomster og kastet ~3900 — etter å ha tidssone-konvertert hver av dem.
- **Mønster-sveipet i sjekklista fant to FLERE forekomster av `addMonths`-feilen** rett før push: en gjentakende oppgave med frist den 25. hoppet til den 1. neste måned første gang du krysset den av, og ble liggende der. Tredje og fjerde kodesti med samme feil. Ingen av oppgavene dine er gjentakende, så ingenting flyttet seg.
- **De små stille punktene:** mikrofonknappen, mappevalget, det uvoktede `fired`-registeret som kunne kaste hvert minutt, to `.then()` uten `.catch()`, en sluttdato før startdato som ble blanket i stillhet, og «Lagre» som ikke gjorde noe uten tittel.

Testsuiten: 220 → 241 assertions. **15 feiler mot forrige commit**, og en sekstende — det ødelagte `fired`-registeret — **krasjer** den gamle koden, som er selve funnet. Gjentakelses-endringen er verifisert mot en referanse-implementasjon over 154 000 tilfeller.

Underveis innførte og fanget jeg én feil i samme runde: cachen sluttet å bli lagret, fordi den var utenfor sammenligningskroppen og `saveState` dermed leste en Outlook-synk som «ingenting er endret». Testen tok den.

---

## 2026-08-11 (natt) — Revisjon: to feil i gårsdagens fiks, og resten av stillheten

En full gjennomgang etter at ADR 0029 og 0030 var pushet. Den fant **to feil i ADR 0030 sin egen fiks**. Begge reprodusert før de ble ansett som ekte. ADR 0031.

- **Beskjæringen slettet det nyeste øyeblikksbildet.** `_pruneSnapshotsToBudget` hadde ingen bunn: er ett øyeblikksbilde alene større enn 1,5 MB, ble det slettet på første iterasjon — og et eldre, mindre beholdt. `autoBackup` kunne dermed slette backupen den nettopp skrev og deretter stemple `ok: true`. Nyeste øyeblikksbilde står nå alltid, uansett størrelse, og begge stedene sjekker at nøkkelen finnes før de melder suksess.
- **Sorteringen var ikke kronologisk.** Leksikografisk kommer alle `backup.*` før alle `preSync.*` (b < p), så et preSync fra juni rangerte som nyere enn dagsbackupen fra 11. august, og dagsbackupen ble slettet først. Sorteres nå på parset tid. `planlegger.unreadable.*` regnes med i budsjettet — den lå utenfor og kunne okkupere ~650 kB usynlig.
- **Fire skrivesteder for øyeblikksbilder gikk hver sin vei,** og alle fire svelget feilen i en tom `catch` mens koden gikk videre til å erstatte all data. Én dør nå, som beskjærer, teller, sjekker og rapporterer.

Og påminnelsene, som er den samme signaturen tredje gang:

- **`fired`-registeret ble skrevet selv når varselet kastet.** På iPhone kaster `new Notification()` alltid, så hver møte- og fristpåminnelse ble svelget og deretter markert som levert. Nå stemples den bare hvis varselet faktisk kom ut, og Innstillinger viser om varsler er tillatt, blokkert eller umulige i denne nettleseren. Å skru dem på starter intervallet nå i stedet for ved neste sidelasting, og blokkerte varsler lar seg ikke skru på.

Fem andre stille degraderinger fikset: stanset push får egen indikator i stedet for å bli stående grønn · feilet Outlook-synk står i Innstillinger i stedet for bare i en toast som forsvant · en lagring som forkastes fordi posten ble slettet på en annen enhet sier fra · ukjent ICS-tidssone advarer i stedet for å vise møtet seks timer feil uten et ord · «Backup-mappe satt» vises bare når skrivingen er bekreftet.

Ytelse og vekst, målt:

- **Ukesvisningen: 195,6 → 49,0 ms** med langlevde gjentakelser og 627 Outlook-hendelser. `eventsOnDay` ble kalt 112 ganger per tegning (16 timer × 7 dager) der `renderDay` alltid har kalt den én gang; og gjentakelser gikk ett intervall av gangen fra seriens start, så kostnaden vokste med kalendertid og ikke med dataene.
- **`saveState` skrev hele staten på nytt ved hver render** selv når resultatet var byte for byte identisk, og serialiserte den to ganger. Returnerer nå tidlig når ingenting er endret.
- **Innlimte bilder skaleres ned** til maks 1400 px / JPEG 0.85 før de havner i state. Én skjermdump målte state fra 569 kB til 2617 kB av en kvote på ~5000 kB — den ene handlingen som kunne ta hele lagringsplassen på ett klikk.
- **Sju skjemaer kastet en uncaught `TypeError`** hvis dialogen ble lukket innen 50 ms, fordi den utsatte fokuseringen ikke sjekket at feltet fantes. Fanget av en test som traff timingen ved uhell.

Testsuiten: 159 → 206 assertions. 12 av dem feiler mot koden før denne endringen. Gjentakelses-endringen ble differansetestet mot den gamle implementasjonen over 153 600 tilfeller før den ble trodd — og testen avslørte at `addMonths` snapper til den 1., så månedlig gjentakelse er bevisst latt urørt.

---

## 2026-08-11 (kveld) — Lagringsplassen var full, og dagsbackupen hadde vært død i 2,5 måneder

Dette begynte som «gjør ferdig resten av feltlagringen» og endte et annet sted. Målingen som skulle avgjøre om serialiseringen var verdt å optimalisere viste noe verre: localStorage sto på **4951 kB av ~5120 tilgjengelige**.

- **Øyeblikksbildene tok med Outlook-cachen.** `outlookEvents` var 95 % av hver blob — 615 kB per øyeblikksbilde, 8 av dem. De er hentbare med én knapp; å bruke plassen på dem er å bruke den på det minst verdifulle. Øyeblikksbildene er nå ~35 kB, og gjenoppretting beholder kalenderen som står. ADR 0030.
- **Ringene ble beskåret på antall, aldri på bytes.** «5 preSync + 7 backup» var trygt da state var liten, og tillot 7,4 MB etterpå. Nå er det et byte-budsjett på 1,5 MB, sjekket ved boot og etter hver skriving. Frigjør ~3,7 MB ved første kjøring.
- **`autoBackup` svelget feilen** i en tom `catch(_){}`. Kvoten ble full rundt 26. mai, og hver eneste dagsbackup siden har kastet i stillhet. Den nyeste lokale backupen var fra 26. mai. Ingenting sa fra noe sted. Tredje gang på to dager samme signatur: noe slutter å virke, og stillheten er identisk med at det virker.
- **`restoreBackup` skrev øyeblikksbildet før `confirm()`** — å avbryte dialogen kastet det eldste øyeblikksbildet uten å ha gjort noe.

Serialiseringen ble målt og **ikke** endret: 649 kB, 3,7 ms `JSON.stringify`, 12,1 ms per `saveState`, ≈3 % av hovedtråden ved sammenhengende skriving. Å flytte cachen ut av hovednøkkelen ville kuttet det til under 1 ms, men det er en formatendring med migrering. Tallene står i ADR 0030 så avgjørelsen kan tas på nytt uten å måle igjen.

---

## 2026-08-11 (kveld) — `render()` tar ikke lenger fra deg det du skriver

ADR 0023 strupet lagringen som første forsvar mot at en bakgrunns-tegning spiser tekst. Den lot to ting stå, og sa det selv: strupingen mister opptil 400 ms, og markøren hopper til slutten. Begge er borte nå.

- **Fokuserte felt gjenopprettes over en `render()`** — verdi, markørposisjon og fokus. Ett sted, rundt utsendelsen til visningsfunksjonene. ADR 0029.
- **Innebygd tittelredigering lagres av tegningen** i stedet for å forsvinne. Feltet settes inn imperativt og finnes ikke i noen mal, så det kan ikke gjenopprettes — bare lagres først. `Escape` avbryter fortsatt; et pull skal ikke oppføre seg som `Escape`.
- **Et fokusert felt uten `id` sier fra i konsollen,** og testsuiten enumererer hvert tekstfelt i alle sju visningene og feiler hvis noe mangler id. Det var innvendingen ADR 0023 forkastet fiksen på — at glemte felt ser trygge ut — og det er den assertionen som gjør den komplett.
- **`render()` er re-entrans-trygg**, siden en pending commit kaller `render()` på slutten.

Testsuiten: 124 → 159 assertions.

---

## 2026-08-11 — ICS-URL-feltet mister ikke lenger det du limer inn

Outlook-synken hadde stått stille siden 23. mai. To uavhengige årsaker, begge funnet under feilsøkingen:

- **Feltet lagret bare på `blur`.** Esc lukker Innstillinger ved å fjerne feltet fra DOM-en, og fjerning utløser ikke `blur` — så en innlimt URL forsvant stille. «Lukk» og «Oppdater nå» flytter fokus først og lagret riktig, så feltet virket trygt i vanlig bruk. Nå strupet på `input` som resten av feltene, med sammenligning mot gjeldende verdi før lagring. ADR 0023, avsnittet «Etterslep».
- **URL-en var borte både lokalt og i skyen,** så ingen synk kunne gjenopprette den. Den skal peke på Cloudflare-proxyen, ikke på `outlook.office365.com` direkte — Outlook sender ingen CORS-header, så en `fetch` fra nettleseren blir blokkert uansett hvor riktig URL-en er. Ingen kodeendring; verdt å skrive ned fordi feilmeldingen («Failed to fetch») ikke sier det.

Etter at proxy-URL-en var satt: 627 hendelser hentet, mot 555 fra mai.

---

## 2026-08-10 (natt) — TZID og sommertid: Outlook-tider er riktige nå

Helsesjekken parkerte disse to eksplisitt i påvente av Graph-avgjørelsen. Maria avgjorde den samme dag — tilgangen kommer ikke — så de var ikke parkert lenger, bare ufikset. ADR 0028.

- **TZID ble ignorert.** `parseICSDate` fikk bare verdien til høyre for kolon; TZID står i parameterlista på venstre side (`DTSTART;TZID="Eastern Standard Time":20260115T140000`), og den siden ble kastet. Et møte satt opp fra New York ble vist 14:00 i stedet for 20:00. TZID leses nå av, mappes fra Windows-sonenavn til IANA (~53 soner), og tiden konverteres. Ukjent sonenavn degraderer til flytende tid — altså presis oppførselen vi hadde før, ingenting blir verre.
- **Sommertid arvet basetidens klokke.** `expandRRule` kopierte `{...baseEv}` per forekomst, og `baseEv.start` var en ferdig konvertert lokal streng. En ukentlig 07:00Z-serie fra 12. oktober ble 09:00 hele veien — riktig til 19. oktober, **én time feil fra 26. oktober og resten av serien**. Feilen dukket opp av seg selv ved tidsomstillingen, uten at noe ble endret. Hver forekomst konverteres nå på sin egen dato.
- **En tredje feil som fulgte av de to, som ingen hadde beskrevet:** forekomst-datoene ble regnet ut fra basehendelsens *lokale* dato. Et 07:00-møte hver tirsdag i Tokyo er mandag kveld i Oslo, så `BYDAY=TU` mot en lokal mandag traff ikke. Serier enumereres nå på **kilde-kalenderen** og konverteres etterpå.
- **Sluttiden utledes fra varighet i minutter** i stedet for å kopiere en klokkestreng, så en forekomst som ligger på hver side av en omstilling får riktig lengde.
- **Ingen nytt bibliotek og ingen byggesteg.** `Intl.DateTimeFormat` med `timeZone` har hele sonedatabasen innebygd og oppdateres med nettleseren. Veien fra veggklokke i en sone til øyeblikk trenger to pass, fordi offseten man trenger avhenger av øyeblikket man leter etter — det andre passet er det som gjør timene rundt en omstilling riktige.
- **Nye tester, permanent lagret:** `tests/ics.mjs` (61 assertions) og `tests/run.mjs` (118) ligger nå i prosjektmappa i stedet for å bli bygget på nytt hver økt. ICS-suiten **nekter å kjøre uten `TZ=Europe/Oslo`** — parserens utdata avhenger per design av nettleserens sone, så en kjøring i UTC ville passert tomt og bevist ingenting.
  - Skarpeste testen: en ukentlig 09:00-avtale fra New York, gjennom begge omstillingene. 19. okt → 15:00, 26. okt → **14:00** (EU har byttet, USA ikke — differansen er 5 timer den uka), 2. nov → 15:00 igjen. Den ville feilet på alle tre måter feilen kunne feile.
  - Pluss: Tokyo-serie som lander 00:00 lokalt på riktige datoer, møte som krysser midnatt lokalt, `DURATION` uten `DTEND`, flerdags gjentakende, EXDATE og UNTIL med kilde-datoer, ukjent TZID, heldags uberørt, og seks regresjonstester for det helsesjekken fikset (MONTHLY-klamring, BYDAY, 2016-serie uten COUNT, VALARM, manglende SUMMARY, CANCELLED).
- **Fortsatt ikke støttet:** `RECURRENCE-ID`-overstyringer. Flytter du én forekomst i en serie i Outlook, viser planleggeren den på opprinnelig tid. Det er nå den største gjenstående ICS-mangelen (ADR 0025 står ved lag på det punktet).
- **Verifisert:** `node -c` grønn · 91 unike HANDLERS, 0 duplikater · 0 bare-HANDLERS-kall · 0 `data-action`/`act()` uten handler · 0 døde handlere · 0 NUL-/CR-bytes · hovedsuiten 118/118 i **både** UTC og Europe/Oslo · ICS-suiten 61/61 i Europe/Oslo.

## 2026-08-10 (sen kveld) — Wikilink-autocomplete + flerdagsbar over uke-skillet + strukturgjennomgang

Bygget oppå helsesjekken nedenfor. ADR-numrene her er 0026/0027 fordi 0021–0025 alt var brukt — se prosessnoten nederst i innslaget.

- **«[[» foreslår nå prosjekter (ADR 0026).** Wikilinks fra tidligere i dag krevde at du skrev tittelen helt riktig; «Investering: Piscada Aqua AS» treffer man ikke på første forsøk. Skriver du `[[` i edit-modus, kommer en liste over prosjekttitler som filtreres mens du skriver. ↓/↑ flytter, Enter/Tab setter inn, Escape lukker lista — Escape kaller `stopPropagation()`, ellers ville den dokument-nivå Escape-lytteren lukket hele notatet i samme trykk. Arkiverte prosjekter foreslås ikke, prefiks-treff sorteres først, maks 8 rader, æøå sorteres med `localeCompare(…, 'nb')`.
  - Setter inn **kildeformatet** `[[Tittel]]`, aldri anker-markup — samme invariant som ADR 0019, ellers slutter bakoverlenkene å virke.
  - Enter fanges bare når det finnes treff, så linjeskift midt i «[[noe som ikke finnes» virker fortsatt.
  - Innsetting via `Range` istedenfor `execCommand`: forutsigbart resultat, men Ctrl+Z kan angre i større biter.
  - Posisjoneringen faller tilbake `getClientRects()` → `getBoundingClientRect()` → `0,0`. Uten fallback-kjeden kaster den i miljøer uten `Range.getClientRects` — fanget av røyk-testen, ikke av en bruker.
- **Flerdagsbar over uke-skillet (ADR 0027, amender 0014).** ADR 0014 listet «baren brytes ved uke-grensen» som kjent svakhet og reserverte et overlay-lag som kur. Problemet var et annet enn beskrevet: fortsettelsesceller rendrer `&nbsp;` fordi tittelen står til venstre i baren — men på en ny uke-rad står det ingenting til venstre, så en hendelse over to uker ga **en navnløs grå stripe** øverst i neste rad. I tillegg hang baren `-9px` forbi radkanten og ble klippet av grid-kanten.
  - Hvert uke-rad-segment får nå sin egen etikett: mandags-segmentet re-merkes med `↳ Tittel` og får tilbake avrundet venstrekant og kategorifarge; søndags-segmentet ender flush på radkanten med en `›` som betyr «fortsetter neste uke». Celler midt i en rad er uendret.
  - **Overlay-laget er nå formelt forkastet, ikke utsatt.** Et rektangel kan ikke omslutte slutten av én rad og starten av den neste — uansett teknikk. Enhver løsning gir ett segment per rad, så overlay-et ville byttet ut hvordan segmentene tegnes *innenfor* en rad, der margin-bleed alt virker, uten å løse kryssingen. ~30 linjer istedenfor et andre rendringspass med resize-lyttere.
- **Strukturgjennomgang (`docs/architecture-review-2026-08-10-structure.md`).** Komplement til helsesjekken: den så etter korrekthetsfeil, denne etter struktur- og dokumentasjonsdrift. Ingen tier-1-funn. Ett funn verdt å vite om:
  - **`state.notes` — dagsnotatene — har aldri stått i `CONTEXT.md`.** En hel datamodell-bøtte som er fullt levende: leses og skrives i Dag-visningen, søkes i, og skannes av `findBacklinks` slik at **et dagsnotat kan bakoverlenke til et prosjekt**. Helsesjekkens funn 7 fant at views-tabellen og linjetallene i samme dokument var utdaterte; dette er en utelatelse, som er verre — leser du dokumentet for å forstå datamodellen, er det ingenting som antyder at noe mangler. Nå dokumentert med termen **Dagsnotat**.
  - **Åtte felt i `DEFAULT_STATE` har null referanser** (`goals`, `habits`, `themes`, `quarterly`, `yearFocus`, `quarterFocus`, `monthFocus`, `reviews`). Anbefalt fjernet med `version: 5` + migrering, **ikke gjort nå** — det rører `loadState`, som ADR 0022 endret for noen timer siden, og det fortjener egen runde med egne migreringstester.
- **Prosessfunn — to økter skrev på samme filer.** Denne økta fortsatte fra et 12:39-øyeblikksbilde og skrev over helsesjekkens `app.js`, `index.html`, `CHANGELOG.md`, `CONTEXT.md` og ADR-indeksen, og ga sine nye ADR-er numrene 0021/0022 som alt var tatt. Gjenopprettet fra git (`8156324`) og fra `backups/*.pre-autocomplete` (bit-identiske). `CONTEXT.md` pushes ikke og fantes ikke i git — den ble rekonstruert fra helsesjekk-rapportens funn 7, som sier eksakt hva som var endret der. Årsak: skrivingen droppet `expectedMtimeMs`-vakten. Regler skrevet ned i gjennomgangens siste seksjon.
- **Verifisert:** `node -c` grønn · 91 unike HANDLERS (91 linjer, 0 duplikater) · 0 bare-HANDLERS-kall · 0 `data-action`/`act()` uten handler · 0 døde handlere · 0 NUL-bytes · 0 CR-bytes. jsdom **118/118** — nye seksjoner dekker at autocomplete åpner og filtrerer, at arkiverte prosjekter utelates, at ↓ og Enter fanges mens Enter *uten* treff ikke gjør det, at Escape lukker lista men ikke modalen, at innsatt tekst lagres i rå form, at view-modus ikke trigger lista, og at alle fire dagene i en søndag→mandag-run får riktige klasser og etiketter mens en endagshendelse får ingen.

## 2026-08-10 (kveld) — Helsesjekk: 6 kritiske + 12 andre funn fikset i én runde

Full helsesjekk av hele appen (rapport i `docs/health-check-2026-08-10.md`, lokal). 26 funn, hvert verifisert med kjørbar test før det ble rapportert. Alt lokalt løsbart er fikset her; TZID og sommertid er bevisst parkert til Graph-avgjørelsen (ADR 0025).

### Kritisk

- **Notat-saniteringen slettet vanlig norsk tekst (ADR 0021).** `/\son[a-z]+\s*=\s*[^\s>]+/gi` kjørte over hele notat-HTML-en, brødtekst inkludert. «Prøvemiddag onsdag = 18:00 hos Anne» ble «Prøvemiddag hos Anne»; «Status online = ja» spiste også `</p>`. Og fordi editoren skriver den saniterte DOM-en tilbake, ble det permanent ved neste åpne-og-lukk *uten at du skrev noe*. Attributt-rensingen skjer nå per tag, så tekstnoder røres ikke.
- **ICS/RRULE: seks feil som viste gale datoer stille (ADR 0025).**
  - MONTHLY kollapset til den 1. i måneden — `addMonths` snapper til den 1. med vilje (for navigasjon) og ble gjenbrukt i ekspansjonen. Ny `addMonthsKeepDay` med klamping.
  - Gamle serier forsvant helt: COUNT defaultet til 500 og telleren økte også for forekomster *før* visningsvinduet, så budsjettet ble brukt opp i fortiden. Et ukesmøte fra 2016 ga **0 hendelser**; nå gir det 157. Uten COUNT er det ingen forekomst-grense lenger.
  - `BYDAY` ble parset men ikke brukt: `MO,WE,FR` ga ni mandager på rad. Nå støttet for WEEKLY og for MONTHLY med ordinal (`-1FR` = siste fredag).
  - `EXDATE` ble ikke parset — avlyste enkeltmøter sto der for alltid. Nå ekskludert (matchet på dato).
  - `VALARM`-blokkens `DESCRIPTION` («REMINDER») overskrev hendelsens egen, så Teams-lenka forsvant. Alarm-blokker hoppes nå over.
  - Hendelser uten `SUMMARY` ble forkastet stille; vises nå som «(uten tittel)». `DURATION` brukes når `DTEND` mangler.
  - Forekomster beregnes nå fra DTSTART hver gang, ikke iterativt, så ingen avrunding akkumulerer.
- **`loadState` var alt-eller-ingenting (ADR 0022).** Én feiltypet bøtte (`tasks:{}`) kastet, catch-en returnerte tom default, og `render()`s `saveState()` skrev den over originalen innen ett sekund. Bøtte-typer normaliseres nå *før* migreringene, en uleselig blob kopieres til `planlegger.unreadable.<tid>` før defaults returneres, og `meta.version` stemples faktisk (den ble aldri skrevet tilbake).
- **`saveState` hadde ingen kvote-håndtering (ADR 0022).** `localStorage.setItem` sto uten try/catch, så en full kvote mistet hele sesjonens redigeringer mens UI-et så lagret ut. Nå: fang → rydd gamle preSync/backup-nøkler → prøv igjen → varsle én gang. Pluss en global feilflate (`error` + `unhandledrejection`), siden alt som kastes fra en `setTimeout` tidligere forsvant i konsollen.
- **Dag-visningens notat-tekst forsvant ved bakgrunns-oppdatering (ADR 0023).** Feltet lagret bare på `blur`, og å fjerne et fokusert element fra DOM-en utløser ikke `blur` — så et 60-sekunders sync-poll som kalte `render()` tok avsnittet. Lagrer nå på `input`, strupet (ikke debounce'et: en debounce som restarter på hvert tastetrykk commiter aldri mens man skriver sammenhengende — notat-editoren hadde nøyaktig det mønsteret).
- **`importData` reverterte seg selv og byttet sync-credentials (ADR 0022).** Ingen formvalidering (en `package.json` passerte), ingen `meta.lastModified` (så pollen erstattet det importerte etter 60 sekunder), ingen øyeblikksbilde, og filens `sync`-blokk overskrev enhetens egen. Alle fire fikset; importen viser nå hva den fant («12 projects, 40 tasks») før den overskriver.

### Bør fikses

- **Uke-visningen: klikk på en hendelse åpnet en tom «Ny hendelse».** `${click}` ble interpolert som et bart attributt — DOM-en fikk et søppel-attributt med navnet `handlers.editevent('id')` — og klikket falt gjennom til `.slot`-lytteren. Bruker nå `act()` som Dag og Måned.
- **List-visningen fjernet (ADR 0024).** 83 linjer som ikke kunne åpnes: ingen nav-knapp, ingen «Mer»-oppføring, ingen `I18N`-etikett, ingen kaller. Prosjekt-tag-fiksen 2026-06-09 ble gjort i en visning ingen kunne se. Med kaskaden (`monthMiniHTML`, `buildDashboardHTML`, `projectsOverlapping`, `setupImagePaste`, `tasksUndated`, `holidayFor`, `quarterKey`, `quarterOf`) er 243 linjer borte, pluss 4 ubrukte CSS-regler.
- **Søkets kategorifilter tilbød døde kategorier.** `personlig`, `helse`, `reise` — avskaffet 26. mai, ga alltid 0 treff — og manglet **Privat** helt. Nå Jobb/Privat. Søkemotoren var riktig hele veien.
- **Nytt notat vistes ikke før noe annet rendret.** `addProjectNote` kalte ikke `render()`, og ingen av modalens utveier gjorde det. Ny `_onModalClose`-krok som notat-editoren registrerer, så kortet oppdateres når du lukker.
- **Wikilink-klikk i notat-editoren gjorde to gale ting** (regresjon fra samme dag): flippet notatet til edit-modus *og* lot modalen stå oppå prosjektet som ble åpnet bak. Editorens click-lytter fyrer før dispatcheren, så `data-stop="1"` kom for sent — sjekken ligger nå i lytteren, og `resolveWikilink` lukker modalen.
- **Rad-`×` slettet uten bekreftelse** for oppgaver, delmål, personer og lenker — mens de samme operasjonene fra modal og sveip bekreftet. Alle fire spør nå, med navnet på det som slettes.
- **Empty-state-guarden telte `outlookEvents`**, så en fersk enhet med bare ICS-data kunne pushe tomme prosjekter over god sky-data. Teller nå bare prosjekter, oppgaver og hendelser, som pull-siden.
- **`importICSFile` erstattet hele Outlook-kalenderen** og stemplet `lastSync`, som blokkerte auto-resync i en time. Spør nå, og rører ikke `lastSync`.
- **Sync-feil var usynlige (ADR 0023).** Outlook auto-sync forkastet alle feil; `loadCloudBackups` returnerte `[]` både ved 401 og nettverksfeil, så et utløpt token ble vist som «Ingen sky-backups enda»; og push/pull delte statusindikator, så en vellykket pull malte over en mislykket push. Alle tre skilt fra hverandre; indikatoren blir rød til opplastingen faktisk lykkes.
- **`autoWeeklyExport` stemplet suksess den ikke kunne bekrefte (ADR 0023).** `lastWeeklyExport` ble satt rett etter `a.click()`, som ikke sier noe om at noe ble skrevet — på iPhone havner filen ingen steder. Stempler nå bare i grenen som venter på `writable.close()`. Og `requestPermission()` kalles ikke lenger under boot uten brukeraktivering, som var grunnen til at mappevalget stille degraderte til Downloads ved hver nettleser-omstart.
- **`restoreBackup` tar øyeblikksbilde** før gjenoppretting, slik `restoreCloudBackup` alltid har gjort.
- **Tomme lokale credentials overskrev gode fra skyen** — funnet under live-verifiseringen etter pushen. `pullFromRemote` og `restoreCloudBackup` kopierte `syncUrl`/`syncToken`/`icsUrl` fra lokal state ubetinget, så en **tom** lokal verdi vant over en god fra skyen. Derfor var `icsUrl` tom i PC-nettleseren og Outlook-hendelsene frosne siden 23. mai: enheten kunne aldri lære URL-en fra skyen. Kopierer nå bare verdier som faktisk finnes lokalt.

### Hygiene

Duplisert `HANDLERS.openTaskForm`-linje fjernet · FIRST RUN-stubben fjernet (seedet ingenting, refererte funksjoner slettet i mai) · README rettet: den påsto fortsatt «Single HTML file, JavaScript inline, no build step», usant siden ADR 0013 · CONTEXT.md linjetall og views-tabell oppdatert · LES-MEG oppdatert med wikilinks, rullerende vindu og riktig backup-ordlyd.

### Verifisert

`node -c` grønn · **91 HANDLERS** · 0 bare-HANDLERS-kall · 0 `data-action` uten handler · 0 døde handlere · 0 definerte-men-ukalte funksjoner · 0 ubrukte CSS-klasser · 0 NUL-bytes · 0 CRLF · **app.js 5 222 → 4 979 linjer**. jsdom: **80/80** i hovedsuiten, pluss 24 + 12 målrettede regresjonstester der hvert enkelt funn ble utløst før fiksen og ikke lenger reproduserer. 13 modaler åpner rent, 7 visninger × 3 filtre, tomt state, alle tre temaer, søk med alle kategorifiltre.

## 2026-08-10 (senere på dagen) — Wikilinks virker begge veier + datatapsfeil på innlimte bilder stengt

Fire funn fra en helsesjekk av notat-kodestien, fikset i samme runde.

- **Wikilinks var halvferdige (ADR 0019).** `.wikilink`-CSS, `HANDLERS.openWikilink`, `HANDLERS.resolveWikilink` og «Referert i»-seksjonen fantes alle — men *ingenting* rendret `[[Prosjekttittel]]` som klikkbar lenke. Bakoverlenker virket (de leser rå tekst), foroverlenker ikke. Skrev du `[[Meox AS]]` i et notat, så du bare rå klammer. Årsak: `renderMarkdown` ble slettet som død kode 2026-05-27, og den var det eneste stedet som lagde anker-markup.
  - Ny `renderWikilinks(html)` kjører etter `sanitizeNoteHTML` og lager `<a class="wikilink" data-action="openWikilink" data-target="…">`. Ukjent prosjekt får `wikilink-broken` men beholder `data-target`, slik at klikk gir «Fant ikke prosjekt …»-toast i stedet for stille ingenting.
  - Notat-editoren rendrer lenker i **view**-modus og viser rå `[[...]]` i **edit**-modus, så de kan endres. `setMode` skriver `editor.innerHTML` på nytt ved hvert modusbytte.
  - Ny `unrenderWikilinks(html)` + ny `saveNow()` som bare leser editoren i edit-modus: to uavhengige barrierer mot at anker-markup havner i lagret innhold. `[[Tittel]]` blir værende kildeformatet, så `findBacklinks` fortsetter å virke og eksportert JSON er app-uavhengig.
- **Innlimte bilder i notater ble slettet permanent (ADR 0020).** `sanitizeNoteHTML` nøytraliserte *alle* `data:`-URL-er, mens lim-inn-håndtereren lagrer skjermbilder som `data:image/png;base64,…`. Kjeden: lim inn → bildet vises og lagres riktig → åpne notatet igjen → sanitizeren gjør det til `src="#"` → autolagring skriver `src="#"` tilbake → bildet er borte for godt. Har ligget der siden 2026-05-27.
  - Ny `_noteUrlIsSafe(url)`-whitelist: `data:image/(png|jpe?g|gif|webp|bmp|avif);base64` slippes gjennom, `data:image/svg+xml` blokkeres bevisst (kan bære script), alt annet `data:` blokkeres. Strengere enn før på to punkter: entitet-kodet `java&#115;cript:` blokkeres nå (slapp gjennom den gamle blacklisten), og `vbscript:` også.
  - **NB:** notater der bildet alt er blitt `src="#"` er ikke reparerbare fra koden — innholdet er overskrevet. Se `backups/` hvis et bestemt notat mangler et bilde.
- **`index.html` hadde 305 NUL-bytes etter `</html>`** — halen av en OneDrive-skriving 2026-05-27 som ble padda. Harmløst i nettleser, men det er korrupsjons-signaturen vi har advart mot, og den lå i repoet. Filen er trunkert etter `</html>` (73 109 → 72 804 bytes). NUL-byte-sjekk lagt inn i pre-push-sjekklisten.
- **Død kode + inline JS:** `HANDLERS.saveProjectNote` slettet (erstattet av autolagring i juni, aldri kalt), alias-linja `HANDLERS.openEventForm = openEventForm` slettet (funksjonen består). De to `onchange="if(this.value){document.execCommand(…)}"`-uttrykkene i notat-verktøylinja er nå `HANDLERS.noteTextColor(this)` / `HANDLERS.noteHighlight(this)` per ADR 0012.
- **Verifisert:** `node -c` grønn, 91 HANDLERS, 0 bare-HANDLERS-kall, 0 `data-action` uten handler, 0 døde handlere, 0 NUL-bytes i begge filer. jsdom-suite **81/81 grønn** — inkludert round-trip `unrender(render(x)) === x`, at lagret innhold aldri inneholder `class="wikilink`, at `blur` i view-modus ikke forurenser lagret innhold, at `data:image/png` bevares mens `data:text/html` og entitet-kodet `javascript:` blokkeres, at innlimt bilde overlever en åpne-lukke-runde, og at alle 8 visninger + ADR-0018-hjelperne er uendret grønne.
- **Doc-sync i samme change-set:** ADR 0019 (wikilink-render-beslutningen), ADR 0020 (URL-whitelisten), ADR-indeks, CONTEXT.md (wikilink-vokabular + notat-lagringsregelen), `test.html` seksjon 13.

## 2026-08-10 (tidligere) — `renderHome` splittet i seksjons-helpere

- **Refactor (ikke bug):** `renderHome` var 226 linjer og gjorde alt — data-samling, HTML-generering for alle 5 seksjoner, DOM-innsetting, quick-capture-listener, og urgent-drag-reorder-wiring. Vanskelig å endre én seksjon uten å skanne hele funksjonen. Splittet i seks små hjelpere i samme fil, hver med tydelig ansvar:
  - `_homeUrgentHTML(urgent, todayK)` — Urgent-seksjonen
  - `_homeTodayTasksHTML(todayTasks, todayK)` — «Forfaller i dag»-seksjonen
  - `_homeWeekHTML(today)` — «Kalender denne uka»-seksjonen (7-kolonne uke-grid)
  - `_homeActiveProjectsHTML(activeProjects)` — «Aktive prosjekter» (returnerer tom streng når listen er tom)
  - `_homeQuickCaptureHTML()` — quick-capture-input + Dumpefelt-knapp
  - `_wireUrgentDragReorder()` — post-render event-wiring for drag-sortering på Urgent-lista
- `renderHome` selv er nå ~55 linjer: gjør bare data-forberedelse (`activeProjects`/`urgent`/`todayTasks`), setter greeting, komponerer HTML fra hjelperne, og kaller quick-capture-listener + `_wireUrgentDragReorder()` etterpå. Ingen adferdsendring — kun leselighet.
- Verifisert med `node -c` + jsdom smoke-test at alle 7 nye/eksisterende funksjonene er definert, at `_homeQuickCaptureHTML` returnerer forventet HTML, at `_homeUrgentHTML([])` gir «Ingen urgent» tom-state, og at `_homeActiveProjectsHTML([])` returnerer tom streng slik at seksjonen skjules når det ikke er noe.
- **Doc-sync i samme change-set:** ADR 0018 skrevet for å låse inn seksjons-helper-mønsteret som strukturelt valg (ikke bare et engangs-triks) — anvendes på `renderProject`/`renderTodos`/`renderWeek`/`renderMonth` når de trenger neste endring. ADR-indeks (`docs/adr/0000-index.md`) oppdatert. CONTEXT.md fikk kort note om at underscore-prefiks-hjelpere er interne til én render-funksjon.
- **Test-utvidelse:** `test.html` fikk ny seksjon 12 (`Hjem-seksjons-hjelpere — ADR 0018`) — asserer at hver av de 6 hjelperne er definert, kaller dem direkte med syntetisk input for å verifisere tomtilstand-kontraktene (`_homeActiveProjectsHTML([]) === ''`, `_homeUrgentHTML([]).includes('Ingen urgent')`, osv.), og verifiserer at `renderHome` integrerer alle hjelperne i DOM-en (`.home-greeting`, `.home-section`, `.home-quick`, `.hjem-week`). Fanger regresjon hvis noen fjerner en hjelper eller endrer signaturen.

## 2026-06-09 — Prosjekt-siden viser nå tagget-frie-tasks under Oppgaver

- **Bug Maria rapporterte:** Når en To Do fikk prosjekt-tag i To Do's-visningen, dukket den ikke opp under «Oppgaver»-seksjonen på prosjektsiden. Kun `p.tasks` (prosjekt-egne subtasks laget med «+ Ny» på prosjektsiden) ble vist. Prosjektet ble halvsynlig — man måtte hoppe tilbake til To Do's for å se hva som var tagget.
- **Fix:** `renderProjectTasks(p)` merger nå to kilder: `p.tasks` (prosjekt-subtasks) og `state.tasks.filter(t => t.projectId === p.id)` (taggede frie tasks). Hver rad rendres med korrekte HANDLERS basert på origin — subtasks bruker `toggleProjectTask`/`openProjectTaskForm`/`deleteProjectTask` som før, frie tasks bruker `toggleTask`/`openTaskForm`/`deleteFreeTask` slik at avkrysning/redigering/sletting går mot rett datastore. Frie tasks er ikke draggable innenfor prosjekt-visningen (rekkefølgen deres tilhører prioritetsbøttene på To Do's-siden).
- Verifisert med 29-tests jsdom-suite: prosjekt-side rendrer alle tre rader (1 subtask + 2 taggede), urelatert fri task ikke synlig, riktige handlere per origin, avkrysning muterer riktig datastore (state.tasks vs p.tasks), tom-tilstand vises kun når begge kilder er tomme, tagget task alene fyller ellers-tomt prosjekt. Alle tidligere HANDLERS intakte.

## 2026-06-09 — Bug-klasse: 5 stille ReferenceError-bugs fikset på én gang

- **Bug Maria rapporterte:** klikk på «+ Nytt notat» gjorde ingenting — notatet ble lagret, men modalen åpnet ikke. Kun etter refresh dukket det opp som en tom rad.
- **Root cause:** `HANDLERS.addProjectNote` kalte `openNoteEditor(pid, n.id)` uten `HANDLERS.`-prefiks. `openNoteEditor` er kun definert på `HANDLERS`, så bare-kallet kastet `ReferenceError: openNoteEditor is not defined`. Den sentrale klikk-lytterens try/catch slukte feilen — modalen åpnet aldri, men noten ble lagret før kastet.
- **Audit + 4 til:** En statisk gjennomgang av samme mønster fant 4 andre bare-HANDLERS-kall som ville ha blitt utløst av kantete brukerhandlinger: swipe-høyre på inbox (`inboxToTodo`), swipe-venstre slett (`deleteFreeTask`, `deleteInbox`), drag-og-slipp av oppgave til prioritetsbøtte (`setTaskPriority`, `inboxToTodo`). Alle fikset i samme commit.
- **Audit-skriptet** lagret som memory (`feedback_planner_handlers_audit.md`) og lagt inn som steg 1.5 i pre-push-sjekklisten. Fanger denne bug-klassen statisk på fremtidige pusher.
- Verifisert med 24-tests jsdom-suite: faktisk `button.click()` på «+ Nytt notat» åpner modalen og legger til notatet, alle 5 navn har 0 bare-kall igjen, alle 5 HANDLERS fortsatt funksjonelle, alle 8 visninger grønne, ingen console-errors under runden.

## 2026-06-09 — Modaler lukker ikke lenger ved utilsiktet drag-out

- **Bug:** Når du markerte tekst i et notat eller skjema-input og slapp musen utenfor modalen (på den mørke bakgrunnen), lukket modalen seg uventet. `click`-eventets target er felles forfedre av mousedown og mouseup — så hvis mousedown var inne i modalen og mouseup på bakgrunnen, ble click-eventet registrert på `modalBg` og lukkemekanismen utløst. Rapportert av Maria (notat-editoren på prosjektsiden).
- **Fix:** Modal-bakgrunnen sporer nå om mousedown faktisk skjedde på den (`_modalMouseDownOnBg`). Modal lukkes kun hvis BÅDE mousedown og click skjedde på bakgrunnen. Tekstmarkering med utenfor-drop blir derfor ignorert. Esc-tasten og «Lukk»-knappen fungerer som før.
- Verifisert med 16-tests jsdom-suite: modal forblir åpen ved drag-out (mousedown på content → click på bg), modal lukkes ved ekte bg-klikk (mousedown + click begge på bg), Escape og Lukk-knappen fortsatt funksjonelle, alle 8 visninger grønne.

## 2026-06-09 — Prosjekt-tag synes nå overalt (ikke bare i To Do's-visningen)

- **Bug:** Forrige commit (`0a3a419`) la prosjekt-tag-rendring kun til `todoRowHTML` (To Do's-visningen). Hjem-visningens Urgent-panel, Hjem-visningens «Forfaller i dag», iPhone-Dag-dashboard, og List-visning brukte andre render-paths som ikke kjente til `t.projectId`. Maria rapporterte at hun ikke så prosjekt-tag på Urgent-panelet på Hjem-siden selv etter hard-reload — det var fordi tag-en aldri ble rendret der.
- **Fix:** Fire steder oppdatert til å rendre prosjekt-tag fra `t.projectId`-oppslag: Hjem Urgent (linje ~1025), iPhone Dag-dashboard urgent (linje ~2844), List-visning fri-task-rad (linje ~3000). Pluss en sentral utvidelse: `tasksOnDay()` setter nå `_projectTitle` på frie tasks med `projectId`, ikke bare på prosjekt-subtasks. Det gjør at alle eksisterende render-paths som allerede håndterer `_projectTitle` (kalender-visninger Uke/Måned, Hjem «Forfaller i dag») nå viser tag-en for frie tasks med prosjekt-tilknytning også.
- Verifisert med 22-tests jsdom-suite: Hjem Urgent viser tag på tagget task, ikke på utagget; `tasksOnDay` setter `_projectTitle` på fri-task med `projectId`; Forfaller-i-dag og List-visning inneholder prosjekt-tittel; alle 8 visninger fortsatt grønne.

## 2026-06-08 — Bugfix: topbar nav resetter nå faktisk anker + kategori-toggle på inbox

- **Bugfix:** Topbar-knappene `Dag`/`Uke`/`Måned`/`Årsoversikt` bypasset `HANDLERS.switchView` og satte `state.ui.view` direkte i sin egen `onclick`. Reset-til-i-dag-logikken fra forrige commit ble derfor aldri kjørt for de faktiske UI-klikkene. Topbar-nav (linje 950 + 956) kaller nå `HANDLERS.switchView(b.dataset.view)`. Smoke-testen er utvidet til å gjøre faktiske `button.click()`-kall istedenfor å invokere handleren direkte.
- **Kategori-toggle (●) på inbox-rader** — samme knapp som på vanlige To Do's. `HANDLERS.toggleInboxCategory` flipper mellom 'arbeid' og 'privat'. `inboxToTodo` bevarer nå kategorien.

## 2026-06-08 — Inbox-rediger + kalender-anker-reset + plassholder-rydding + tag-til-prosjekt-uten-å-flytte

- **Pennknapp (✎) på inbox-rader** — innboks-elementer kunne kun redigeres ved dobbeltklikk på tittelen.
- **Kalender-visninger åpner alltid på i dag** — `HANDLERS.switchView` sjekker mot ny `CALENDAR_VIEWS`-konstant og resetter anker. **NB: var ikke koblet inn på topbar-knappene — se neste entry.**
- **Plassholdertekst «dump alt som dukker opp» fjernet**.
- **«Til prosjekt» tagger nå, flytter ikke** — `HANDLERS.taskToProject` setter `t.projectId` istedenfor å flytte tasken inn i `project.tasks`. Render-laget viser «· prosjekt-tittel»-tag.

## 2026-06-08 — Delmål kan nå redigeres etter opprettelse

- **`openProjectMilestoneForm` modal lagt til** — klikk på et delmåls tittel eller dato åpner modal med Tittel/Dato/Ferdig + Lagre/Avbryt/Slett.
- Verifisert med 32-tests jsdom-suite.

## 2026-05-27 — Kategori-toggle på To Do-rad + tooltip-fiks

- **Ny `●`-knapp på hver To Do-rad** — vippe mellom Jobb ↔ Privat.
- **Tooltip-fiks** — `○`-knappens tooltip rettet fra «Fjern kategori» til «Fjern prioritet».

## 2026-05-27 — Lukk-knappen i Settings (og 10 andre modaler) fungerer igjen

- **`HANDLERS.closeModal` lagt til** — `closeModal()` eksisterte bare som modul-lokal funksjon. Krysset av alle 52 unike data-action-verdier.

## 2026-05-27 — Flerdagsbar + state.settings-opprydding

- **Flerdagshendelser tegnes som sammenhengende bar i månedsvisning**.
- **`state.settings` ryddet bort permanent** — `loadState` stripper nå alltid `merged.settings`.
- **Helligdager til og med 2040 verifisert** — via Easter-computus.

## 2026-05-27 — Kvalitetskontroll runde 2: 4 bugs til

- **Sync-credentials bevart riktig etter pull/restore**.
- **5 race-condition-kasts fjernet** — defensive `if (!p) return;`.
- **`renderMarkdown` slettet** (38 linjer død funksjon).
- **Notat-innhold sanitiseres ved rendering** — ny `sanitizeNoteHTML`.

## 2026-05-27 — Kvalitetskontroll: 39 inline-handler-bugs + 3 oppryddinger

- **39 ubeskyttede inline-kall fikset**.
- **`importData` migrerer nå riktig**.
- **"Personer"-seksjon koblet inn på prosjektsiden**.
- **Død kode slettet** (~100 linjer).

## 2026-05-26 — Dyp opprydding (10-årshorisont)

- **state.settings splittet** i `state.ui` + `state.sync`. Meta-versjon 4.
- **Inline JS-uttrykk eliminert** — `onclick="..."` → `data-action="..."`.
- **Inline styles → CSS-klasser** — 51 av 144 promotert.

## 2026-05-26 — Oppryddings-økt

- **App.js skilt ut fra index.html**. Supersede av ADR 0001.
- **«Oppdater nå» for Outlook**.
- **`CHANGELOG.md` opprettet** — denne filen.
- **Backup-mappen ryddet**.

## 2026-05-26 (tidligere på dagen)

- **`importData`-bugen fikset** (`65bb344`).
- **Automatisk ukentlig JSON-backup til valgt mappe** (`f6acfc0`).
- **Personvern: fjernet personlige referanser fra kildekoden** (`719c620`).
- **Event delegation refactor** (`1cb1a28`). Se ADR 0012.
- **Fokus-visningen fjernet** (`cb2f974`). ADR 0011 superseder ADR 0008.

## 2026-05-24

- **`strategy` → `fokus` rename** (`58099dd`).
- **GitHub Pages tatt i bruk** (`64cb7a4`). ADR 0010 superseder ADR 0009.

## 2026-05-23

- **Arkitekturgjennomgang utført**.
- **Reorder-helpers konsolidert**.
- **`renderProjectPage` splittet i 8 seksjons-helpers**.
- **CONTEXT.md opprettet** + ADR-er 0001–0009 backfilled.
- **Matt Pocock-prinsipper tatt i bruk**.

## Pre-2026-05-23 (tidligere)

Planleggeren ble bygget over flere økter. ADR-ene 0001–0008 dokumenterer beslutningene fra denne perioden.
