# ADR 0056 — Designsystemet: hvit flate, hårfine linjer, typografisk hierarki

**Status:** Accepted
**Date:** 2026-10-01
**Bygger på:** 0044/0046 (media-spørringer sist), 0047 (mørk modus på variabler), 0050 (mobilmodellen), 0051 (44 px avkryssingsboks), 0055 (hva en telefonrad har råd til)

## Context

Maria ba om en full design- og frontendoppgradering: «mer moderne, litt mer elegant og stilig — men det aller viktigste er at det er brukervennlig, lett å forstå og lett å lese». Hun har tidligere kalt et utkast med avrundede kort, fargefylte flater og store infografikktall «barnslig», og godtatt versjonen som erstattet dem med hvit bakgrunn, hårfine linjer, typografisk hierarki og en dempet palett. Det var utgangspunktet.

Revisjonen ble gjort med målinger på hennes egne data, ikke med øyemål. Fire funn:

1. **Teksten var målbart for svak.** `--ink-muted` (#8a93a3) ble brukt til datoer, antall og hjelpetekst i 11–12 px. Den er 3,1:1 mot hvitt og 3,0:1 mot sidebakgrunnen; WCAG AA krever 4,5:1 for liten tekst. «i morgen», «om 2 dager» og antallet i hver bøtte besto ikke. `--privat` var 2,6:1. En revisjon som går gjennom hver synlige tekstnode i sju visninger × lys/mørk × PC/telefon fant **1 340 brudd**.
2. **Ingen skriftskala.** 28 ulike størrelser i stilarket, fra 9 til 44 px, med halve piksler (9,5 · 10,5 · 11,5 · 12,5 · 13,5 · 14,5). 18 av dem ble faktisk tegnet. Øyet oppfatter det som uro uten å kunne si hvorfor.
3. **Fargefylte bøtteoverskrifter og avrundede kort** (12 px) — nøyaktig det hun har avvist.
4. **Georgia i små størrelser.** Serifen ga sideoverskriftene karakter, men i bøtteoverskrifter på 15 px og datoer på 11 px leste den som et tekstbehandlingsdokument. Den ble blandet med systemets sans i samme rad.

Og to feil som ikke var design, men som kom fram under arbeidet:

- **Ukedagsraden i Måned var et tomt bånd på ~55 px** over datoene — den arvet cellenes `min-height:110px`.
- **Gantt-stolpene i mørk modus hadde hvit tekst på lyse farger** (2,2:1), fordi `--work` og `--privat` er lyse i mørk modus.

To retninger ble bygget som prototyper på hennes egen app og vist som skjermbilder: **A «Ren»** (ingen beholdere — seksjoner er en overskrift og en strek) og **B «Rammet»** (lyse paneler med hårfin ramme på lysegrå side). Hun valgte **A**, og at **ordene skal stå som i dag** — «Urgent», «Short term», «Long term», «To Do's» er hennes.

## Decision

**Fargene er tokens, og hver tekstfarge er målt mot sin bakgrunn.**

| Token | Lys | Kontrast | Mørk | Kontrast |
|---|---|---:|---|---:|
| `--ink` | `#161b24` | 17,3:1 | `#e8ebf0` | 14,9:1 |
| `--ink-soft` | `#434b5a` | 8,8:1 | `#b4bac5` | 9,1:1 |
| `--ink-muted` | `#626a79` | **5,4:1** (var 3,1) | `#939bab` | 6,4:1 |
| `--alert` | `#b03a2b` | 6,0:1 (var 4,5) | `#ef8471` | 7,0:1 |
| `--work` | `#3b5884` | 7,2:1 (var 4,2) | `#93acd3` | 7,7:1 |
| `--privat` | `#985260` | 5,7:1 (var 2,6) | `#d89ea8` | 8,0:1 |

`--star` er 4,3:1 og brukes bare som grafisk merke (krav 3:1). Siden er hvit (`--bg:#fff`, var krem `#fafaf7`); `--surface-2` er bare hover og aktiv segmentknapp.

**Én skriftfamilie: systemets egen.** `-apple-system, "Segoe UI Variable Text", "Segoe UI", Inter, system-ui`. Segoe UI på PC-en, SF på iPhonen. Ingen nedlasting, ingen ventetid, fungerer offline. `--serif` er beholdt som et alias for `--font`, så eldre regler og innebygde stiler som nevner den følger med — 39 regler er dessuten skrevet om fra serif til sans, med vekt 500 → 600 og stram sperring.

**Åtte skriftstørrelser:** 11 (bare der kalenderen er tett) · 12 · 13 · 14 · 15 (brødtekst på telefon) · 16 · 20 · 26. Alle literaler i stilarket og i `app.js` er mappet mekanisk. 28 px står igjen på FAB-glyfen, som er et ikon og ikke tekst.

**Setningsform, ingen versaler.** Marias regel om overskrifter gjelder etiketter og tabellhoder også, og «DAGER TIL MÅLDATO», «MAN TIR ONS», «PRIVAT» var versaler. 12 regler har mistet `text-transform:uppercase` og sperringen som fulgte med.

**Seksjoner er en overskrift og en strek, ikke en boks.** Bøtteoverskriften er 14 px halvfet med en 7 px prikk i prioritetsfargen foran og **1 px strek i `--ink` under** — den sterke streken under overskriften og de hårfine mellom radene er det som holder gruppene fra hverandre uten rammer. Antall står høyrestilt i tabellsifre; hjelpeteksten står for seg (`.bh-hint`), slik at telefonen kan legge den på egen linje.

Samme mønster på Hjem (Urgent-lista mistet sin rosa flate og røde ramme — prikken bærer det), i ukeagendaen og dagsagendaen på telefon, og på prosjektkortene: ingen boks, en 2 px strek i prosjektets egen farge øverst, tallet til måldato ned fra 22–26 til 20 px med «dager til måldato» i setningsform. **Kategorietikettene** (Jobb/Privat) og prioritetspillene er tekst med en prikk, ikke hvit tekst på farget pille.

**Fyll bare der fyll betyr noe.** Outlook-hendelser beholder tonen i tidsrutenettene (Uke, Dag, Måned på PC), fordi det er fyllet som gjør dem til en blokk med varighet. I agendaen, som er en liste, holder venstrestreken. Gantt-stolpene er fylt fordi de *er* tidsintervaller; teksten på dem er `var(--surface)` i stedet for `#fff`, så den snur med temaet.

**Hover forlenger flaten med skygge, ikke marg.** `.todo-row:hover` får `box-shadow:-8px 0 0, 8px 0 0` i flatefargen. En negativ marg ville gjort det samme visuelt, men da stakk radstrekene 8 px forbi overskriftens strek på begge sider — det var den første versjonen, og den så sjusket ut.

**Draghåndtakene står i venstremargen** og vises ved hover. Før skjøv de avkryssingsboksen 26 px inn på rader som kunne dras, og ikke på de andre, så Urgent og Uten frist på Hjem startet i hver sin kolonne.

**Avkryssingsboksen er tegnet på PC også**, 16 px med hårfin kant og blekk-fyll når den er krysset av. Før var den nettleserens egen, som i mørk modus ble en hvit firkant. Telefonens 44 px-versjon fra ADR 0051 er beholdt, med en eksplisitt nullstilling av PC-tegningens rotasjon og fyll — uten den ble telefonens boks en rombe.

**Topplinja:** tekstfaner med 2 px strek under den aktive i stedet for piller, røde tellere som tall uten sirkel, filteret som en segmentkontroll med hårfin ramme. **Ingen `backdrop-filter` på topplinja:** den gjør elementet til en *containing block* for `position:fixed`-etterkommere, og bunnmenyen bor inne i topplinja (ADR 0050). I prototypen dro det bunnmenyen opp til toppen av skjermen og la den over merket.

**Hurtigfeltet på telefon** har fire prioriteter på én rad og prosjekt + tale på neste — to rader før første oppgave i stedet for tre. Prikken fikk ikke plass i en fjerdedel av 390 px («Short t…»), så prioriteten bæres der av en 2 px strek i underkant. **Innboksraden på telefon** er tittel + to linjer handlinger, alle synlige (var tre linjer, og prosjektvalget var klippet).

**Emoji ut av knapper og overskrifter** (📅 🎯 📋 🎤 ☑ ⚠ ↗ ⤳ ✓ ◦). Prikken tar over for prioritetsglyfene. Ordene er de samme.

**App-ikonet og statuslinja følger med:** hvit flate og halvfet sans-«P» (var krem og Georgia), og `applyTheme()` setter `meta[name=theme-color]` til `--bg`, så mørk modus ikke lenger har en lys stripe øverst på iPhonen.

## Consequences

**Vi aksepterer:**

- **Det ser annerledes ut, overalt, på én gang.** Ordene og plasseringen er de samme, men hun vil bruke noen dager på å venne seg til en side uten bokser. Retning B er dokumentert her og kan bygges på en ettermiddag hvis lange lister viser seg å trenge rammene.
- **Uten bokser er det streken under overskriften som holder gruppene fra hverandre.** Den er 1 px i `--ink` — tydelig, men det er det eneste. Lister med mange tomme bøtter blir luftigere enn før.
- **Telefonen og PC-en ser ikke identiske ut som før**, fordi skjermbildene i denne runden er tegnet med Inter (containeren har verken Segoe UI eller SF). Bredder kan avvike med noen få piksler på hennes enheter; ingenting i oppsettet er avhengig av eksakt tekstbredde.
- **Hjemskjermikonet på iPhonen oppdateres ikke av seg selv.** iOS bruker ikonet som lå der da appen ble lagt til; det nye kommer først når hun legger den til på nytt.
- **Kalenderen er fortsatt tett, 11 px.** Det er det eneste stedet under 12 px, og det består kontrastkravet, men det er lite.
- **Fargene er endret, ikke bare på flater.** `--work`, `--privat` og prioritetsfargene er mørkere i lys modus for å bestå kontrastkravet. Det merkes på kategoriprikker og prosjektfarger.

**Vi får:**

- **1 340 kontrastbrudd → 0**, målt over hver synlig tekst i sju visninger × lys/mørk × PC/telefon. **18 tegnede skriftstørrelser → 8.** Minste tegnede tekst 10 → 11 px.
- `tests/browser.mjs` 40 → **43**: seksjon 6 er revisjonen selv, og den feiler på alt under AA, alt utenfor skalaen og alt under 11 px. **Mot live-koden før runden feiler den alle tre** — 1 340 brudd, 11 størrelser utenfor skalaen, minste 10 px.
- `tests/run.mjs` 677 → **690**. Seksjon 45: statuslinja følger temaet, ingen Georgia eller versaler igjen, stilarket og `app.js` på skalaen, ordene i bøtteoverskriftene uendret og uten glyfer, antall og hjelpetekst som to elementer. Én eksisterende assertion er **justert, ikke snudd**: «Uten frist (2)» står nå som «Uten frist» + `<small>2</small>`. **13 av 690 feiler mot live-koden.**
- Telefonraden fra ADR 0055 er innenfor budsjettet: **tittel 152 px** (krav 150), **median radhøyde 79 px** (var 80).
- 110 handlere, 0 duplikater, 0 `data-action` uten handler, 20 media-blokker, alle sist.

## Alternatives considered

**B «Rammet».** Bygget og vist. Tydeligere grupper på lange lister, litt mer «app». Valgt bort av Maria; det rene uttrykket ligger nærmere det hun har likt før.

**En nedlastet skrift (Inter fra Google Fonts).** Ville gitt identisk utseende på alle enheter. Forkastet: en PWA som skal virke offline og starte raskt bør ikke vente på en skrift fra et annet domene, og Segoe UI og SF er begge bedre tilpasset sine skjermer enn Inter.

**Beholde serifen på sidetitlene alene.** Ville gitt et redaksjonelt preg. Forkastet: to familier på samme side er det revisjonen fant som urolig, og hierarki med vekt og størrelse i én familie er strammere.

**Oversette etikettene til norsk.** Spurt om; Maria ville beholde sine egne ord.

**Et overlegg med `!important` oppå det gamle stilarket.** Det var slik prototypene ble laget, og det går fort. Forkastet for den ekte versjonen: det etterlater hundrevis av døde deklarasjoner under (ADR 0046 fant 78 forrige gang) og gjør hver framtidig endring til en spesifisitetskamp. Reglene er skrevet om **på stedet**; bare det som ikke fantes fra før — prikkene, fokusringene, PC-avkryssingsboksen — står i en egen blokk, plassert før første `@media` (ADR 0046).
