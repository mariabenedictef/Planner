# ADR 0042 — Masseredigering av To Do's

**Status:** Accepted
**Date:** 2026-08-13
**Bygger på:** 0037 (`_setDone`), 0039 (angring)

## Context

108 frie To Do's, 23 av dem uten frist. Å gi dem datoer én og én betyr: åpne raden, sett dato, lukk, neste. Tjuetre ganger. Det blir ikke gjort — og oppgaver uten frist er praktisk talt usynlige i Dag, Uke og Måned ([ADR 0038](0038-keyboard-no-date-week-review.md) la til en «uten frist»-bøtte på Hjem nettopp for å avsløre dem, men den viser dem, den rydder dem ikke).

Samme gjelder «disse fem hører til Meox-caset» og «disse tolv er gjort for lenge siden».

## Decision

**En velg-modus i To Do's, slått på fra «☑ Velg flere» i overskriften.**

I velg-modus bytter radene ut draghåndtak, ferdig-boks og handlingsknapper med **én** avkryssingsboks. To avkryssingsbokser side om side — «valgt» og «ferdig» — ville vært umulig å skille på et halvsekunds blikk.

Handlingslinja er `position:sticky` øverst: antall valgt, «Velg alle», frist, prosjekt, «✓ Merk gjort», «× Slett», «Avbryt».

**Utvalget lever utenfor `state`.** `let _selMode` og `const _selIds = new Set()` på modulnivå. Utvalget er arbeidsminne, ikke data: en avkryssing som overlevde en omstart ville vært et gjenferd, og handlingslinja ville operert på noe hun ikke husker å ha valgt. `switchView` nullstiller det — et utvalg som lå og ventet mens hun var på Hjem hører ikke hjemme ved retur.

**Feltene anvendes på `change`, ikke på en «Bruk»-knapp.** Datofeltet har stabil id (`bulk-due`, render-kontrakten i [ADR 0029](0029-render-contract.md)), men en verdi som står og venter på en knapp er en verdi en bakgrunns-render kan rekke å tømme. Endring = handling, så det problemet finnes ikke.

**Tom dato betyr «fjern frist».** Det er den eneste måten å tømme et `<input type="date">`, og «uten frist» er en gyldig tilstand her. `__none__` i prosjekt-nedtrekket betyr «fjern prosjekt».

**«Merk gjort» går gjennom `_setDone`** — én dør for `done`, `doneAt` og `status` (ADR 0037). Uten det ville tolv oppgaver blitt merket ferdige uten tidsstempel, og ukesoppsummeringen hadde ikke sett dem.

**Massesletting beholder `confirm()`** (ADR 0039) og registrerer **én** angring for hele bunken: indeksene fanges før fjerningen og elementene settes inn igjen i stigende rekkefølge, så rekkefølgen blir den samme.

**Hver masseendring avslutter velg-modus.** Handlingen er utført; å stå igjen med de samme radene valgt inviterer til å gjøre det samme en gang til.

**Den fullførte bøtta skjules i velg-modus.** «Velg alle» tar bare åpne oppgaver, og en synlig liste med rader man ikke kan velge er en gåte. Innboksen står igjen — den er ikke oppgaver, og å skjule innhold er verre enn å ha inerte rader.

## Consequences

**Vi aksepterer:**

- **Bare frie To Do's.** Prosjektenes egne underoppgaver er ikke med, selv om de vises i «uten frist» på Hjem. De lever i tretten forskjellige lister; masseredigering på tvers av dem er en større sak.
- **Ingen angring på masseendringer, bare på massesletting.** Setter hun frist på tjue oppgaver og ombestemmer seg, må hun sette dem tilbake. Angring for endringer er nevnt som utsatt i ADR 0039.
- **Full render per avkryssing.** To Do's-visningen rendres på nytt hver gang en rad velges. Målt på hennes datamengde er det ikke merkbart, men det er ikke gratis, og det er samme mønster som resten av appen.
- **Utvalget overlever ikke en sidelasting.** Med vilje.
- **En modus til å huske.** «Velg flere» er et sted man går inn i og ut av. Det er begrunnet: alternativet er avkryssingsbokser på hver rad hele tiden, som gjør den vanlige bruken travlere for å hjelpe den sjeldne.

**Vi får:**

- 29 nye assertions: modus av og på, rader blir valgbare, telleren, velg-alle som veksler, frist på utvalget uten å røre resten, tom dato fjerner frist, prosjekt og «fjern prosjekt», at «merk gjort» faktisk setter `doneAt` og `status`, at massesletting spør, kan angres og gjenoppretter rekkefølgen, at visningsbytte og filterbytte nullstiller modusen, og at chipen i velg-modus velger raden i stedet for å fjerne prosjekt-taggen.
- Visuelt verifisert på desktop og 390 px.

## Alternatives considered

**Avkryssingsbokser permanent på hver rad.** Ingen modus å huske, men to bokser per rad hele tiden og en handlingslinje som må skjules når ingenting er valgt. Gjør normalbruken travlere for å slippe én knapp.

**Shift-klikk for å velge et intervall.** Nyttig med lange lister, men det er museavhengig og usynlig — man må vite om det. «Velg alle» dekker det store tilfellet.

**Dra og slipp flere rader samtidig.** Dra fungerer alt for prioritetsbøttene, men HTML5-dra virker ikke på touch, og frist er ikke noe man kan dra til.

**Et eget «rydd opp»-skjermbilde** som tar oppgaver uten frist én og én i en kø. Fristende for nettopp de 23 — men det er en ny visning for en engangsjobb, og masseredigering løser den samme jobben pluss fire andre.

**Masseredigering også i søkeresultatene.** Der ville filtrering + masseendring vært virkelig kraftig («alt som nevner Gulen → dette prosjektet»). Utsatt: søkeresultatene er en dialog, ikke en liste, og det ville krevd sitt eget utvalg-liv.
