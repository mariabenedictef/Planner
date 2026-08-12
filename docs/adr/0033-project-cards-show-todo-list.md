# ADR 0033 — Prosjektkortene viser To Do-lista, og kort og prosjektside regner på samme kilde

**Status:** Accepted
**Date:** 2026-08-12
**Utvider:** 0017 (prosjektsiden fletter taggede oppgaver)

## Context

Prosjektkortet viste bare **én** linje om innhold: «Neste:» med den nærmeste datoen fra `projectNextDate()` — som kunne være en oppgave, et delmål eller måldatoen. For å se hva som faktisk gjensto på et prosjekt måtte man åpne det. Maria ba om at To Do-lista skulle stå på kortet, med det som forfaller først øverst.

Under arbeidet dukket en eksisterende inkonsistens opp, og den er grunnen til at denne ADR-en handler om mer enn layout:

- **Kortet regnet på `p.tasks`. Prosjektsiden regnet på `p.tasks` + taggede frie To Do's.** ADR 0016/0017 innførte «tagg, ikke flytt»: en fri To Do kan tagges til et prosjekt og forblir i `state.tasks` med `t.projectId`. Prosjektsiden fletter de to kildene; kortet gjorde det ikke. Så «0/1 oppgaver» på kortet mot fire oppgaver på siden var mulig — og ville blitt åpenbart absurd i det øyeblikket kortet begynte å *liste* oppgavene, siden lista da ville vist tre rader over en teller som sa «0/1».

## Decision

**1. Kortet viser inntil 3 gjenstående To Do's,** tidligste frist først, resten bak «+N mer».

- **3**, fordi kortene da beholder omtrent dagens høyde og rutenettet med fire kort per rad står rolig. Målt: 253 px med liste mot 160 px uten.
- **Bare gjenstående.** Fremdriften ligger allerede i fremdriftslinja og i «x/y oppgaver»; å bruke kortplassen på det som er gjort er å bruke den på det minst nyttige.
- **Samme sortering som prosjektsiden** (`_dateThenOrderCmp`): dato først, uten frist sist, deretter manuell rekkefølge. Ikke en egen sortering på kortet — da ville rekkefølgen sprikt mellom kort og side.
- **Forfalt frist er rød og halvfet.** Det er den ene tilstanden som krever handling.
- **Radene har ingen egen handling,** så et klikk hvor som helst på kortet åpner prosjektet som før.
- Titler kappes på én linje med ellipse, og datokolonnen har fast bredde, så titlene flukter fra rad til rad.

**2. «Neste:»-linja vises ikke når den gjentar noe lista alt viser.** Delmål (`◆`) beholdes — de står ikke i To Do-lista. Måldatoen var allerede unntatt.

**3. `projectTasksMerged(p)` er nå den ene kilden** til «hvilke oppgaver hører til dette prosjektet», brukt av prosjektsiden, kortlista, tellerne og `projectProgress()`. Flettingen lå tidligere inline i `renderProjectTasks`.

**Konsekvens som er verdt å si høyt:** tellerne på kortene endrer seg. Et prosjekt med taggede To Do's viser nå et høyere tall enn før — «1/6 oppgaver» der det sto «1/4» — og fremdriftslinja flytter seg tilsvarende. Ingen data er endret; kortet sluttet bare å underrapportere.

## Consequences

**Vi aksepterer:**

- Kortene blir høyere når prosjektet har To Do's, og rader med og uten lister får ulik høyde. Innenfor en rad strekker rutenettet kortene likt, så det leses som to rader, ikke som rot.
- Grensen på 3 er et valgt tall, ikke et utledet. Endres den, endres kortenes høyde og dermed hvor mye som er synlig uten å rulle.
- Lange titler kappes. Hele tittelen finnes på prosjektsiden; kortet er en oversikt, ikke en fullstendig liste.
- Kanban-visningen på prosjektsiden viser fortsatt **bare** `p.tasks` — taggede To Do's mangler der. Det er en eksisterende avvik som ikke ble innført her (drag-and-drop-handlerne er skrevet for prosjektets egne oppgaver), men det står nå igjen som det siste stedet som ikke bruker `projectTasksMerged`. Notert som neste steg, ikke fikset.

**Vi får:**

- Det som forfaller først på hvert prosjekt er synlig uten å åpne noe.
- 17 nye assertions, alle verifisert til å feile mot forrige commit — inkludert at taggede To Do's er med, at fullførte ikke er det, at «+N mer» teller riktig, at forfalt markeres, at tellerne stemmer med lista, og at titler escapes.
- Visuelt verifisert i både lyst og mørkt tema med skjermbilder, ikke bare i DOM-en.

## Alternatives considered

**Vise alle To Do's.** Ingenting skjules, men et prosjekt som Dealflow med seks oppgaver gir et kort dobbelt så høyt som naboen, og rutenettet blir ujevnt. Forkastet.

**5 rader.** Mer oversikt, men kortene ble merkbart høyere uten at de to ekstra radene var de viktigste — det som forfaller først er poenget.

**Bare prosjektets egne oppgaver.** Enklere, og ville ikke rørt tellerne. Forkastet fordi kortet da ville vist noe annet enn prosjektsiden for nettopp de prosjektene der Maria bruker tagging — altså der avviket er mest forvirrende.

**Vise fullførte utstreket nederst.** Gir historikk, men bruker den knappe kortplassen på det som ikke krever noe.

**Gjøre radene klikkbare** (åpne den enkelte To Do'en). Fristende, men da må hver rad stoppe klikk-bublingen, og et bomklikk på kortet ville åpnet en oppgave i stedet for prosjektet. Kortet har én handling: åpne prosjektet.
