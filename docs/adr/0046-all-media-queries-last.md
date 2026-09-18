# ADR 0046 — Alle media-spørringer ligger sist i stilarket

**Status:** Accepted
**Date:** 2026-09-17
**Bygger på:** 0044 (mobiloverstyringer sist) — dette er kuren, 0044 var lappen

## Context

[ADR 0044](0044-mobile-overrides-last.md) fant to døde CSS-regler: handlingsknappene i To Do-radene var usynlige på iPhone men tok 126 px høyde i hver rad, og draghåndtaket sto der på touch hvor HTML5-dra ikke virker. Årsaken var ikke reglene, men *plasseringen*: media-blokkene for telefon lå midt i arket (ca. linje 690–900), og alt som ble deklarert etter dem vant ved samme spesifisitet, uansett hva media-spørringen sa.

0044 løste symptomet ved å legge én ny blokk nederst med de reglene som trengtes. Feilklassen sto igjen: hver nye basisregel lenger ned i arket kunne når som helst slå av en mobilregel, stille, uten at noe varslet.

Målingen før denne endringen: **19 media-blokker spredt ut over arket, og 78 erklæringer i dem var døde** — slått av en basisregel lenger nede med samme selektor og samme egenskap. Hele blokka «iPhone redesign — touch-first sizing» fra linje 704 hadde vært delvis død siden basisreglene på linje 1092–1181 kom til.

## Decision

**Alle media-spørringer flyttes til slutten av stilarket, etter samtlige basisregler, i uendret innbyrdes rekkefølge.**

Omskrivingen er innholdsbevarende og ble verifisert som det: 2 666 erklæringer før, 2 666 etter, identisk multimengde, rekkefølgen bevart både blant basisreglene og blant media-reglene. Det eneste som endret seg er flettingen mellom de to gruppene — som er hele poenget.

`@media print` flyttes med. Regelen er «alle media-spørringer sist», ikke «alle bredde-spørringer sist» — et unntak ville bare vært et nytt sted feilklassen kunne bo.

**Regelen framover står som en banner-kommentar over blokka:** nye media-spørringer skrives der, aldri oppe i arket.

**Én revidert erklæring følger med.** Da blokka våknet vokste `.todo-row` fra 59 til 71 px median på telefon, fordi den bar `padding:14px 16px` og `font-size:15px` fra en eldre mobildesign. Polstringen og skriftstørrelsen er derfor satt tilbake til verdiene 0044 målte. Berøringsmålene beholdes store: avkryssingsboksen går fra 15 til 22 px, og knappene får 40 × 40 px minstemål. 15 px er langt under enhver retningslinje for et treffområde.

## Consequences

**Vi aksepterer:**

- **77 andre erklæringer får virke nå.** Romsligere kort på Hjem, større kvikk-felter, større knapper. Det er det blokka alltid sa; forskjellen er at den gjør det. Endringen er visuelt verifisert i to bredder og to modi, men den er reell — telefonen ser annerledes ut enn i går på alt utenom To Do-radene.
- **Stilarket leses ikke lenger ovenfra og ned per komponent.** En komponents mobilregler står ikke ved siden av basisreglene sine, men nederst. Det er prisen for at kaskaden er forutsigbar.
- **Diffen er stor** — 19 blokker flyttes — selv om ingen erklæring er endret utenom `.todo-row`. Invariantsjekken over er grunnen til at det er trygt å lese diffen som «flyttet», ikke «endret».

**Vi får:**

- En basisregel kan ikke lenger overkjøre en media-regel ved et uhell. Feilklassen som kostet to døde regler i månedsvis er borte, ikke lappet.
- Målt resultat: median radhøyde 59 px på 390 px med berøringsemulering (uendret), 42 px på 1280 px (uendret), 0 horisontal overflow og 0 konsollfeil i alle 16 kombinasjoner av visning × bredde × modus.

## Alternatives considered

**La 0044 sin blokk være den eneste regelen, og fortsette å legge nye mobilregler nederst.** Billigst, og det virker — så lenge alle husker det hver gang. Forkastet: en regel som krever at man husker den er ikke en regel, den er en felle. De 78 døde erklæringene er beviset.

**`@layer` for å styre kaskaden i stedet for rekkefølge.** Riktig verktøy på papiret, og ville latt blokkene bli stående der de er. Forkastet: det endrer spesifisitetssemantikken for *hele* arket på én gang, i en app med 616 regler som ingen har lest i sin helhet på lenge. Flytting er mekanisk og kan verifiseres som innholdsbevarende; `@layer` kan ikke det.

**Flytte bare telefonblokkene og la `@media print` og de små enlinjerne stå.** Mindre diff. Forkastet: da er regelen «noen media-spørringer sist», og den neste som legger til en blokk vet ikke hvilken kategori hans hører til.
