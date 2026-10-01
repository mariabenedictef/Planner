# ADR 0057 — Andre designgjennomgang: Prosjekter, Hjem og knappene som fortsatt snakket glyf

**Status:** Accepted
**Date:** 2026-10-01
**Bygger på:** 0041 (prosjektfarge fra tittelen), 0045 («Fra prosjekter»), 0055 (telefonraden), 0056 (designsystemet)

## Context

Etter ADR 0056 skrev Maria at ting hadde blitt finere, men at **Prosjekter-fanen «ser litt rar ut nå»**, og ba om en ny gjennomgang av hele appen. Gjennomgangen ble gjort på skjermbilder av hennes egne data, PC og telefon, lys og mørk.

**Prosjekter** var det tydeligste. 0056 tok boksen bort fra prosjektkortene og la en 2 px strek i prosjektets farge øverst. I en liste fungerer det; i et rutenett med flere kolonner gjør det ikke det. Kortene hadde ingen kant å holde seg innenfor, så tittel, nedtelling, framdrift og «neste» fløt i hver sin høyde, og den fargede streken leste som en løs dekor. Nedtellingen var et stort tall med en etikett («dager til måldato») som ble brutt over to linjer, og prosjektsiden hadde beholdt sine bokser fra før 0056 — med prosjektet som eneste sted i appen som fortsatt så ut som den gamle versjonen.

Resten av gjennomgangen fant sju ting som brøt med 0056 uten at noen hadde bestemt det:

1. **Hjem «Aktive prosjekter»** var nedtellingskort med et 26 px tall — **rødt for alt innen sju dager**. På hennes data betydde det fem røde tall på Hjem for prosjekter som gikk etter planen. Rødt skal bety at noe haster.
2. **Datokolonnen på Hjem** viste «—» og «–» når en oppgave ikke hadde frist. Et tegn som betyr «ingenting» er støy i en kolonne øyet bruker til å skanne datoer.
3. **Prioritetsknappene** i innboksen og i radens handlinger var fortsatt **⚠ ↗ ⤳ ○**. Bøtteoverskriftene rett over hadde mistet glyfene i 0056 og fått prikker — knappene var det eneste stedet hun måtte vite hva ↗ betyr.
4. **Kategoriknappen** ved siden av var en blå **●** — som så ut som en femte prioritetsprikk.
5. **«◈ Fra prosjekter»** hadde både en glyf og gruppehoder med tonet bakgrunn og farget tekst.
6. **Tom «Ukategorisert»** ble tegnet med overskrift og hjelpetekst selv når den var tom — en hel seksjon øverst i To Do's som sa «ingenting her».
7. **Kursiv** sto igjen på 25 steder: Outlook-hendelser, tomme tilstander, helligdager, hjelpetekst. Kursiv i en systemsans på 11–13 px er det som er tyngst å lese.

Og én feil som ikke var design, funnet av nettlesertesten underveis: **en advarsel kunne forsvinne etter 7 ms.** Den ukentlige backup-beskjeden kommer asynkront ~1 s etter oppstart og erstattet toasten som sto — også «⚠ Kunne ikke flytte oppgaven».

## Decision

**Prosjektkortene er rammede fliser — det eneste stedet i appen med boks, og med vilje.** Et rutenett av uavhengige ting trenger en kant å lese innenfor; en liste gjør ikke det. 1 px `--line`, radius 10, polstring 16/18, rutenett `minmax(300px,1fr)` med 16 px mellomrom. Prosjektets farge (`--pc-c`, fra tittelen, ADR 0041) bæres av en **prikk foran tittelen**, ikke av en strek — samme mønster som overskriftene ellers. Kategori og dato står på én metalinje skilt med «·». **Nedtellingen** er høyrestilt i hjørnet: tallet i 20 px med «dager igjen» / «dag igjen» under i 12 px, eller «ingen måldato» alene. Framdriften er en 3 px strek i `--ink`, ikke en fargelinje. Hover gir en litt mørkere kant og en svak skygge.

**Prosjektsiden følger 0056:** ingen boks rundt detaljene, tittelen 26 px, seksjonene (`.psection h4`) med strek i `--ink` under, Liste/Kanban som segmentkontroll uten glyfer, «← Prosjekter» som tilbakeknapp, slett-knappen på oppgaver dempet (vises ved hover på PC, blir rød først ved hover). På telefon har innholdet ikke lenger 18 px innrykk i forhold til overskriften.

**Hjem «Aktive prosjekter» er en liste, ikke kort.** Én rad per prosjekt: prosjektprikk, navn, det som skjer neste (dempet), og når — «i morgen», «om 4 dager» — høyrestilt i 12 px. Bare «i dag» og «i morgen» får full blekkfarge; ingenting er rødt. Telefonen legger «neste» under navnet.

