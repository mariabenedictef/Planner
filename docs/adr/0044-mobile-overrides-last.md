# ADR 0044 — Mobiloverstyringer må ligge sist i stilarket

**Status:** Accepted
**Date:** 2026-08-13

## Context

Maria bruker Planner på iPhone. Appen har femten media-spørringer og en 200-linjers blokk merket «iPhone redesign — touch-first sizing». Den var aldri sett på en telefonbredde. Denne runden var det eneste punktet på lista som var en *måling* og ikke en endring: ta skjermbilder av alle sju visningene på 390 px og rette det som faktisk brekker.

Første forsøk målte feil, og det er verdt å skrive ned. Playwright med `viewport: 390px` er ikke en telefon — `@media (hover: none)` matcher ikke, og appen har regler som bare gjelder der. Emulering via CDP (`Emulation.setEmulatedMedia`) ble stille overskrevet av Playwright ved navigasjon og skjermbilder: `hover:none` var `true` rett etter `goto` og `false` ved målingen. Det som til slutt holdt for hele prosessen, var et blink-flagg:

```
--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2
```

Med riktig emulering kom funnet: **to media-regler hadde vært døde i månedsvis.**

Media-blokkene for telefon ligger midt i stilarket (ca. linje 690–900). CSS bryr seg ikke om at en regel står i en media-spørring — ved samme spesifisitet vinner den som står *sist*. To basisregler står lenger ned:

| Regel i media-blokk | Basisregel lenger ned | Resultat |
|---|---|---|
| `@media (hover:none){.todo-row .actions{opacity:1}}` (linje 696) | `.todo-row .actions{…opacity:0}` (linje 1173) | Handlingsknappene **usynlige** på iPhone — men de tok fortsatt 126 px høyde i hver rad |
| `@media (hover:none){.drag-handle{display:none}}` (linje 698) | `.drag-handle{…display:inline-block}` (linje 1041) | Draghåndtaket sto der på touch, hvor HTML5-dra ikke virker i det hele tatt |

Målt radhøyde i To Do's: **172 px på telefon mot 42 px på desktop.** Fire oppgaver fylte skjermen, og 126 px av hver rad var usynlige knapper man likevel kunne treffe.

## Decision

**Alle mobiloverstyringer flyttes til en egen blokk nederst i stilarket,** med en kommentar som forklarer hvorfor plasseringen er en del av rettelsen. Nye mobilregler hører hjemme der.

Innholdet i blokka:

**1. Frie To Do-rader viser bare ✎ og × i raden.** Ni kontroller per rad (fire prioritetsknapper, kategoriprikk, to nedtrekk, rediger, slett) er 126 px på 390 px bredde. Prioritet, prosjekt, frist og kategori ligger alle i oppgaveskjemaet ✎ åpner — ett trykk unna — og for flere rader samtidig finnes velg-modus ([ADR 0042](0042-bulk-edit-todos.md)), som kom i samme runde. Ingenting er utilgjengelig; det er flyttet ett trykk vekk fra en liste man leser mye oftere enn man redigerer.

**Innboksen beholder hele knapperaden.** Der *er* trikset å sortere med ⚠ ↗ ⤳ — det er hele grunnen til at innboksen finnes.

**2. Raden er en fast tre-kolonners layout:** avkryssing | tittel | ✎ ×. Med `flex-wrap:wrap` på raden dyttet en lang tittel seg selv ned på ny flex-linje og etterlot avkryssingsboksen alene øverst og knappene på en tredje linje — 134 px for én oppgave. Nå wrapper tittelen internt, så dato og prosjekt-chip legger seg under teksten.

**3. ✎ er ikke rød.** `.ag` farget både blyant og kryss med `--alert`. På telefonen, der de er de eneste to knappene, leste blyanten som en slett-knapp nummer to.

**4. Draghåndtak skjules på touch** — en død kontroll.

**5. Bøtteoverskriften wrapper.** `justify-content:space-between` på én linje la «1 ufordelte — dra til en boks under…» oppå «Innboks». `flex-wrap` framfor `flex-direction:column`, så rene tall («4») blir stående på samme linje.

**6. «Legg til»-radene på prosjektsiden wrapper.** Datofeltet, url-feltet og rollefeltet ble klippet av høyre kant. **Dette fant ingen overflow-måling:** en forelder har `overflow:hidden`, så `document.scrollWidth` vokste ikke. Det måtte ses.

**Resultat: median radhøyde 172 px → 60 px.** Ti oppgaver på skjermen i stedet for fire.

## Consequences

**Vi aksepterer:**

- **Prioritet og prosjekt krever ett trykk mer på telefon.** Det er byttet: lista blir lesbar. Skulle det vise seg at hun endrer prioritet oftere på telefon enn hun leser lista, er «▸ Utsett»-nedtrekket den første kandidaten til å komme tilbake.
- **Stilarket har nå en «må ligge sist»-blokk.** Det er en rekkefølgeavhengighet, altså noe man kan brekke ved å legge en regel på feil sted. Alternativet — å sortere hele arket slik at alle media-blokker kommer sist — er en flytting av 200 linjer med risiko i hver.
- **Skjermbilder på 390 px krever blink-flagget.** Uten det tester man en smal skjerm med mus, ikke en telefon. Det står i `shots.mjs` med begrunnelse.
- **`shots.mjs` er et verktøy, ikke en test.** Den kjøres for hånd og bedømmes med øynene. Den måler radhøyde og horisontal overflow automatisk, men resten er skjønn.

**Vi får:**

- To døde CSS-regler som nå virker, og en målt radhøyde på 60 px mot 172.
- Et skjermbilde-oppsett som faktisk emulerer touch, i to bredder, med automatisk sjekk av horisontal overflow og konsollfeil.

## Alternatives considered

**Flytte alle media-blokkene til slutten av arket.** Den prinsipielt riktige rettelsen — da forsvinner hele feilklassen. Utsatt fordi det er 200 linjer flytting der hver linje kan endre utseendet på en visning, uten at noen test fanger det. Verdt en egen runde med skjermbilder før og etter.

**`!important` på mobilreglene.** Virker, men flytter problemet: neste person skjønner ikke hvorfor det trengs, og `!important` sprer seg.

**Høyere spesifisitet i stedet for plassering** (`#view .todo-row .actions`). Samme innvending — usynlig grunn, og spesifisitetskrig er verre å reversere enn rekkefølge.

**Handlingene bak en «⋯»-knapp som åpner et ark** (iOS-mønsteret). Penere og beholder alle handlingene på telefon. Forkastet nå: det er en ny komponent (ark, bakgrunn, lukking, fokushåndtering) for å beholde knapper hun kan nå via ✎ uansett.

**Sveip for handlinger** i stedet for knapper. Finnes alt for slett og fullfør (`setupSwipeNavigation`). Å utvide sveip til prioritet betyr fire retninger og null oppdagbarhet.
