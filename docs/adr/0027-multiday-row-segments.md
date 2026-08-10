# ADR 0027 — Flerdagsbar segmenteres per uke-rad, med etikett på hvert segment

**Status:** Accepted (amends 0014)
**Date:** 2026-08-10

## Context

ADR 0014 innførte flerdagsbaren i månedsvisningen med negative marginer som blør baren forbi celle-paddingen, slik at naboceller visuelt henger sammen. Den ADR-en listet én kjent svakhet under Cons:

> **The bar breaks visually at the week boundary** (Sunday → Monday) because the cells live in different `.row` grid containers. […] If it becomes annoying we can revisit with an absolute-positioned overlay layer.

Maria ba om at dette ble fikset. Da vi gikk inn i koden, viste det seg at problembeskrivelsen i 0014 var upresis — og at den foreslåtte løsningen ikke ville hjulpet.

**Hva som faktisk var galt.** For en run som krysser søndag→mandag:

1. **Mandags-cella hadde ingen etikett.** Alle celler etter den første er `_isContinuation`, og fortsettelsesceller rendrer `&nbsp;` som innhold — bevisst, siden de er *midt i* en bar der tittelen alt står til venstre. Men på en ny uke-rad står det ingenting til venstre. Resultatet var en navnløs grå stripe øverst i neste rad. En hendelse over to uker ga altså en anonym bar hver rad etter den første. Det var den reelle irritasjonen.
2. **Baren hang forbi radkanten.** Søndags-cella fikk `margin-right:-9px` fordi den ikke er siste dag i runen, så baren blødde ut i grid-kanten og ble klippet av `.month-grid`s `overflow:hidden`. Mandags-cella blødde tilsvarende `-9px` til venstre, ut over radens venstrekant.

**Hva overlay-laget ikke ville løst.** ADR 0014 reserverte «absolute-positioned overlay layer» for dette tilfellet, med begrunnelsen at det «works across week-row boundaries (one bar can wrap Sunday→Monday)». Det er ikke riktig. Et rektangel kan ikke omslutte slutten av én rad og starten av den neste — det gjelder uansett om baren tegnes med marginer, `grid-column: span N`, eller absolutte piksler. Enhver løsning gir **ett segment per uke-rad**. Overlay-laget ville byttet ut hvordan segmentene tegnes *innenfor* en rad (der margin-bleed alt fungerer), til prisen av et andre rendringspass, resize-håndtering og z-index-arbeid — og latt selve problemet stå.

## Decision

**Hvert uke-rad-segment av en flerdags-run er en selvstendig, merket bar.** To nye klasser, styrt av kolonneindeksen i `renderMonth`:

- **`multi-rowstart`** — fortsettelsescelle i kolonne 0 (mandag). Får tilbake avrundet venstrekant, venstre fargekant, full tekstfarge, og **re-merkes med `↳ Tittel`**. Ingen venstre-bleed.
- **`multi-rowend`** — celle i kolonne 6 (søndag) der runen fortsetter. Ender flush på radkanten med avrundet høyrekant og en `›`-markør flyttet til høyre som betyr «fortsetter neste uke». Ingen høyre-bleed.

Celler midt i en rad er uendret: `&nbsp;`-plassholder og margin-bleed, presis som ADR 0014 beskriver. Klokkeslett vises bare på runens første dag; rad-start-segmentet viser `↳` + tittel uten tid, fordi tiden hører til starten.

CSS-reglene er plassert **etter** margin-bleed-reglene i `index.html`. De har bevisst samme spesifisitet, så kilderekkefølgen avgjør. `multi-rowstart` setter `border-left-style`/`-width` men **ikke** `border-left-color`, slik at `.month-grid .cell .ev.cat-*`-reglene fortsatt gir kategorifargen.

Endringen gjelder bare `renderMonth`. Ukevisningen er én rad og har ikke problemet; List- og Dag-visningene har ingen bar-geometri.

## Consequences

**Vi aksepterer:**

- **Ingen ubrutt bar over uke-skillet.** Det er ikke oppnåelig i DOM-en, som drøftet over. Vi bytter «én bar som later som den ikke brytes» mot «segmenter som er tydelige om at de fortsetter». `›` og `↳` er kontrakten.
- **Tittelen gjentas per rad.** For en run over tre uker står tittelen tre ganger. Det er meningen — hvert segment må kunne leses uten kontekst fra raden over.
- **Kolonnelogikken bor i `renderMonth`, ikke i datalaget.** `_isContinuation`/`_isLastDay` settes i `eventsOnDay`/`tasksOnDay` og vet ingenting om grid-oppsett. Rad-posisjon er en rendrings-egenskap, så `i % 7` beregnes der cellene bygges. En fremtidig visning med annen ukelengde må gjøre sitt eget regnestykke.
- **`overflow:hidden`-avhengigheten fra ADR 0014 består** for cellene midt i en rad. Vi har fjernet blødningen der den var skadelig (radkantene), ikke overalt.

**Vi får:**

- Ingen navnløse grå striper. En hendelse over flere uker er lesbar på hver rad den berører.
- Barene slutter der raden slutter, i stedet for å bli klippet i grid-kanten.
- ~30 linjer, ingen nytt rendringspass, ingen resize-lyttere, ingen z-index. Overlay-alternativet fra ADR 0014 er nå formelt forkastet, ikke bare utsatt.

## Alternatives considered

**Overlay-lag med `grid-column: span N` per uke-rad.** Den beste varianten av 0014s reserverte alternativ: et absolutt-posisjonert 7-kolonners grid over hver `.row`, med segmenter plassert via `grid-column`. Gir ekte sammenhengende barer *innenfor* en rad uten pikselmatematikk, og hadde vært et rimelig valg om vi bygget månedsvisningen på nytt. Forkastet nå: løser ikke kryssingen (se Context), krever et andre rendringspass som må holdes i sync med celle-stablingen, og margin-bleed gir alt samme visuelle resultat innenfor en rad.

**Kutt fortsettelsen helt — vis runen bare i uka den starter.** Enklest, og noen kalendere gjør det. Forkastet: en tur som starter fredag og slutter onsdag ville forsvunnet fra uka du faktisk er i.

**Vis `(2/3)`-teller i stedet for `↳`.** Presist, men støyende i en 11,5 px-bar der plassen alt er knapp, og «hvilket segment av hvor mange» er ikke informasjon Maria trenger. `↳` sier «dette fortsetter fra før» som er det som mangler.

**Løs det med `title`-attributtet alene.** Tittelen ligger alt der på hover. Forkastet: hover finnes ikke på iPhone, og problemet var at baren var uleselig *uten* interaksjon.
