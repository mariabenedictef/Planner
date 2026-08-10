# ADR 0018 — Store render-visninger splittes i seksjons-helpere

**Status:** Accepted
**Date:** 2026-08-10

## Context

`renderHome` hadde vokst til 226 linjer og gjorde alt selv: data-forberedelse (`activeProjects`, `urgent`, `todayTasks`), greeting-utregning, HTML-generering for fem seksjoner (Urgent, Forfaller-i-dag, Kalender-uken, Aktive prosjekter, Quick-capture), DOM-innsetting via `viewEl.innerHTML`, wiring av quick-capture-Enter-listener, og drag-og-slipp-reorder for Urgent-lista.

Konkret smerte:

- Å endre én seksjon (f.eks. legge til en knapp i quick-capture) krevde skanning av hele funksjonen for å finne den relevante template literalen midt inne blant fire andre.
- Datamodell-avhengigheter var blandet med rendring — det var uklart hva «Urgent-lista» faktisk avhenger av (svar: `state.tasks` + `passesFilter` + manuell rekkefølge).
- Rekkefølgen på seksjoner ble bestemt inne i én mega-template — vanskelig å eksperimentere med.
- Testing var alt-eller-ingenting: kunne ikke asserte «Aktive prosjekter-seksjonen skjules når lista er tom» uten å bygge et helt `state`.

Andre store render-funksjoner (`renderProject`, `renderTodos`, `renderWeek`, `renderMonth`) har samme struktur og samme problem. Vi vil ikke løse dette per-funksjon på ad-hoc-basis; vi trenger et etablert mønster.

## Decision

**Store render-funksjoner splittes i seksjons-helpere.** Hver render-visning som er over ca. 100 linjer eller har to eller flere logisk uavhengige seksjoner brytes opp i:

- Én hovedfunksjon (`renderX`) som gjør *bare* data-forberedelse, komponerer HTML fra hjelperne, setter `viewEl.innerHTML`, og kaller post-render-wiring.
- En seksjons-helper per underseksjon, med signatur `_xSeksjonHTML(...forberedt data)` som returnerer en HTML-streng. Ingen state-lookups inne i hjelperen — data sendes inn som parametere.
- En separat post-render-wiring-hjelper (`_wireX(...)` eller lignende) hvis seksjonen trenger event-listeners på nyskrevet DOM.

**Konvensjoner:**

- Underscore-prefiks på alle helpernavn (`_homeUrgentHTML`, `_wireUrgentDragReorder`) signaliserer at de er interne til den ene render-funksjonen.
- Hjelperne er *rene* når det er praktisk mulig: input inn, HTML ut. `_homeActiveProjectsHTML([])` returnerer tom streng — hovedfunksjonen konkatenerer ubetinget.
- Hjelperne bor i samme fil som render-funksjonen sin, rett over den, i rekkefølgen de kalles i.
- Hovedfunksjonen skal ideelt være under 70 linjer og lesbar som en «script» over hva som skjer.

**Første implementasjon (2026-08-10) — `renderHome` splittet i:**

- `_homeUrgentHTML(urgent, todayK)` — Urgent-panel + drag-handle-markering
- `_homeTodayTasksHTML(todayTasks, todayK)` — Forfaller-i-dag
- `_homeWeekHTML(today)` — 7-kolonne uke-grid inkl. ISO-uke-tittel og helligdag-markering
- `_homeActiveProjectsHTML(activeProjects)` — 30-dagers countdown-kort (returnerer `''` når lista er tom)
- `_homeQuickCaptureHTML()` — quick-capture-input + Dumpefelt-knapp
- `_wireUrgentDragReorder()` — post-render dragstart/dragover/drop-listeners for Urgent-radene

`renderHome` er nå ~55 linjer og gjør bare fire ting: samle data (`activeProjects`, `urgent`, `todayTasks`), sette greeting, komponere `viewEl.innerHTML` fra hjelperne, og kalle quick-capture-listener + `_wireUrgentDragReorder()`.

## Consequences

