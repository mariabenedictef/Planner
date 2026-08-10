# ADR 0021 — Notat-saniteringen opererer per tag, aldri på hele strengen

**Status:** Accepted
**Date:** 2026-08-10

## Context

`sanitizeNoteHTML` fjernet inline event-handlere med tre regexer kjørt over hele notat-HTML-en:

```js
out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');   // ← denne
```

Den tredje matcher også brødtekst. Kjørt mot den faktiske funksjonen under helsesjekken 2026-08-10:

```
IN : <p>Prøvemiddag onsdag = 18:00 hos Anne</p>
OUT: <p>Prøvemiddag hos Anne</p>

IN : <p>Status online = ja</p>
OUT: <p>Status>                      ← spiste også den avsluttende taggen
```

`\son[a-z]+` matcher « onsdag», `\s*=\s*` matcher « = », `[^\s>]+` matcher «18:00». I en norsk planlegger er «onsdag» ikke et kanttilfelle — det er et av de vanligste ordene i et møtenotat. «online», «onkel» og «ontologi» gjør det samme.

Verre: feilen er ikke bare visuell. Notat-editoren rendrer via `sanitizeNoteHTML` når notatet åpnes, og `saveNow` leser `editor.innerHTML` tilbake til `state` når man forlater edit-modus. Så sekvensen «åpne notat → klikk inni → lukk» gjør den saniterte teksten permanent, uten at brukeren har skrevet et tegn. Notater som alt inneholdt «onsdag = » var derfor på vei til å bli ødelagt ved neste åpning.

Dette er samme feilklasse som ADR 0020 beskrev for innlimte bilder — render-transformasjon som skrives tilbake til lagret innhold. Der var symptomet ett attributt; her var det brødtekst.

## Decision

**Attributt-sanitering skjer per tag, aldri på hele strengen.** `sanitizeNoteHTML` går gjennom HTML-en tag for tag med én regex som matcher `<tag ...>`-konstruksjoner, og kjører attributt-reglene bare på attributt-delen av hver tag:

```js
out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g,
  (m, close, tag, attrs) => { /* rens attrs, sett taggen sammen igjen */ });
```

Tekstnoder blir per konstruksjon ikke rørt. Både `on*=`-strippingen og URL-whitelisten fra ADR 0020 flyttet inn i denne passeringen, så ingen av dem kan lenger treffe brødtekst.

To detaljer som følger av valget:

- **Attributt-verdier i anførselstegn hoppes over av tag-regexen** (`"[^"]*"|'[^']*'` er egne alternativer), så et `>` inne i en attributt-verdi avslutter ikke taggen for tidlig.
- **En avsluttende, uterminert tag-fragment kuttes bort.** `<p onclick=x` helt på slutten av strengen kan ikke attributt-renses trygt, og en nettleser ville tolket den som en tag. Vi dropper fragmentet i stedet for å la det gå gjennom.

**Beslektet regel, samme kodesti:** notat-editorens egen `click`-lytter må ignorere klikk på wikilinks. Lytteren fyrer under boblingen *før* den sentrale dispatcheren, så `data-stop="1"` kommer for sent — et klikk på en `[[lenke]]` flippet notatet til edit-modus i tillegg til å navigere. Sjekken hører hjemme i lytteren, ikke i dispatcher-attributtene.

## Consequences

**Vi aksepterer:**

- Tag-regexen er mer omfattende enn tre enkle erstatninger, og litt tregere. På notat-størrelser er det uten betydning.
- Sanitizeren er nå avhengig av å kunne kjenne igjen tag-grenser. Grovt ødelagt HTML (uparede anførselstegn over flere tagger) kan i teorien gi en tag som ikke matcher og dermed ikke renses. `contenteditable` produserer ikke slik HTML, og importert innhold går gjennom samme sti — risikoen er lavere enn den vi hadde.
- Vi validerer ikke HTML-en, vi renser den. Det er fortsatt en regex-basert sanitizer, ikke en parser. Skulle notatene en dag kunne motta innhold fra andre enn Maria selv, er en ordentlig parser (eller `DOMParser` + tre-traversering) det riktige svaret.

**Vi får:**

- Brødtekst i notater er trygg. Verifisert med kjørbare tester for «onsdag = 18:00», «online = ja», «onsdag=14», og for at ord uten `=` (som «Vi ses onsdag kl 18») alltid var trygge.
- Sikkerheten er uendret eller bedre: `on*=`-attributter, `javascript:`, `vbscript:`, entitet-kodede varianter, `data:text/html` og `data:image/svg+xml` blokkeres fortsatt, og `<script>/<iframe>/<object>/<embed>` strippes før tag-passeringen.
- Én kodesti å endre og teste når notat-sikkerhetsreglene skal justeres.

## Alternatives considered

**Bare gjøre den tredje regexen strengere** — f.eks. kreve at treffet står inne i en tag ved å se etter et `<` uten mellomliggende `>` bakover. Forkastet: lookbehind-akrobatikk som er vanskelig å lese og lett å bryte, og som ikke løser at også URL-regexene kan treffe tekst.

**Droppe den uquoterte varianten helt** — `onclick=alert(1)` uten anførselstegn er sjelden. Forkastet: nettlesere aksepterer det, og en sanitizer som bevisst slipper gjennom en kjent vektor er verre enn en som er litt mer arbeid.

**Bruke `DOMParser` og traversere treet** — det riktige svaret rent teknisk: parse til DOM, gå gjennom elementene, fjern attributter, serialisér tilbake. Forkastet nå fordi det endrer mer enn feilen krever (serialiseringen normaliserer HTML-en på måter som ville gitt store differ i lagret innhold ved første åpning av hvert eksisterende notat). Det er riktig neste steg hvis sanitizeren noen gang må håndtere fremmed innhold.

**Slutte å skrive den saniterte DOM-en tilbake til state** — angriper feilklassen i stedet for symptomet, og er delvis gjort: ADR 0019 innførte `saveNow` som bare leser editoren i edit-modus. Men edit-modus viser også sanitert innhold, så tilbakeskrivingen består. Å skille «lagret rå kilde» fra «sanitert visning» fullstendig ville krevd at editoren jobbet mot rå HTML og at saniteringen bare skjedde ved visning — mulig, men en større omskriving av notat-editoren enn denne feilen berettiget.
