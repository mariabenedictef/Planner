# ADR 0039 — Angre sletting, én angring om gangen

**Status:** Accepted
**Date:** 2026-08-13

## Context

Sletting var endelig. `confirm()` var hele sikkerhetsnettet — og på × for en fri To Do fantes ikke engang det: knappen slettet umiddelbart, uten spørsmål. Elleve slettehandlinger, sprikende oppførsel:

| Handling | Bekreftelse før | Angring |
|---|---|---|
| Fri To Do (×) | nei | nei |
| Fri To Do (venstresveip på mobil) | ja | nei |
| Oppgave i skjema | nei | nei |
| Prosjektoppgave, delmål, person, lenke | ja | nei |
| Prosjektnotat | ja («Dette kan ikke angres») | nei |
| Hendelse | bare hvis gjentakende | nei |
| Prosjekt | ja | nei |
| Innboks-element | nei | nei |

Bekreftelsesdialoger er dessuten dårlig beskyttelse mot den feilen de skal fange. Man klikker seg gjennom dem uten å lese — særlig når de kommer ofte, og særlig på små elementer man sletter mange av. Sveip-tilfellet er verst: sveip er nettopp gesten man gjør ved et uhell på en telefon, og svaret var en dialog man trykker bort like refleksivt.

Øyeblikksbildene fra ADR 0030/0031 dekker en annen situasjon: de er for «jeg har rotet det til, rull tilbake til i morges», ikke for «det der var feil rad».

## Decision

**Ett angrepunkt om gangen, åtte sekunder, knapp i toasten.**

```js
registerUndo(label, restore)   // erstatter angrepunktet, viser toast med ↩ Angre
deleteWithUndo(getArr, id, label)   // fjerner ett element og registrerer angringen
HANDLERS.undoLast()            // også bundet til Ctrl/Cmd+Z utenfor skrivefelt
```

Alle elleve slettehandlingene går gjennom `deleteWithUndo`.

**`getArr` er en funksjon, ikke en array.** Lista slås opp på nytt ved gjenoppretting. Et sky-pull mellom sletting og angring bytter ut hele `state`, og en fanget array-referanse ville da vært frakoblet: angringen hadde skrevet inn i en array ingen leser lenger, sett ut til å lykkes, og ikke endret noe synlig. Nøyaktig den feilklassen [ADR 0031](0031-snapshot-floor-and-parsed-time.md) og «stillhet er ikke suksess» handler om.

**Gjenopprettingen er additiv og posisjonsbevarende.** Indeksen fanges ved sletting og elementet settes inn igjen der. Ved massesletting settes flere inn i stigende indeksrekkefølge, så rekkefølgen blir den samme. Ingenting overskriver en hel liste, så en sky-oppdatering i mellomtiden overlever angringen.

**`restore()` returnerer `false` når plasseringen ikke finnes lenger** (prosjektet er slettet i mellomtiden). Da sier toasten «Kunne ikke angre — plasseringen finnes ikke lenger» i stedet for å påstå at det gikk bra.

### Bekreftelsene som ble fjernet, og de som står igjen

Fjernet for enkeltelementer: prosjektoppgave, delmål, person, lenke, notat, venstresveip. To sikkerhetsnett som gjør samme jobb betyr bare at man slutter å lese det ene.

Beholdt der angring ikke dekker hele tapet:

- **Hele prosjektet** — oppgaver, delmål, notater og lenker på én gang. For stort til å hvile på at hun rekker å se en toast.
- **Gjentakende hendelse** — sletter ALLE forekomster, ikke den man ser på.
- **Massesletting** (ADR 0042) — mange rader i ett klikk.

### Toasten

`showToast(msg, duration, undoAction)`. Knappen får `data-action` og går gjennom den vanlige dispatcheren (ADR 0012). Stilen flyttet fra `cssText` i app.js til en `.toast`-klasse i index.html — en knapp med hover-tilstand hører hjemme i CSS.

**Bare én toast i DOM om gangen.** To samtidige la seg oppå hverandre i samme hjørne. Det var kosmetisk før; nå kan den nederste være den eneste veien tilbake til slettede data.

## Consequences

**Vi aksepterer:**

- **Åtte sekunder, så er det borte.** Ingen angrehistorikk, ingen angring av angringen. Én angring dekker «jeg klikket feil», som er feilen som faktisk skjer.
- **Angrepunktet ligger i minnet, ikke i `state`.** En sidelasting tømmer det. Det er riktig: en angreknapp som overlevde en omstart ville tilbudt å gjenopprette noe man for lengst har glemt at man slettet.
- **Sletter man to ting raskt, kan bare den siste angres.** Toasten sier hvilken, så det er synlig — men det er en reell grense.
- **Færre bekreftelsesdialoger betyr flere faktiske slettinger.** Det er byttet: raskere i det normale tilfellet, med en utvei i det gale. Toasten står i åtte sekunder og er umulig å overse.
- **`Ctrl+Z` er nå reservert utenfor skrivefelt.** Inne i felt og contenteditable går den til nettleseren, som den skal.

**Vi får:**

- 22 nye assertions: sletting fjerner og registrerer, angring gjenoppretter på riktig indeks, angring virker etter at `state.tasks` er byttet ut, angring uten angrepunkt kaster ikke, bare én toast om gangen, enkeltsletting spør ikke lenger, prosjektsletting spør fortsatt, og en gjenoppretting som feiler blir rapportert.
- Visuelt verifisert i lys og mørk modus, desktop og 390 px.

## Alternatives considered

**Søppelkasse / arkiv.** Slettede elementer flyttes til en liste man kan hente fra. Mer robust, men det er en datamodell-endring med egen visning, egen opprydding og egen kvotebekymring (ADR 0030). Angring dekker feilklikket; søppelkassa dekker «jeg slettet det i forrige uke», som ikke har skjedd.

**Angrehistorikk med flere steg.** Krever at hver handling har en invers, ikke bare slettinger. Da er man i gang med et kommandomønster gjennom hele appen — en refaktorering, ikke en funksjon.

**Beholde alle bekreftelsene *og* legge til angring.** Trygt på papiret, men det er dagens tilstand pluss en knapp: man leser fortsatt ikke dialogene, og de sakene angring dekker best er nettopp de man klikker raskest gjennom.

**Angring også for endringer** (endret frist, flyttet prosjekt). Fristende, særlig sammen med masseredigering. Utsatt: sletting er det tapet som ikke kan rekonstrueres fra det man ser på skjermen.

**Lagre et øyeblikksbilde før hver sletting** i stedet for et angrepunkt i minnet. Forkastet: 650 kB per sletting mot en localStorage-kvote som alt har vært 170 kB fra veggen.