- **Pros**
  - Å endre én seksjon krever nå bare å finne én ~20-linjers hjelper. Ingen distraksjon fra søsken-seksjoner.
  - Rekkefølgen på seksjoner er nå eksplisitt: én kolonne av `${_homeX()}`-kall i hovedfunksjonen. Bytte rekkefølge på seksjoner er én linje.
  - Tomtilstand-håndtering flyttes inn i seksjonen som eier den (jf. `_homeActiveProjectsHTML([])` → `''`). Hovedfunksjonen slipper å vite hva som skjuler seksjonen.
  - Testbart: hver hjelper kan kalles direkte i jsdom med syntetisk input, uten å bygge hele `state`. Se test.html §13 lagt til samme dag som denne ADR-en.
  - Etablerer mønster som `renderProject`/`renderTodos`/`renderWeek`/`renderMonth` kan følge når de blir tunge nok.
- **Cons / risks**
  - **Flere funksjoner å bla mellom.** For små render-funksjoner (`renderList`, `renderOverview`) er splitting overkill — det innfører fragmentering uten gevinst. Terskelen er ca. 100 linjer eller >=2 logisk uavhengige seksjoner.
  - **Post-render-wiring kan lett bli glemt.** `_wireUrgentDragReorder()` må kalles i hovedfunksjonen *etter* `viewEl.innerHTML`-tildelingen. Hvis en fremtidig endring bruker `render()`-funksjonen istedenfor `viewEl.innerHTML =`, må wiring-kallet flyttes. Kommentaren over `_wireUrgentDragReorder` peker på dette.
  - **Data-forberedelse forblir sentralisert i hovedfunksjonen** — det er både bra (én kilde) og en risiko (hjelperne får ikke tilgang til data som ikke ble sendt inn). Hvis en hjelper trenger `state.projects.find(...)`, må hovedfunksjonen sende inn resultatet. Testet i praksis — ingen hjelper trengte state-lookup enda.
  - **Wiring-hjelpere bryter «input inn, output ut»-mønsteret** — de leser `document`-globalt for å finne det nyskrevne elementet. Akseptabelt fordi wiring per definisjon jobber med DOM. Ikke prøv å gjøre dem rene.

## Alternatives considered

- **Delvis extraction — bare Urgent-seksjonen.** Ville løst det mest smertefulle stedet (drag-reorder-wiring), men latt de andre fire seksjonene være innblandet i hovedfunksjonen. Rejected fordi mønsteret ikke ville vært etablert — neste person (inkludert Claude i en fremtidig sesjon) ville vært usikker på hvor grensen går.
- **Flytte hjelperne til egne filer.** For tidlig. Vi har fortsatt bare én app.js (ADR 0013 splittet ut js fra html; en videre splitt til flere js-filer krever build-step eller ES-modul-import, som er en annen diskusjon). Underscore-prefiks + samme fil er nok isolasjon nå.
- **Class-basert komponent-refactor** (a la React uten React). Ville krevd fundamental omskriving av HANDLERS-dispatch-mønsteret (ADR 0012). Enormt utenfor scope for en refactor som ikke endrer adferd.
- **Lambda-uttrykk inline istedenfor navngitte hjelpere** — `const urgentHTML = (() => { ... })();`. Rejected fordi navngivningen er halvparten av gevinsten: `_homeActiveProjectsHTML` er selvdokumenterende på en måte som et anonymt IIFE ikke er.

## Related ADRs

- **[ADR 0012](0012-event-delegation.md)** — HANDLERS-dispatch. Wiring-hjelperne bruker fortsatt inline event-listeners (dragstart/dragover/drop) og ikke HANDLERS, fordi disse er lokal dra-og-slipp som lever kun mens seksjonen er rendret.
- **[ADR 0013](0013-split-js-into-sidecar.md)** — splittet js ut fra html. ADR 0018 er samme prinsipp anvendt innenfor `app.js` selv: bryt opp store enheter, i samme fil.

## Follow-up

- Anvende samme mønster på `renderProject` og `renderTodos` når de neste gang trenger endringer — ikke som eget refactor-arbeid uten motivasjon.
- Legge til en note i CONTEXT.md om at «render-hjelpere med underscore-prefiks er interne til den ene render-funksjonen». Gjort i samme change-set.
