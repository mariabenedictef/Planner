# ADR 0040 — Relative datoetiketter innenfor ±7 dager

**Status:** Accepted
**Date:** 2026-08-13

## Context

Alle frister sto som absolutte datoer: «12. aug». For å vite om det er i dag, i morgen eller for lenge siden, må man vite hvilken dato det er i dag og trekke fra. Det er hoderegning i hver rad, i en liste med 108 oppgaver.

Det fantes én halv unntak: forfalte frister ble røde. Farge sier «for sent», men ikke *hvor* for sent — «2 dager på overtid» og «tre måneder på overtid» så like ut.

## Decision

**Relativ etikett innenfor ±7 dager, absolutt dato utenfor.** Den absolutte datoen ligger alltid i `title`, så ingenting går tapt.

```js
daysBetweenKeys(aKey, bKey)  // hele døgn mellom to YYYY-MM-DD-nøkler
relDateLabel(key, todayK)    // «i dag» · «i morgen» · «i går» · «om 3 dager» · «2 dager på overtid»
relDateShort(key, todayK)    // «i dag» · «i morgen» · «i går» · «om 3 d» · «3 d siden»
absDateTitle(key)            // full dato til title-attributtet
```

Utenfor vinduet er den absolutte datoen både kortere og mer presis, så da bytter vi tilbake. Grensen er 7: `om 7 dager` er relativ, 8 dager fram er «21. aug».

**Kort variant der kolonnen er smal.** Prosjektkortenes datokolonne er 68 px (utvidet fra 54). `relDateShort` kan produsere maks «5 d siden» — 9 tegn — som er det tallet 68 px er valgt etter.

**`Math.round`, ikke `Math.floor`.** `fromKey()` gir lokal midnatt, så et døgn over et sommertidsskifte er 23 eller 25 timer. Med `floor` ville 25 timer blitt «0 dager» hver høst. Suiten sjekker 28.→29. mars 2026 og 24.→25. oktober 2026 eksplisitt, og kjøres i både UTC og Europe/Oslo — det er den ene testen som ikke beviser noe hvis den bare kjøres i én sone.

### Hvor det gjelder

To Do-lista, Urgent-seksjonen på Hjem, prosjektkortene, prosjektsidens oppgave- og delmålsliste, og kanban-kortene.

**Datointervaller beholder absolutte datoer i begge ender.** «om 3 d–14. aug» leses ikke som et intervall.

**«Forfaller i dag» på Hjem beholder absolutt dato.** Alt der er per definisjon i dag; å skrive «i dag» på hver rad under en overskrift som sier «Forfaller i dag» er støy.

### Forfalt får farge også i lista

`.due.overdue` er rød og halvfet i To Do-lista. Ordene bærer det alene, men fargen fanger blikket først når lista er lang.

## Consequences

**Vi aksepterer:**

- **Etikettene er lengre enn en dato.** «2 dager på overtid» er 18 tegn mot 7. Derfor den korte varianten i smale kolonner, og derfor ble datokolonnen på kortene 54 → 68 px.
- **Man ser ikke den absolutte datoen uten å holde musa over.** Det er byttet: den vanlige handlingen (er dette snart?) blir gratis, den sjeldne (hvilken dato er det egentlig?) koster en hover. På telefon finnes ikke hover — men der er skjermen liten og «om 3 d» er det man trenger.
- **Etiketten er beregnet ved render, ikke lagret.** Står appen åpen over midnatt, viser den «i dag» til neste render. Alle handlinger rendrer, så vinduet er kort — men det finnes.
- **Terskelen på 7 dager er et valg, ikke en sannhet.** «om 6 dager» er nyttig; «om 340 dager» er det ikke. Én uke er den horisonten resten av appen alt bruker (Uke-visning, ukesoppsummeringen i ADR 0038).

**Vi får:**

- 25 nye assertions, inkludert de to sommertidsdøgnene, grensene på 7 og 8 dager, at søppelinput gir tom streng, at den korte varianten aldri blir lengre enn 9 tegn, og at raden faktisk har absolutt dato i `title`.
- Visuelt verifisert på desktop og 390 px, lys og mørk modus.

## Alternatives considered

**Både relativ og absolutt i samme rad** («i morgen · 14. aug»). Forkastet: dobbelt så mye datotekst i hver rad, i en liste der tittelen er poenget.

**Bare farge, ingen ord** — grønn for framtid, rød for forfalt, gul for i dag. Forkastet: farge alene er utilgjengelig, tåler ikke gradering, og «hvor forfalt?» er nettopp spørsmålet man har.

**Ukedagsnavn i stedet for tall** («på torsdag»). Bedre for 2–6 dager fram, men tvetydig bakover («på torsdag» — forrige eller neste?) og verre for «i dag/i morgen», som er de to hyppigste tilfellene.

**Alltid relativ, uansett avstand** («om 340 dager»). Forkastet: verdiløs presisjon. «29. jun 2027» er det man vil se om bryllupet.

**`Intl.RelativeTimeFormat`.** Riktig verktøy i prinsippet, men nb-NO gir «om 3 dager» / «for 3 dager siden» — og «for 3 dager siden» sier ikke at fristen er *brutt*. «3 dager på overtid» er poenget. Fire linjer egen kode gir riktigere norsk enn API-et her.
