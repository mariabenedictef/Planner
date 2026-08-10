# ADR 0020 — Notat-sanitizer bruker URL-whitelist, med unntak for innlimte raster-bilder

**Status:** Accepted
**Date:** 2026-08-10

## Context

`sanitizeNoteHTML` (lagt til 2026-05-27, kvalitetskontroll runde 2) nøytraliserte alle `data:`-URL-er i `href`/`src` sammen med `javascript:`:

```js
out = out.replace(/(href|src)\s*=\s*"\s*(?:javascript|data):[^"]*"/gi, '$1="#"');
```

Samtidig har notat-editoren en lim-inn-håndterer som lagrer innlimte skjermbilder som data-URL:

```js
if (item.type && item.type.startsWith('image/')) {
  ...
  document.execCommand('insertImage', false, r.result);  // r.result = "data:image/png;base64,…"
```

De to trekker i motsatt retning, og sanitizeren vinner. Feilkjeden:

1. Maria limer inn et skjermbilde i et prosjektnotat. Bildet vises — `execCommand` skriver direkte i DOM, sanitizeren er ikke involvert.
2. Autolagring skriver `editor.innerHTML` til `state`. Data-URL-en er intakt på disk.
3. Hun åpner notatet igjen. `openNoteEditor` rendrer via `sanitizeNoteHTML(n.content)` → `<img src="#">`. Bildet er borte på skjermen.
4. Autolagring på neste `input`/`blur` skriver den sanerte DOM-en tilbake. **`src="#"` er nå lagret. Bildet er borte for godt.**

Verifisert i sandbox mot koden som lå live: `sanitizeNoteHTML('<img src="data:image/png;base64,…">')` returnerte `<img src="#">`.

Dette er en stille datatapsfeil, ikke en kosmetisk. Den rammer bare notater med innlimte bilder, og bare etter en åpne-lukke-runde, som er grunnen til at den har levd siden 27. mai uten å bli rapportert.

## Decision

**Sanitizeren avgjør URL-er med én whitelist-funksjon, `_noteUrlIsSafe(url)`, i stedet for tre regexer med innebygd blacklist.**

```js
function _noteUrlIsSafe(url){
  // dekod numeriske HTML-entiteter, fjern whitespace/kontrolltegn
  if (/^javascript:/i.test(u) || /^vbscript:/i.test(u)) return false;
  if (/^data:/i.test(u)) return /^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,/i.test(u);
  return true;
}
```

Tre konsekvenser av formen:

- **`data:image/…;base64` for raster-formater slippes gjennom.** Innlimte skjermbilder overlever rendering. Dette er hele poenget.
- **`data:image/svg+xml` blokkeres bevisst**, selv om det er et bildeformat. SVG kan inneholde `<script>` og eksterne referanser; det er ikke inert på samme måte som PNG/JPEG. Nettleseren rendrer ikke script i `<img src="…svg">`, men whitelisten skal ikke være avhengig av den detaljen.
- **Entitet-koding dekodes før testen.** `java&#115;cript:alert(1)` slapp gjennom den gamle blacklisten fordi mønsteret `javascript:` ikke matchet råteksten — nettleseren dekoder attributtverdier, regexen gjorde ikke. Nå dekodes numeriske entiteter og whitespace fjernes før prefikset testes.

Regelen som gjør whitelist riktig form her: alt som ikke er gjenkjent som trygt får `#`. Legger noen til en ny URL-ordning i fremtiden, feiler den lukket.

## Consequences

**Vi aksepterer:**

- Notat-innhold kan inneholde base64-bilder, som er store. Et skjermbilde på 200 kB blir ~270 kB base64 inne i `state`, som ligger i `localStorage` (~5 MB grense per opphav) og synkes gjennom Cloudflare KV. Mange innlimte bilder vil før eller senere presse localStorage-kvoten. Det var allerede sant før denne endringen — endringen gjør bare at bildene faktisk *virker*, så det er verdt å vite. Blir det et problem, er svaret en egen beslutning (fil-referanser i stedet for innebygde data).
- SVG kan ikke limes inn i notater. Ingen etterspørsel, og en trygg default.
- Whitelisten kjører per `href`/`src`-attributt via replace-callback i stedet for ren regex. Marginalt tregere, uten praktisk betydning på notat-størrelser.

**Vi får:**

- Innlimte skjermbilder overlever åpne-lukke-runden. Datatapsfeilen er stengt.
- Strengere sikkerhet enn før, ikke løsere: entitet-kodet `javascript:` og `vbscript:` blokkeres nå, og ukjente ordninger feiler lukket.
- Én funksjon å endre og teste når URL-policyen skal justeres.

## Alternatives considered

**Slippe alle `data:`-URL-er gjennom.** Enklest. Forkastet: `data:text/html` i `href` er en reell XSS-vektor, og whitelisten koster tre linjer.

**Slutte å lagre bilder som data-URL — laste dem opp et sted i stedet.** Riktig langsiktig svar på størrelses-problemet, men krever et lagringssted (R2 eller lignende), autentisering, og opprydding av foreldreløse bilder. Egen beslutning, ikke en bugfix.

**Sanitere ved lagring i stedet for ved rendering.** Ville forhindret at `src="#"` ble skrevet tilbake, men bare flytter problemet: innholdet ville fortsatt blitt sanert på vei inn, og bildet ville forsvunnet med én gang. Rendring er også riktig sted å sanere, fordi innhold kan komme fra JSON-import og KV-sync uten å gå gjennom editoren.

**Bare fjerne lim-inn-bilde-funksjonen.** Ærlig alternativ — den var i praksis ødelagt. Forkastet fordi et skjermbilde i et prosjektnotat («slik ser dashboardet ut nå») er nøyaktig den typen notat funksjonen finnes for.
