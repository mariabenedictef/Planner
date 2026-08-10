# ADR 0019 — Wikilinks rendres ved visning, aldri i lagret innhold

**Status:** Accepted
**Date:** 2026-08-10

## Context

Planleggeren har hatt en halvferdig wikilink-funksjon siden 2026-05-27.

Delene som fantes:

- `.wikilink` / `.wikilink-broken`-CSS i `index.html` (linje ~900).
- `HANDLERS.resolveWikilink(target)` — slår opp prosjekt på tittel (eksakt, deretter delvis med bekreftelse) og navigerer dit.
- `HANDLERS.openWikilink(...)` — leser `data-target` fra elementet og delegerer til `resolveWikilink`.
- `findBacklinks(targetTitle)` + `_projectBacklinksSectionHTML(p)` — «Referert i»-seksjonen på prosjektsiden, som søker etter `[[Tittel]]` i andre prosjekters notater og beskrivelser.

Delen som manglet: **ingenting rendret `[[Tittel]]` som klikkbar lenke.** Bakoverlenker virket (fordi de leser rå tekst), foroverlenker gjorde ikke. Skrev Maria `[[Meox AS]]` i et notat, så hun bare rå klammer.

Årsaken er sporbar: `renderMarkdown` ble slettet som død kode 2026-05-27 (CHANGELOG, kvalitetskontroll runde 2). Den funksjonen var det eneste stedet som transformerte `[[...]]` til anker-markup. Da den forsvant, ble `openWikilink`, `resolveWikilink` og CSS-en uåpnåelige — og den statiske død-kode-auditen fanget det ikke, fordi `openWikilink` sto i `HANDLERS` og dermed «så brukt ut».

Notater er i dag rik tekst: `contenteditable`-HTML lagret i `p.noteList[].content`, sanitert ved rendering via `sanitizeNoteHTML`. Editoren har to modi — `view` (standard når notatet har innhold) og `edit` — og autolagrer på `input` (400 ms debounce) og `blur`.

Det gjør gjeninnføringen ikke-trivielt: hvis vi rendrer wikilinks inn i det samme `contenteditable`-elementet som autolagrer `editor.innerHTML`, blir anker-markup **lagret**. Neste rendring rendrer ankere inne i ankere, `unrender` blir umulig å reversere pålitelig, og `findBacklinks` slutter å finne `[[...]]` fordi klammene er borte fra lagret tekst. Bakoverlenkene ville dødd av at foroverlenkene ble skrudd på.

## Decision

**`[[Tittel]]` er kildeformatet. Anker-markup finnes bare i DOM, aldri i `state`.**

Tre regler:

1. **`renderWikilinks(html)`** kjøres ved rendering, etter `sanitizeNoteHTML`, og produserer
   `<a class="wikilink" data-action="openWikilink" data-target="Tittel" data-stop="1">Tittel</a>`.
   Finnes ingen prosjekt som matcher (eksakt eller delvis, case-insensitivt), får ankeret i tillegg `wikilink-broken` — men beholder `data-target`, slik at klikk fortsatt gir «Fant ikke prosjekt …»-toast fra `resolveWikilink` i stedet for stille ingenting.

2. **Notat-editoren rendrer wikilinks kun i `view`-modus.** `setMode` skriver `editor.innerHTML` på nytt ved hvert modusbytte: `renderWikilinks(sanitizeNoteHTML(rå))` i view, rå sanitert kilde i edit. Maria ser klikkbare lenker når hun leser, og rå `[[...]]` når hun redigerer — som er nødvendig for å kunne endre dem.

3. **Alle lagringsveier går gjennom `saveNow()`**, som (a) bare leser `editor.innerHTML` når modusen er `edit`, og (b) kjører `unrenderWikilinks()` på det uansett. To uavhengige barrierer mot at rendret markup havner i `state`. `unrenderWikilinks(renderWikilinks(x)) === x` er dekket av røyk-testen.

Regex-en for `[[...]]` matcher ikke over `<`/`>`. Deler brukeren en wikilink midt i med formatering (`[[Meox <b>AS</b>]]`), blir den ikke gjenkjent — den står som rå tekst og saniteres som vanlig. Det er et bevisst valg: å matche over tag-grenser krever DOM-traversering og gjør `unrender` upålitelig.

## Consequences

**Vi aksepterer:**

- Modusbytte skriver om `editor.innerHTML`. Markering og caret-posisjon nullstilles ved bytte view↔edit. Akseptabelt — modusbytte er allerede et bevisst brudd i flyten.
- `renderWikilinks` gjør et oppslag i `state.projects` per lenke. Med titalls prosjekter og noen lenker per notat er det uten betydning.
- Wikilinks peker bare på **prosjekter**. Ikke oppgaver, ikke datoer, ikke andre notater. `resolveWikilink` har alltid vært prosjekt-only, og å utvide målrommet er en egen beslutning.
- Formatering brytes ikke gjennom klammer (se over).

**Vi får:**

- `[[Prosjekt]]` i et notat blir en toveis-kobling: klikkbar fremover, synlig i «Referert i» bakover. Det var hele poenget med funksjonen.
- Lagret innhold er stabilt og verktøy-uavhengig. Eksportert JSON inneholder `[[Tittel]]`, ikke app-spesifikk anker-markup. Endres render-laget senere, er dataene uendret.
- `findBacklinks` fortsetter å virke uendret, fordi kildeformatet er uendret.
- CSS-en, `openWikilink` og `resolveWikilink` er ikke lenger død kode.

## Alternatives considered

**Lagre anker-markup direkte (la editoren produsere lenkene).** Enklest å implementere — ingen render/unrender-par. Forkastet: ødelegger `findBacklinks`, gjør lagret innhold app-spesifikt, og gjør at et sanitizer-avvik permanent kan skade notatet (samme feilmodus som ADR 0020 beskriver for innlimte bilder).

**Rendre wikilinks i et eget lese-panel, la editoren være ren tekst.** Ren separasjon, men gir notatene to visninger å vedlikeholde og bryter med at editoren *er* leseflaten i dag (view-modus).

**Live-rendring mens man skriver (som Obsidian).** Krever caret-bevaring gjennom innerHTML-omskriving i `contenteditable`. Kjent vanskelig, høy risiko for markør-hopp, og ingen etterspørsel — Maria skriver notater, hun lever ikke i dem.

**Droppe funksjonen og slette restene.** Var det reelle alternativet, og ble vurdert i samme økt. Forkastet fordi bakoverlenkene alt virker og gir verdi: koblingen prosjekt↔prosjekt er nyttig når et investeringscase refererer et annet. Halve funksjonen fantes; kostnaden var én render-funksjon.
