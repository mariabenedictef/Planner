# ADR 0052 — Masseredigering når underoppgavene, delmål gjennom `_setDone`, angring i skjemaet

**Status:** Accepted
**Date:** 2026-09-21
**Bygger på:** 0037 (`_setDone` som eneste dør), 0042 (masseredigering), 0045 (prosjektoppgaver i To Do's), 0049 (ett oppgavelager), 0051 (angring for endringer)

## Context

Tre punkter sto igjen på restlista etter ADR 0051. De ser ut som tre løse tråder, men de er samme tråd: **en dør som ble bygget for ett slag oppgave, og aldri utvidet da det andre slaget kom.**

1. **Velg-modus så bare frie oppgaver.** ADR 0045 la prosjektenes underoppgaver inn i To Do's under bøtta «Fra prosjekter», og ADR 0049 flyttet begge slag inn i samme lager. Men `_selectableTasks` sto uendret siden ADR 0042 og leste `_freeTasks()`. Resultatet var ikke en feilmelding — det var at velg-modus **skjulte hele bøtta** (`${_selMode ? '' : projectTodosBucketHTML()}`), fordi radene der ikke kunne velges uansett. Hun så en side som mistet en tredjedel av innholdet i det hun trykket «Velg», og ingenting sa hvorfor.

2. **Delmål gikk utenom `_setDone`.** ADR 0037 gjorde `_setDone` til eneste dør inn til «ferdig» nettopp fordi fire steder satte `t.done` direkte. `toggleProjectMilestone` var et femte, og CONTEXT.md beskrev det som bevisst: delmål står ikke på kanban-brettet, så de trenger ikke `status`. Det argumentet holder for `status`. Det holder **ikke** for `doneAt` — og konsekvensen var stille: ukesoppsummeringen sorterer «gjort denne uka» på `doneAt`, så et avkrysset delmål dukket aldri opp der. Det økte bare telleren «gjort uten tidsstempel», som ser ut som gamle data fra før 2026-08-12.

3. **Angring dekket masseredigering, ikke skjemaet.** ADR 0051 skrev det selv, som en akseptert konsekvens: «Å endre én oppgave i skjemaet kan fortsatt ikke angres.» Begrunnelsen var at masseoperasjonene er de som gjør skade på ett klikk. Men maskineriet fantes allerede etter 0051 — `_snapshotFields` + `registerFieldUndo` — og `saveTaskForm` gjør `Object.assign(ex, data)`, som overskriver **alt skjemaet dekker** på én gang. Det er ikke mindre uopprettelig enn en massefrist; det er bare én rad om gangen.

## Decision

**`_selectableTasks` leser hele lageret, og spør filteret riktig per slag.**

```js
function _selectableTasks(){
  return (state.tasks || []).filter(t => {
    if (!t || t.done) return false;
    if (t.kind === 'sub'){
      const p = (state.projects || []).find(x => x.id === t.projectId);
      return !!p && !p.archived && passesFilter(p);
    }
    return passesFilter(t);
  });
}
```

Skillet i midten er hele poenget: **en underoppgave har ingen egen `category`, den arver prosjektets** (ADR 0049). Å kjøre `passesFilter` på selve underoppgaven ville skjult alle sammen under både Jobb og Privat — en tom bøtte, ingen feil. Samme regel som `projectTodoGroups` allerede brukte, arkiverte prosjekter utelatt begge steder. `_selectedTasks` leser tilsvarende hele lageret, og `projectTaskRowHTML` har fått samme velg-modus-gren som de frie radene: én avkryssingsboks, ingen handlinger. `renderTodos` viser bøtta i velg-modus nå.

**«Fjern prosjekt» skjules når utvalget inneholder en underoppgave.** En `kind:'sub'` uten `projectId` er hjemløs — den vises verken i prioritetsbøttene (de leser `kind:'free'`) eller under «Fra prosjekter» (som grupperer på prosjekt). Valget er fjernet fra nedtrekket når utvalget inneholder en underoppgave, **og** `bulkSetProject` avviser `__none__` med en forklarende toast om noen kaller handleren direkte. To lag, fordi det første er kosmetikk og det andre er invarianten.

**`_setDone(t, done, opts)` har fått ett navngitt unntak,** og `toggleProjectMilestone` går gjennom det:

```js
_setDone(m, !m.done, { skipStatus: true });
```

Delmålet får nå `doneAt` som alt annet. `status` settes fortsatt ikke, fordi det er et kanban-begrep og delmål ikke står på brettet — å gi dem et status-felt ville vært å legge tilbake nettopp den typen døde felt ADR 0049 ryddet bort. Forskjellen på dette og den gamle femte døra er at unntaket er **navngitt, dokumentert og har ett kallsted**: `_setDone` er fortsatt eneste sted som vet hva «ferdig» betyr.

**Angring for enkeltredigeringer** i både `saveTaskForm` og `saveProjectTaskForm`:

```js
const snap = _snapshotFields([ex], Object.keys(data));
Object.assign(ex, data);
registerFieldUndo(snap, Object.keys(data), `«${ex.title}»`, 'Endret');
```

Øyeblikksbildet tas **før** tilordningen og dekker bare feltene skjemaet faktisk rører — `Object.keys(data)`, ikke hele objektet. Gjenopprettingen slår opp på `id` (ADR 0039/0051), så et sky-pull mellom endring og angring ikke gir en frakoblet referanse. `had`-lista skiller fortsatt «feltet var tomt» fra «feltet fantes ikke», så angringen kan fjerne en frist som ikke var der før redigeringen.

## Consequences

**Vi aksepterer:**

- **Én masseoperasjon kan nå treffe to slag oppgaver samtidig.** Velger hun alt og setter frist, får både frie To Do's og prosjektunderoppgaver den fristen. Det er det hun ba om ved å velge dem, men det krysser en grense appen har holdt siden ADR 0016 — og en underoppgave som plutselig har frist dukker opp i kalenderen der den ikke sto før.
- **«Fjern prosjekt» forsvinner fra nedtrekket uten forklaring** så lenge utvalget inneholder en underoppgave. Toasten kommer bare om handleren kalles direkte. Alternativet — å la valget stå og forklare etterpå — er dårligere, men den tause forsvinningen er en kostnad.
- **Delmål har nå `doneAt`, og gamle delmål har det ikke.** Ukesoppsummeringen vil vise avkryssede delmål fra i dag og framover, mens alt hun krysset av tidligere fortsatt bare teller i «gjort uten tidsstempel». Historikken blir ikke reparert; den kan ikke gjenskapes.
- **`_setDone` har et `opts`-argument.** Hvert unntak i en én-dør-funksjon er en invitasjon til det neste. Dette er det eneste, det har ett kallsted, og det står i koden hvorfor.
- **Angring i skjemaet dekker feltene skjemaet sender,** ikke alt som kan ha endret seg. Endrer hun tittel og frist, angrer den begge. Har noe annet skrevet til oppgaven i mellomtiden, rører ikke angringen det.

**Vi får:**

- `tests/run.mjs` 588 → **609 assertions**. Seksjon 41 dekker at bøtta er synlig i velg-modus og at radene der er valgbare, at filteret spør *prosjektet* for en underoppgave, at massefrist og masseflytting treffer underoppgaven, at «fjern prosjekt» er skjult og avvist, at et delmål får `doneAt` og at ukesoppsummeringen ser det, og at angring i skjemaet gir tilbake både tittel og frist. **ADR 0045s assertion «velg-modus skjuler «Fra prosjekter»» er snudd med vilje** — den beskrev den feilen vi nettopp rettet, og en test som verner om en feil er verre enn ingen test.
- **11 av 609 feiler mot live-koden** (commit `51fcedf`). Den negative kontrollen trengte **ingen skimmer denne runden**: gammel kode mangler ingen av navnene, så hver av de elleve måler en forskjell i *oppførsel*, ikke et manglende navn.
- Målt på hennes egne data: velg-modus 34 valgbare rader på skjermen av 58 i lageret, bøtta synlig, «fjern prosjekt» skjult både før og etter at en underoppgave er valgt, 0 horisontal overflyt, 0 konsollfeil. `node --check` OK, 0 NUL-bytes, 0 CR, 105 handlere, 0 duplikater.

## Alternatives considered

**La velg-modus være frie oppgaver, og heller si det.** En linje i bøtte-headeren: «kan ikke velges». Ærligere enn å skjule bøtta, og null risiko. Forkastet: ADR 0045 og 0049 gjorde de to slagene til én liste for henne; å bygge en usynlig vegg midt i den lista og skilte den er å dokumentere en inkonsistens i stedet for å fjerne den.

**Gi delmål `status` også, og droppe `opts`.** Da er `_setDone` uten unntak. Forkastet: `status` er kanban-vokabular, delmål står ikke på brettet, og feltet ville vært dødt i det øyeblikket det ble skrevet — ADR 0049 brukte en hel runde på å fjerne åtte slike.

**Et eget `_setMilestoneDone`.** Unngår `opts` og holder `_setDone` ren. Forkastet: det er nøyaktig den femte døra vi prøver å lukke. To funksjoner som begge vet hva «ferdig» betyr drifter fra hverandre — det er det ADR 0037 ble skrevet om.

**Generell angring via en kommandolog.** Fortsatt forkastet, av samme grunn som i ADR 0051: den krever at hver mutasjon går gjennom én dør, og appen har elleve skrivesteder for oppgaver alene. Feltøyeblikksbildet dekker nå både masseoperasjonene og skjemaet, som er der skaden faktisk skjer.

**La «fjern prosjekt» stå og konvertere underoppgaven til en fri oppgave.** Teknisk mulig: sett `kind:'free'`, gi den en prioritet. Forkastet: da endrer et massevalg oppgavens *slag*, ikke bare et felt — og hvilken prioritet? Et valg appen ikke kan ta for henne hører ikke hjemme i en masseoperasjon.
