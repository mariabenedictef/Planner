# ADR 0049 — Ett oppgavelager bak `version: 5`, og én dør inn i state

**Status:** Accepted
**Date:** 2026-09-17
**Bygger på:** 0016/0017 (tagging), 0022 (state degraderer aldri stille), 0033/0037 (`projectTasksMerged`), 0039 (`deleteWithUndo`), 0045 (prosjektoppgaver i To Do's)
**Supersedes i praksis:** modelldelen av 0045 — bøtta består, «to lagre som må møtes» gjør ikke

## Context

Oppgaver bodde to steder. Frie To Do's i `state.tasks`, prosjektenes egne underoppgaver i `p.tasks` på hvert prosjekt. Skillet er meningsfullt — en fri To Do tagget til et prosjekt hører hjemme i prioritetsbøttene, en underoppgave hører hjemme i prosjektet — men det var kodet som **plassering** i stedet for som **felt**.

Prisen kom hver gang en visning skulle svare på «hva finnes?». [ADR 0033](0033-project-cards-show-todo-list.md) kom av at prosjektkortet bare leste `p.tasks` mens siden viste begge. [ADR 0037](0037-kanban-merges-tagged-tasks.md) kom av at brettet hadde samme feil. [ADR 0045](0045-project-tasks-in-todos.md) måtte lage `projectTodoGroups()` for å få den andre veien. Tre ADR-er om samme sak: en ny visning glemmer å spørre det andre lageret.

Kartleggingen fant **92 kallsteder** som rørte ett eller begge lagrene, og **to parallelle opprinnelsesmarkører** — `_origin` satt i `projectTasksMerged`, og `data-task-kind` i DOM — som betydde det samme.

Og ett funn som avgjorde rekkefølgen på arbeidet:

> **Fire innlastingsstier satte `state` uten å gå veien om `loadState`.** `pullFromRemote`, `restoreCloudBackup`, `_mergeSnapshot` og `resetAll` gjorde `Object.assign(structuredClone(DEFAULT_STATE), blob)` — altså **ingen migrering**. Så lenge formatet ikke hadde endret seg siden migreringene ble skrevet, var det latent. Med et nytt lagringsformat ville et blob fra skyen eller en lokal backup lagt seg inn med oppgavene på gammel plass og blitt usynlige.

## Decision

**Ett lager: `state.tasks`. Et persistert felt `kind` sier hvor oppgaven hører hjemme.**

- `kind: 'sub'` — prosjektets egen underoppgave, alltid med `projectId`
- `kind: 'free'` — fri To Do, kan være tagget til et prosjekt med `projectId`

**Feltet er lagret, ikke utledet.** En tagget fri To Do og en underoppgave i samme prosjekt har begge `projectId` satt. Det finnes ingen egenskap ved dataene som skiller dem — bare intensjonen da oppgaven ble laget. Den må lagres.

**Tre dører inn i lageret:**

```js
_taskById(id)          // ett oppslag, uansett slag — erstatter 30 spredte .find()
_freeTasks()           // alt som ikke er kind:'sub' — bøttene, Hjem, søk, ukesoppsummering
_projectSubtasks(pid)  // ett prosjekts egne, i lagerrekkefølge
```

`projectTasksMerged(p)` gikk fra å slå sammen to kilder til å filtrere én, med rekkefølgen bevart (egne først, taggede etter) slik at prosjektsiden og kortet ser ut som før. `deleteWithUndo` tar `()=>state.tasks` for begge slag; `_projectArr(pid,'tasks')` finnes ikke lenger, funksjonen lever videre for delmål, personer, lenker og notater.

**`migrateState(parsed)` er den ene døren inn i state, og alle fire stiene går gjennom den.** Funksjonen er idempotent — et v5-blob kommer uendret ut — og den kopierer inndataene først, så kalleren ikke får objektet sitt endret under føttene.

**`STATE_VERSION` 4 → 5.** Migreringen flytter hver `p.tasks`-oppgave inn i `state.tasks` med `kind:'sub'` og `projectId`, merker resten `kind:'free'`, sletter `p.tasks`, og fjerner de åtte døde feltene `goals`, `habits`, `themes`, `quarterly`, `yearFocus`, `quarterFocus`, `monthFocus` og `reviews`. `goals` leses fortsatt som migreringskilde for gamle blobs før den slettes.

**Engangs sikkerhetsnett:** første gang et blob med versjon < 5 lastes, skrives de rå bytene til `planlegger.preV5.<ISO>` før migreringen rører noe. Ett øyeblikksbilde, ikke ett per last. Feiler skrivingen, fortsetter lastingen — nettet er en bonus, ikke en forutsetning, og feilen er hørbar i konsollen ([ADR 0022](0022-state-never-degrades-silently.md)).

## Consequences

**Vi aksepterer:**

- **Migreringen rører alle oppgavedataene hennes.** Det er derfor den er verifisert mot en ekte eksport før den ble skrevet tilbake (tall under), og derfor øyeblikksbildet finnes.
- **En v4-klient som puller et v5-blob plasserer prosjektoppgavene feil.** Telefonen kjører gammel `app.js` til den henter ny. Den vil se underoppgavene i prioritetsbøttene og prosjektene som tomme, og kan skrive det tilbake. **Telefonen må lastes på nytt før den brukes etter denne pushen.** Vi kan ikke lappe en klient som allerede er ute; dette er prisen for et formatskifte i en app som synkroniserer.
- **`kind` må settes ved hver ny oppgave.** Ni skrivesteder gjør det nå eksplisitt. Glemmes det, havner oppgaven blant de frie — feil, men ikke tapt, og migreringen setter `'free'` på alt som mangler feltet.
- **Suiten måtte skrives om der fixturene beskrev v4-formatet.** Ti fixturer og ni testinterne oppslag. En grønn suite etter at både kode og tester er endret beviser mindre enn vanlig — det er derfor seksjon 38 og differansetesten mot ekte data finnes.

**Vi får:**

- **Migreringen verifisert mot Marias egen eksport** (`backups/planlegger-2026-05-26.json`, 693 kB, versjon 3): 65 frie + 39 underoppgaver i 11 prosjekter → **104 oppgaver i ett lager**, 0 id-er tapt, 0 felttap på underoppgavene, 0 prosjekter med `tasks`-felt igjen, 0 døde felter igjen, idempotent på andre gjennomkjøring.
- `tests/run.mjs` 495 → **529** assertions. **34 feiler mot forrige commit**, og gammel kode klarer ikke engang å lese v5-fixturene i to seksjoner — krasjet er i seg selv funnet.
- Feilklassen bak 0033, 0037 og 0045 er borte. En ny visning kan ikke lenger glemme det andre lageret, fordi det ikke finnes.
- Fire innlastingsstier som aldri migrerte, migrerer nå. Det var en latent feil før dette, uavhengig av v5.

## Alternatives considered

**La lagrene stå og fortsette å møte dem i dørene.** Billigst, og 0045 viste at det går. Forkastet: tre ADR-er på fire måneder om samme glemte spørring er et mønster, ikke uflaks. Dørene måtte uansett vedlikeholdes, og hver ny visning betaler avgiften på nytt.

**Utlede `kind` av dataene i stedet for å lagre det** — for eksempel «har `priority` ⇒ fri». Forkastet: en fri To Do uten prioritet er nøyaktig det «Ukategorisert»-bøtta er full av, så regelen ville feilklassifisert hennes faktiske data. En utledet regel som er feil er verre enn et felt som er stygt.

**En ikke-tellbar `get tasks()` på prosjektobjektet, så alle 92 kallstedene virket videre.** Lesningene ville fungert uendret og aldri blitt lagret. Forkastet umiddelbart: skrivingene (`p.tasks.push(...)`) ville gått rett i tomme luften, uten feilmelding. Det er akkurat feilklassen «stillhet er ikke suksess» — og det ville vært en skjult dør nummer to inn i lageret, som er det denne ADR-en fjerner.

**Gjøre v5-migreringen i en egen runde, etter CSS- og ICS-arbeidet.** Det var min anbefaling. Maria valgte alt i én runde, med backup og differansetest mot ekte data som betingelse. Rekkefølgen innenfor runden ble likevel økende sprengkraft — stilark, så ICS, så datamodellen — med egen validering mellom hvert steg.