**Datokolonnen på Hjem er tom når det ikke er noen dato**, 64 px fast bredde på PC. Det samme gjelder «neste oppgaver» på prosjektkortene og ukeoppsummeringen (funnet på hennes live-data etter første push: «–» foran en oppgave uten frist på Dealflow-kortet). Den tomme dagen i telefonens ukeagenda beholder sin «—» — der står den alene for en hel dag, ikke i en kolonne. På telefon skjules en tom datokolonne helt (`.hi-date:empty`), så tittelen får de 64 px. «+12 til uten frist» står i tittelkolonnen, uten kursiv, og **tar deg til To Do's** — før var den tekst uten handling.

**Prioritet er en prikk overalt.** `.prio-btn.urgent/.short/.long` tegner en 8 px prikk i samme farge som bøtteoverskriften; «Fjern prioritet» er en tom ring. I innboksen på PC står ordet ved siden av («● Urgent»); i radens hover-handlinger og på telefon står prikken alene med ordet i `title`. **Kategori er et ord**: «Jobb» / «Privat» med et lite kvadrat i kategorifargen, slik at den ikke kan forveksles med prioritetsprikkene. ✎ og × er dempet grå; × blir rød først ved hover, og har fått `title="Slett"`.

**«Fra prosjekter»** har mistet ◈. Gruppehodene er tekst: prosjektprikk, navn i 13 px halvfet `--ink`, antall i tabellsifre — ingen tonet flate, ingen farget tekst. Hjelpeteksten står i `.bh-hint` som i de andre bøttene.

**Tom «Ukategorisert» tegnes ikke.** Den kommer tilbake så snart én oppgave mangler plassering.

**Ingen kursiv.** Fjernet fra alle 25 regler og innebygde stiler, unntatt kursiv-knappen i notatverktøylinja (den *viser* kursiv). Outlook-hendelser skilles fra egne av tonen og venstrestreken, som før — kursiven var en tredje markør for det samme.

**Kalenderen på Hjem** har overskrift som de andre seksjonene («● Kalender — Uke 40 · 28. sep – 4. okt 2026»), dagshodene uten grå flate, og tomme dager er tomme i stedet for å vise «—».

**Sidepanelene i Dag** («Oppgaver i dag», «Notater») er seksjoner med strek, ikke bokser.

**En advarsel byttes ikke ut av en beskjed hun ikke ba om.** `showToast` husker når en ⚠-toast går ut; en vanlig beskjed som kommer før det venter til advarselen har stått ferdig. Angre-toasts slipper alltid til, fordi de er svar på noe hun nettopp gjorde.

## Consequences

**Vi aksepterer:**

- **Prosjektkortene er et unntak fra «aldri en boks».** CONTEXT.md sier nå at regelen gjelder lister og seksjoner; et rutenett av uavhengige objekter får en hårfin ramme. Ett unntak, begrunnet, er bedre enn et rutenett som flyter.
- **Prioritetsprikkene i hover-raden har ikke ord.** Fire prikker side om side er lesbare fordi de står i samme rekkefølge og farge som bøttene på samme side, men en ny bruker må holde musa over for å se ordet. I innboksen, der det er plass, står ordet.
- **En vanlig beskjed kan komme opptil 15 s forsinket** hvis en advarsel står (de lengste advarslene står så lenge, fordi de forklarer hva hun skal gjøre). Det gjelder bare beskjeder uten angre-knapp.
- **Hjem viser ikke lenger et stort tall for prosjekter.** Det som haster vises fortsatt — i Urgent-lista over, der det hører hjemme.

**Vi får:**

- Prosjekter som ser ut som resten av appen, med kort som står på linje i rutenettet.
- Ingen glyfer igjen i knapper hun bruker daglig; prikkfargen betyr det samme overalt.
- Rødt på Hjem betyr igjen «haster».
- En advarsel som faktisk blir sett.

## Verifisering

- `tests/run.mjs`: 690 → **699**, grønt i UTC og Europe/Oslo. Nye tester: tom «Ukategorisert» vises ikke / kommer tilbake med én oppgave; ingen ⚠ ↗ ⤳ ○ i knappene; `prio-btn`-klassen på alle sju; ingen nedtellingskort på Hjem; ingen ◈; advarsel blir stående, vanlig beskjed kommer etterpå, angre slipper alltid til. **Mot koden før denne runden feiler 6 av dem.** **Én test er snudd** (den femte i prosjektet): «To Do uten frist vises med tankestrek» på prosjektkortet er nå «har tom datokolonne» — feiler mot forrige versjon. Én annen er justert (ikke snudd): den lette etter `.bh-hint` i en bøtte og fant den i den tomme «Ukategorisert»; nå legger den inn én uplassert oppgave først.
- `tests/ics.mjs`: 80/80.
- `tests/browser.mjs`: 43/43, inkludert kontrastrevisjonen (§6: 0 brudd, alle størrelser på skalaen) og telefonbudsjettet (§5: tittel 152 px, median radhøyde 79 px — uendret). §3 («en flytting som kaster gir en synlig melding») feilet på den nye koden fordi backup-toasten kom 7–40 ms etter vår og byttet den ut; testen noterer nå hver toast som legges til, og appen er rettet så det ikke skjer.
