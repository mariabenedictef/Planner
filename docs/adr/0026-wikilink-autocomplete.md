# ADR 0026 — Wikilink-autocomplete skriver kildeformat, ikke markup

**Status:** Accepted
**Date:** 2026-08-10

## Context

ADR 0019 gjorde `[[Prosjekttittel]]` til en fungerende lenke. Det avdekket et bruksproblem umiddelbart: lenken virker bare hvis du skriver tittelen *helt* riktig. «Alvestad Marin AS» må være «Alvestad Marin AS» — ikke «Alvestad Marin», ikke «alvestad marin as».

`resolveWikilink` demper dette ved klikketidspunkt (eksakt match, deretter delvis match med bekreftelses-dialog), men det er feil sted å løse det. Da har du alt skrevet feil, lagret notatet, og fått en `wikilink-broken`-lenke som ser ut som en feil. Med 13 prosjekter — flere med navn som «Investering: Piscada Aqua AS» — er det å huske eksakt tittel den faktiske barrieren mot å bruke funksjonen.

Notat-editoren er `contenteditable` med rik tekst. Innholdet lagres som HTML, saniteres ved rendering, og autolagres 400 ms etter hvert tastetrykk.

## Decision

**`[[` i edit-modus åpner en prosjekt-velger som setter inn kildeformatet `[[Tittel]]` — aldri anker-markup.**

`_wireWikilinkAutocomplete(editor, afterInsert)` kobles på editoren i `openNoteEditor`. Kontrakten:

- **Trigger:** caret står i en tekstnode, rett etter en uavsluttet `[[`, og søket mellom klammene inneholder ingen `[` eller `]` og er under 60 tegn. Ellers er lista skjult. Bare edit-modus — `contentEditable !== 'true'` gir umiddelbar skjuling, så view-modus (der ankerne alt er rendret) aldri trigger den.
- **Kandidater:** ikke-arkiverte prosjekter, substring-match case-insensitivt, prefiks-treff sortert først, deretter alfabetisk med `localeCompare(…, 'nb')` slik at æøå havner riktig. Maks 8 rader.
- **Tastatur:** ↓/↑ flytter, Enter/Tab setter inn, Escape lukker lista. Escape kaller `stopPropagation()` — uten det ville den dokument-nivå Escape-lytteren lukket hele notat-modalen, og du ville mistet lista *og* notatet i ett trykk. Enter uten treff fanges **ikke**, så en vanlig linjeskift midt i «[[noe som ikke finnes» fortsatt virker.
- **Innsetting** skjer med en `Range`: slett `[[søk`, sett inn tekstnoden `[[Tittel]]`, flytt caret bak den. Deretter `afterInsert()` → autolagring.

**Innsettingen produserer tekst, ikke elementer.** Det er hele poenget, og det følger direkte av ADR 0019: kildeformatet er det som lagres, og `findBacklinks` leter etter `[[...]]` i rå tekst. En autocomplete som satte inn `<a class="wikilink">` ville brutt bakoverlenkene og vært umulig å redigere etterpå.

## Consequences

**Vi aksepterer:**

- **`Range` i stedet for `document.execCommand('insertText')`.** execCommand ville gitt gratis undo-integrasjon, men er deprecated, og oppførselen ved sletting av et utvalg varierer mellom motorer. Med Range vet vi presist hva som skjer. Kostnaden er at Ctrl+Z etter en innsetting kan angre i større biter enn tegn-for-tegn.
- **Posisjonering er best-effort.** Lista ankres til caretens `getClientRects()[0]`, med fallback til `getBoundingClientRect()` og til `0,0` hvis ingen av dem finnes (jsdom har ingen av dem — derfor fallback-kjeden, ellers kaster røyk-testen). Boksen klemmes innenfor viewport og snur over caret hvis det ikke er plass under.
- **Bare prosjekter.** Samme målrom som `resolveWikilink`. Oppgaver, datoer og andre notater er ikke lenkbare — å utvide er en egen beslutning.
- **`z-index: 5100`** — over `.modal-bg` (5000). Boksen bor inne i modalen, så `closeModal` rydder den og lytterne sammen med editoren. Ingen eksplisitt teardown.
- **Arkiverte prosjekter foreslås ikke,** men `[[Arkivert prosjekt]]` skrevet manuelt løses fortsatt av `resolveWikilink`. Autocomplete er en snarvei, ikke en tilgangskontroll.

**Vi får:**

- Wikilinks blir brukbare uten å huske eksakte titler. Det var forutsetningen for at ADR 0019 skulle ha verdi i praksis.
- `wikilink-broken` blir det den skal være — et signal om at noe er *feil*, ikke standardresultatet av å skrive fort.
- Prosjekt-til-prosjekt-koblinger blir billige nok å lage at de faktisk blir laget, som er det bakoverlenkene lever av.

## Alternatives considered

**Fuzzy-matching ved klikk i stedet for ved skriving.** Utvide `resolveWikilink` til å gjette hardere. Forkastet: flytter gjettingen til feil tidspunkt, og en dialog som spør «mente du X?» hver gang er verre enn å velge riktig med én gang.

**Egen «sett inn lenke»-knapp i verktøylinja.** Ville krevd modal-i-modal og et musegrep midt i skrivingen. `[[` er allerede syntaksen — å lytte på den koster ingen ekstra UI.

**Live-rendring av lenker mens man skriver (Obsidian-stil).** Krever caret-bevaring gjennom `innerHTML`-omskriving i `contenteditable`. Kjent vanskelig, og ADR 0019 avviste det alt av samme grunn.

**`<datalist>` eller et `<input>` i stedet for en egen liste.** `datalist` kan ikke ankres til en caret-posisjon inne i et contenteditable-felt, og gir ingen kontroll over tastaturoppførselen. Egen boks er ~90 linjer og gjør presis det vi vil.
