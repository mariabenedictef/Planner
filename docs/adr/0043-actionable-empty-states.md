# ADR 0043 — Tomme tilstander som fører videre

**Status:** Accepted
**Date:** 2026-08-13

## Context

Tretti-to tomme tilstander i appen, alle rene konstateringer: «Ingen delmål satt», «Ingen personer registrert ennå», «Ingen lenker lagret ennå», «Ingen oppgaver forfaller i dag». De forteller hva som mangler, men ikke hva man gjør med det. Tomme tilstander er dessuten det første en ny seksjon viser — de er *introduksjonen* til funksjonen, og de var blindveier.

## Decision

**En knapp der det finnes en åpenbar neste handling.**

```js
emptyAction(label, attrs)   // '' hvis noe mangler; ellers <div class="es-act"><button class="es-btn" …>
HANDLERS.focusField(id)     // setter markøren i et felt som alt står på siden
```

To slag handling:

- **Åpner et skjema** — «+ Ny oppgave» på Hjem og i Dag (`openTaskFormWithDate` med dagens dato), i prosjektets oppgaveliste og på kanban-brettet (`openProjectTaskForm`).
- **Peker på et felt som alt er der** — «+ Legg til person», «+ Legg til lenke». Skjemaet står rett under lista; det er bare ikke åpenbart. `focusField` ruller det til syne og setter markøren.

En test sjekker at hver `focusField`-knapp peker på en id som **faktisk finnes i DOM** når knappen rendres. Ellers er den en knapp som ikke gjør noe — «stillhet er ikke suksess» i sin billigste form.

### Hvilke tomme tilstander som *ikke* fikk knapp

- **«Ingen urgent-saker — godt jobba»** er ikke et problem som skal løses. En «+ Ny urgent-sak»-knapp der er en fornærmelse.
- **«ren boks»** i prioritetsbøttene er et slippområde, ikke en blindvei — og det står fire av dem på samme skjerm.
- **«Ingen kommende nøkkeldatoer»** har ingen entydig handling: en nøkkeldato kan være et delmål, en måldato eller en hendelse.
- **Delmålseksjonen** rendrer en annen gren når lista er tom, med sin egen «+ Legg til delmål (valgfritt)»-knapp. Den tomme tilstanden i `renderProjectMilestones` er derfor uoppnåelig, og er merket som ren forsvarslinje i koden — en knapp der ville pekt på et felt som ikke står på siden i den grenen.

## Consequences

**Vi aksepterer:**

- **`focusField` er en tett kobling mellom en tekst og en id.** Endrer noen `id="pp-name"`, blir knappen stum. Derfor testen som slår opp id-en i DOM.
- **Ikke alle 32 fikk knapp.** Ni av dem er dekket her; resten er enten positive («godt jobba»), slippområder, eller uten entydig handling. En knapp på hver av dem ville gjort «tom» til den travleste tilstanden i appen.
- **`.es-btn` er en knappestil til.** Den låner fra de eksisterende sekundærknappene men er sin egen klasse, fordi den står inne i kursiv, dempet tekst og må bryte ut av den.

**Vi får:**

- 9 nye assertions, inkludert at hver `focusField`-knapp peker på et felt som finnes, og at `focusField` på en ukjent id ikke kaster.

## Alternatives considered

**Illustrasjon eller ikon i tomme tilstander.** Vanlig i moderne apper. Forkastet: appen er bevisst dempet og typografisk (se `user_role`-notatet), og en illustrasjon i hver av 32 tomme bokser er mye visuell støy for lite informasjon.

**Forklarende hjelpetekst i stedet for knapp** («Delmål er milepæler underveis mot måldatoen»). Nyttig én gang, støy for alltid etterpå — og hun har brukt appen i månedsvis. Knappen er nyttig hver gang.

**Skjule tomme seksjoner helt**, som «uten frist» på Hjem gjør (ADR 0038). Riktig når seksjonen er *tillegg*; galt for personer og lenker på en prosjektside, der fraværet av seksjonen ville skjult at muligheten finnes.

**Åpne dialog i stedet for å fokusere feltet** for personer og lenker. Konsistent med oppgaver, men det er å bygge et skjema for noe som alt har ett — to felt og en knapp, rett under lista.
