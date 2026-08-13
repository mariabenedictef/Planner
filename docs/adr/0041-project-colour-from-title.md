# ADR 0041 — Fast farge per prosjekt, utledet av tittelen

**Status:** Accepted
**Date:** 2026-08-13
**Bygger på:** 0035 (prosjekt-chipen)

## Context

Chipen fra [ADR 0035](0035-project-tag-carries-the-project-name.md) løste at prosjekttilhørighet var en fotnote. Men alle chipene var grå og like: «Meox AS», «Bryllup Porto» og «Dealflow» hadde identisk utseende, så en tagget oppgave måtte *leses* før den kunne plasseres. I en liste med 108 oppgaver er det 108 lesinger.

Kategorifargene (jobb/privat/helse/reise) finnes, men de er fire, ikke tretten — og de sier hvilken *sfære* noe hører til, ikke hvilken sak.

Samtidig ble chipen rendret på seks steder, hver med sin egen strengkonkatenering. Bare ett av dem hadde klikk-for-å-fjerne-taggen.

## Decision

**Nyansen utledes av tittelen. Ingen ny state, ingen fargevelger.**

```js
function projectHue(title){
  const s = String(title || '');
  let h = 0;
  for (let i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h % 360;
}
```

Samme prosjekt får samme farge på PC og telefon uten at noe må synkroniseres, og et nytt prosjekt får en farge i det øyeblikket det får et navn.

**Bare nyansen varierer.** Metning og lyshet ligger i CSS — én gang for lys modus, én gang for mørk — så kontrasten er kontrollert i begge temaer uansett hvilken nyanse hashen treffer:

```css
.proj-chip[style*="--pc-h"]{ background:hsl(var(--pc-h), 44%, 94%); … }
[data-theme="dark"] .proj-chip[style*="--pc-h"]{ background:hsl(var(--pc-h), 20%, 24%); … }
```

`[style*="--pc-h"]` gjør at chipen faller tilbake til den gamle grå varianten hvis variabelen mangler.

**Én dør: `projChipHTML(title, attrs)`.** Alle seks kallstedene bruker den nå. Stedet som trenger klikk-for-å-fjerne sender inn sine egne attributter.

**Kortet får samme nyanse som venstrekant.** `border-left: 3px solid hsl(var(--pc-h), 40%, 72%)` — det er koblingen som gjør fargen til informasjon og ikke bare pynt: kortet i Prosjekter og chipen på en tagget To Do i Hjem er samme farge, altså samme sak.

## Consequences

**Vi aksepterer:**

- **Fargene kan ikke velges.** Får to prosjekter nyanser som ligger nær hverandre, er svaret å endre en tittel — ikke å plukke farge. Verifisert på hennes tretten prosjekttitler: ingen visuelle kollisjoner.
- **Endrer man tittelen, endres fargen.** Det er en konsekvens av å ikke lagre noe. Prosjekttitler endres sjelden, og en farge som følger av navnet er lettere å forutsi enn en som ble tildelt av en teller.
- **Fargen bærer ingen betydning utover identitet.** Den sier ikke «hastverk» eller «privat» — de finnes allerede som prioritet og kategori. Å blande dem inn i nyansen ville gjort alle tre uleselige.
- **Seks inline `style="--pc-h:…"` til.** Inline-stiler i app.js går fra 133 til 139; grensen på 150 (se `project_planner`-notatet) nærmer seg. Egendefinerte CSS-variabler er standardmåten å sende en verdi fra data til stilark, og alternativet — 360 forhåndsgenererte klasser — er verre.
- **Hashen er ikke jevnt fordelt.** `h*31 + charCode` er en enkel polynomisk hash, ikke en fordelingsgaranti. Den er deterministisk, og det er kravet.

**Vi får:**

- 11 nye assertions: determinisme, ulike titler gir ulik nyanse, nyansen ligger i 0–359, tom tittel gir tom chip, tittelen escapes, ekstra attributter følger med, og kort og chip viser *samme* nyanse for samme prosjekt.
- Visuelt verifisert i lys og mørk modus.

## Alternatives considered

**Fargevelger per prosjekt.** Full kontroll, men det er et felt i skjemaet, et felt i datamodellen, en migrasjon, og en avgjørelse hun må ta tretten ganger. Utledet farge koster null valg.

**Farge fra kategorien.** Da har «Meox AS», «Alvestad Marin AS» og «Dealflow» samme farge — de er alle jobb. Det er nettopp det problemet dette skulle løse.

**Nummerert palett med 8–12 håndplukkede farger, tildelt etter opprettelsesrekkefølge.** Penere farger, men rekkefølgen må lagres, og et slettet prosjekt etterlater et hull som neste prosjekt arver. Da er fargen ikke lenger en egenskap ved saken.

**Initialer eller ikon i stedet for farge.** «MA» og «AM» for Meox AS og Alvestad Marin AS. Krever fortsatt lesing — bare kortere lesing.

**OKLCH i stedet for HSL** for jevnere opplevd lyshet mellom nyanser. Riktigere fargelære, men gul og blå på samme HSL-lyshet er godt nok her, og HSL virker i alle nettlesere hun kan komme til å bruke.
