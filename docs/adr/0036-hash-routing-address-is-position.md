# ADR 0036 — Adressen er hvor du er

**Status:** Accepted
**Date:** 2026-08-12
**Bygger på:** 0034 (fanene lander på startsiden)

## Context

«Hvor er jeg» har bodd i lagret state: `state.ui.view` for visningen, `openProjectId` for hvilket prosjekt, `anchor`/`overviewAnchor` for hvilken uke eller måned. Alle er del av den lagrede ui-tilstanden.

Det ga to konkrete problemer, og det andre var en feil vi alt har rettet symptomet på:

1. **Nettleserens tilbakeknapp gjorde ingenting** — eller forlot appen helt. Fra en prosjektside var eneste vei ut «← Tilbake til prosjekter» eller en fane.
2. **Posisjonen kunne overleve steder den ikke burde.** ADR 0034 måtte nullstille `openProjectId` i `switchView` fordi fanen «Prosjekter» ellers førte deg tilbake *inn* i prosjektet du sist hadde åpent — også etter en tur via Hjem, og etter en sidelasting. Det er ikke en tilfeldig feil: når posisjon er en lagret verdi i stedet for en adresse, må hver navigasjonsvei huske å rydde den, og en av dem vil bli glemt.

Dessuten: ingenting kunne bokmerkes eller deles. «Se på Meox-prosjektet» var ikke en lenke.

## Decision

**Hash-ruting, med norske segmenter fordi URL-en er noe hun ser.**

```
#/hjem                        #/dag/2026-08-10
#/prosjekter                  #/uke/2026-08-10
#/prosjekter/p-meox           #/maned/2026-08-10
#/todos                       #/arsoversikt/2026-08-01
```

To rene funksjoner utgjør kontrakten: `_routeFromState()` beskriver tilstanden, `_applyRoute(rute)` setter den. Rundturen er testet som stabil for alle sju visningene.

**1. Adressen vinner ved oppstart.** Er det en hash, gjelder den — så et bokmerke åpner det det peker på. Er det ingen, speiles lagret tilstand inn i URL-en. Kjører før første `render()`.

**2. Bare ekte navigasjonssteg lager historikk.** `switchView`, `openProject` og `backToProjects` pusher. Alt annet — inkludert pilene i kalenderen og et bakgrunns-pull som tegner om — speiler adressen med `replaceState`. Ellers ville hvert ukebytte og hvert 60-sekunders-pull fylt tilbakeknappen med støy, og da er den ubrukelig til det den er til for. Verifisert: tre `render()` på rad gir null nye historikk-oppføringer.

**3. Ingen undertrykkelses-flagg.** `hashchange`-lytteren sammenligner den nye ruten med den tilstanden alt beskriver, og gjør ingenting hvis de er like. En hash vi satte selv er per definisjon lik, så den filtrerer seg bort. Alternativet — et flagg som nullstilles med `setTimeout(…, 0)` — er den vanlige oppskriften, og den er skjør på presis den måten som er vanskelig å teste.

**4. Ukjent adresse avvises, den lander ikke tilfeldig.** `_applyRoute` returnerer `false`, tilstanden står, og adressen skrives tilbake til der man faktisk er. En slettet prosjekt-id i URL-en gir kortrutenettet, ikke en tom side.

**Bevisst utenfor URL-en:** filteret Alle/Jobb/Privat. Det er en preferanse, ikke en posisjon — og å ha det i adressen ville betydd at hver filterbytte enten fylte historikken eller ga en URL som ikke stemte.

**ADR 0034 står, men er nå bedre uttrykt.** «Fanen nullstiller posisjonen» og «fanen navigerer til visningens rot-URL» er samme oppførsel; forskjellen er at den andre formuleringen er strukturelt umulig å glemme for en ny navigasjonsvei, fordi ruten *er* posisjonen.

## Consequences

**Vi aksepterer:**

- **Hash og ikke `history.pushState` med ekte stier.** Ekte stier krever server-omskriving, og GitHub Pages gir ingen. Hash virker overalt, også i PWA-en på iPhone. Kostnaden er at URL-en har en `#`.
- **Pilene i kalenderen kan ikke rygges gjennom.** Bytter man fra uke 33 til uke 34, tar tilbakeknappen deg til forrige *visning*, ikke forrige uke. Det er valgt: alternativet fyller historikken. Kan endres hvis hun savner det.
- **Manifestet har `start_url: "."`,** så PWA-en starter uten hash og bruker lagret posisjon. Det er ønsket oppførsel, men det betyr at ikonet på hjemskjermen ikke kan pekes mot en bestemt visning.
- **Ruten er en offentlig flate nå.** Endres segmentnavnene, brytes hennes bokmerker. `ROUTE_BY_VIEW` er derfor ett sted, og navnene bør ikke endres uten grunn.
- Prosjekt-ID-er blir synlige i adressen (`p-meox`). De er ikke hemmelige, men de er interne — bytter vi ID-format, dør gamle lenker.

**Vi får:**

- Tilbakeknappen virker. Prosjektsider kan bokmerkes og deles.
- 27 nye assertions: rute↔tilstand for alle sju visningene, stabil rundtur, ukjent rute avvist, slettet prosjekt-id degradert til rutenettet, de tre navigasjonsstegene skriver adressen, `hashchange` utenfra bytter visning *og* tegner, og `render()` lager ingen historikk-oppføringer.
- Klassen bak ADR 0034 er lukket, ikke bare instansen: en ny navigasjonsvei arver riktig oppførsel av å bruke ruten.

## Alternatives considered

**Beholde tilstand-som-sannhet og bare fikse tilbakeknappen** med `pushState` på egnede steder. Mindre endring, men da finnes posisjonen på to steder som må holdes i takt — nøyaktig problemet ADR 0034 handlet om.

**Fullverdig History API med stier** (`/prosjekter/meox`). Penere adresser, men krever at serveren sender alt til `index.html`. Pages kan ikke det uten et 404-triks som bytter én skjørhet for en annen.

**Legge filteret og mer UI-tilstand i URL-en.** Mer «komplett», men gir lange adresser som endres hele tiden, og tvinger et valg mellom støy i historikken og en URL som lyver.

**Push også ved pilene i kalenderen.** Mer korrekt i teorien — hvert bytte *er* en navigasjon. Forkastet fordi det gjør tilbakeknappen ubrukelig til det hun ba om: å komme ut av et prosjekt.

**Egen rute for modaler** (`#/todos/ny`), så Esc/tilbake lukker dialogen. Fristende, og det er den naturlige neste utvidelsen. Utsatt: modalene har egne lukke-veier og et `_onModalClose`-kontrakt, og å blande dem med historikken er en egen avgjørelse.
