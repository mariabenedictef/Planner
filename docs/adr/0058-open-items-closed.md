# ADR 0058 — Det utestående fra 0055–0057: beskjedstabel, knapperad over raden, ingen emoji

**Status:** Accepted
**Date:** 2026-10-01
**Bygger på:** 0039 (én toast om gangen), 0041 (prosjektfarge), 0050 (mobilmodellen), 0055 (telefonradens budsjett), 0056/0057 (designsystemet)
**Erstatter delvis:** 0039 og 0057 om toasts (én om gangen / vanlig beskjed venter)

## Context

Etter ADR 0057 sto seks ting som uløst — tre fra den runden og tre «bevisst åpne» fra 0055/0056. Maria ba om at alle skulle løses, og valgte selv hvordan to beskjeder samtidig skal oppføre seg: **stables, maks to**.

1. **Prioritetsprikkene i hover-raden hadde ikke ord** (0057). Ordene fikk ikke plass — og grunnen var et større funn: **knapperaden på PC holdt av 618 px i hver rad, også når den var usynlig** (`opacity:0`, men i flyten). Titlene fikk 546 av 1 200 px og ble brutt etter halv bredde, for knapper som bare vises ved hover.
2. **En vanlig beskjed kunne vente opptil 15 s bak en advarsel** (0057s løsning på at backup-beskjeden visket ut en advarsel).
3. **Beskjedene dekket +-knappen på telefonen** — toasten sto 80 px opp, +-knappen 76–128 px.
4. **Prosjektchipene var tonede piller** (0041), det eneste fargefylte i radene etter 0056.
5. **Emoji sto igjen** — 📧 på Outlook-hendelser (fra CSS), 📍 på prosjektdatoer, 📌 på egne heldagshendelser, og 💾 💡 🖼 🕒 🎤 📅 🗓 📆 🧭 🔗 i beskjeder, knapper og «Mer»-menyen — over 20 steder.
6. **En oppgave uten dato hadde ikke «i dag» med ett trykk på telefonen** (0055). En «+ i dag»-chip i raden ble målt til å løfte median radhøyde fra 80 til 99 px.

## Decision

**Beskjedene bor i en stabel med plass til to** (`#toast-stack`, `role="status"`, `aria-live="polite"`). Nyeste øverst. Reglene:
1. En beskjed med **samme handling** (angre, last på nytt) eller **samme tekst** byttes ut. Det finnes bare ett angrepunkt (ADR 0039), så en eldre angre-knapp ville vært død.
2. Blir det mer enn to, går **den eldste vanlige beskjeden** først. Advarsler (⚠) og beskjeder med knapp står til de har stått sin tid.

Ingenting venter lenger, og ingenting forsvinner før det er lest. `_toastWarnUntil` fra 0057 er fjernet.

**På telefon står stabelen over +-knappen** — `bottom: calc(140px + safe area)`, full bredde minus 16 px på hver side. +-knappens topp er 128 px opp.

**På PC med mus legger knapperaden seg over raden** i stedet for å holde av plass: `position:absolute` til høyre, vist ved hover og tastaturfokus (`:focus-within`), med en 32 px myk overgang fra radflaten (`--row-bg` følger hover og stjernemerking). **Titlene går fra 546 til 1 174 px.** Nå får prioritetsknappene ordene: «● Urgent», «● Short term», «● Long term», «○ Ingen». Prosjektvalget er kappet til 130 px. Gjelder bare `(hover:hover) and (min-width:701px)` — telefon og nettbrett har ikke hover og beholder den vanlige raden. Innboksen, der knappene alltid vises, er uendret.

**Prosjektchipen er prikk og navn**: 6 px prikk i prosjektets farge (`--pc-h`, ADR 0041) og navnet i `--ink-soft`, 12 px. Ingen flate, ingen kant. Kontrasten er dermed den samme for alle prosjekter i begge temaer. Ved hover (klikk fjerner taggen) blir den rød og overstreket.

**Ingen fargede emoji i det appen tegner.** Outlook-hendelser kjennes på tonen og den blå streken. Prosjektdatoer i kalenderen får **◆**, samme rombe som delmål i To Do's (`EV_MS`), dempet. Egne heldagshendelser har ingen markør. Beskjeder, «Mer»-menyen og knapper er bare tekst; lenkeknappen i notatverktøylinja heter «Lenke». Ensfargede tegn som bærer betydning (⚠ i advarsler, ★ ☆, ✎ ×, ◆, ✓) står.

**Hurtigdatoer under fristfeltet** i oppgaveskjemaene (fri oppgave og prosjektoppgave): «I dag», «I morgen», «Om en uke», «Ingen frist». De skriver bare i feltet; «Lagre» lagrer som før. For en oppgave uten dato på telefonen er «i dag» nå **to trykk** (✎, «I dag») — uten å koste raden en piksel. `HANDLERS.setDateInput` er ny (111 handlere).

## Consequences

**Vi aksepterer:**

- **Knapperaden dekker høyre ende av lange titler mens musa er over raden.** Det er hele poenget: plassen er titlens når hun leser, knappenes når hun handler. Fristen og prosjektchipen i en svært lang tittel kan ligge under knappene akkurat da — «I dag»-knappen og ✎ er der.
- **To beskjeder kan stå samtidig** og dekke mer av hjørnet i noen sekunder. Det er valgt framfor at en av dem venter eller forsvinner.
- **«I dag» for en oppgave uten dato er to trykk på telefonen, ikke ett.** Ett trykk ville krevd en ny kontroll i raden, og det er målt at raden ikke har råd (0055).
- **Kalenderen er fortsatt 11 px der den er tett** (0056). Det står som et valg, ikke en mangel: det består kontrastkravet, og større tekst ville klippet titlene i rutenettet.

**Vi får:**

- Titler som bruker hele raden på PC.
- Ord på prioritetsknappene der det er mus, prikker der det er tommel.
- Beskjeder som aldri skjuler hverandre eller +-knappen.
- Ingen emoji igjen — samme rolige tegnsett overalt.

## Verifisering

- `tests/run.mjs`: 699 → **710**, grønt i UTC og Europe/Oslo. Nye: stabelen (advarsel + vanlig samtidig, nyeste øverst, tredje skyver ut eldste vanlige og ikke advarselen, ny angre bytter ut forrige, samme tekst blir én, alt bor i stabelen), hurtigdatoene (i dag, +7, tom, i begge skjemaene), ingen fargede emoji i `app.js` eller stilarket. **Mot forrige versjon feiler 10.**
- **Én test snudd** (den sjette i prosjektet): 0057s «vanlig beskjed venter til advarselen har stått ferdig» er nå «står samtidig» — Marias valg. **Én justert:** «bare én toast i DOM om gangen» er nå «bare én angre-toast» + «aldri mer enn to» — det den vokter (ingen død angre-knapp) er det samme.
- `tests/ics.mjs`: 80/80. `tests/browser.mjs`: 43/43 — kontrastrevisjonen 0 brudd, telefonraden uendret (tittel 152 px, median 79 px).
- Målt i Chromium på PC (1 280 px): tittel 546 → 1 174 px; knapperaden 618 → 793 px, utenfor flyten. Telefon (390 px): stabelens underkant 140 px opp, +-knappens topp 128 px.
