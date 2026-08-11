# Endringslogg — Planlegger

Hver vesentlig endring blir notert her med dato + commit-referanse. Holder oversikt over hva som har skjedd over tid og når. ADR-ene forklarer *hvorfor* — denne loggen forklarer *hva* og *når*.

Nye innslag legges øverst.

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
