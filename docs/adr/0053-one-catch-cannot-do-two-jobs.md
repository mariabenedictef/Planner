# ADR 0053 — Én catch kan ikke gjøre to jobber

**Status:** Accepted
**Date:** 2026-09-21
**Bygger på:** 0022 (state degraderes aldri stille), 0031 (høylytte feil), 0032 (stemple ingenting du ikke har bekreftet)

## Context

Maria ba om en oppryddingsrunde. Bugjakten fant ingen døde handlere, ingen bare `HANDLERS`-kall, ingen `console.log`, ingen duplikater, og alle sju `p.tasks`-treffene lå inne i `migrateState` — som er nøyaktig der de skal ligge etter ADR 0049. Koden er i god stand.

Det som sto igjen var **16 tomme `catch(_){}`** (19 om man teller kommentarer som siterer gamle). De fleste er legitime: å spørre `localStorage` i en privat fane, `selectionStart` på en `<input type=date>`, `dataTransfer.setData` i en nettleser som ikke vil — alt dette *skal* kunne feile uten å si fra. Men tre av dem var ikke det slaget.

**To drop-handlere pakket parsingen og handlingen inn i samme `try`.** `todoDrop` og `taskToTimeDrop` starter begge med `JSON.parse(e.dataTransfer.getData('application/json'))`. Den parsingen **må** kunne feile stille: en omrokkeringsdrag bærer `text/x-reorder` og ingen JSON, og den lander i den samme drop-sonen. Men den ene `catch(_){}` dekket også alt etterpå — selve flyttingen. Drar hun en oppgave til en annen prioritet og `setTaskPriority` kaster, spretter oppgaven tilbake til der den var, uten et ord. Det er ADR 0022 sitt bugslag, i to handlere hun bruker med musa hver dag.

Det er verdt å si nøyaktig hva feilen var, for den er lett å gjenta: **de to operasjonene trenger motsatt oppførsel, og de delte ett sikkerhetsnett.** Et nett som er riktig dimensjonert for den ene er feil for den andre.

**Og én `catch(_){}` som aldri kunne kjøre.** `_schedulePoll` gjorde `try { await pullFromRemote(true) } catch(_){}`. Men `pullFromRemote` kaster ikke — den fanger selv og returnerer `{ok:false, error}` (og setter `_syncStatus.state = 'error'` på veien). Den tomme catch-en var altså død kode som *så ut som* et sikkerhetsnett. Verre: hvis feilen en dag oppsto i pollingen selv og ikke i pullen, ville den blitt svelget, og indikatoren stått grønn mens bakgrunnssynken var nede.

Én ting til, funnet på veien: `taskToTimeDrop` slo opp `const p = state.projects.find(...)` som ingen leste. Et levning fra v5-migreringen.

## Decision

**Skill parsingen fra handlingen. Parsingen feiler stille, handlingen høylytt.**

```js
let data = null;
try { data = JSON.parse(e.dataTransfer.getData('application/json')); }
catch(_){ return; }                       // ikke vår nyttelast — stille, med vilje
if (!data || !data.kind) return;
try {
  /* ... selve handlingen ... */
} catch (err){
  console.error('[todoDrop] flytting feilet', err);
  showToast('⚠ Kunne ikke flytte oppgaven. Åpne den og endre prioritet i skjemaet.', 8000);
}
```

Toasten sier ikke bare at det gikk galt — den sier hva hun kan gjøre i stedet. En feilmelding uten utvei er halv informasjon.

**Pollingen beholder en catch, men den gjør nå noe.** To ting skal skje om vi havner der: loopen skal overleve (en ufanget `await`-feil inne i `setTimeout` ville drept `_schedulePoll(_pollDelay)` på slutten, og bakgrunnssynken hadde stoppet for godt, stille), og indikatoren skal bli rød. Den gamle koden gjorde det første og ikke det andre.

```js
} catch (err){
  console.error('[sync] bakgrunnssynk feilet', err);
  _syncStatus.state = 'error';
  _syncStatus.error = 'Bakgrunnssynk feilet: ' + ((err && err.message) || err);
  updateSyncIndicator();
}
```

**`taskToTimeDrop` går gjennom `_taskById` for begge slag** (ADR 0049), etter å ha delt `pid:tid` når nyttelasten sier `projectTask`. Det ubrukte prosjektoppslaget er borte.

**De 13 andre tomme `catch(_){}` blir stående, og CONTEXT.md sier nå hvilke og hvorfor.** Det er halve poenget med denne ADR-en: uten en skrevet grense blir «rydd opp i tomme catch» en runde noen kjører om igjen hver gang, med risiko for å gjøre en legitim stille feil høylytt.

## Consequences

**Vi aksepterer:**

- **To nye toaster kan dukke opp.** Begge krever at noe faktisk feiler, så i normal bruk ser hun dem aldri. Men om det finnes en feil i `setTaskPriority` vi ikke kjenner, vil den bli synlig nå — det er hensikten, og det vil se ut som en ny feil selv om den er gammel.
- **Grensen mellom «stille» og «høylytt» er et skjønn, ikke en regel.** De 13 er vurdert én for én og skrevet ned. Neste gang noen legger til en `catch(_){}` er det den lista som avgjør om den hører hjemme, og lister forfaller.
- **Pollingens catch er fortsatt nesten umulig å utløse.** Vi har ingen test som får `pullFromRemote` til å kaste, fordi den ikke kan. Testen sjekker formen på koden, ikke oppførselen — svakere, og det er verdt å vite.

**Vi får:**

- `tests/run.mjs` 609 → **626 assertions**. Seksjon 42 dekker at tom og ugyldig nyttelast fortsatt er stille, at en gyldig flytting virker, at en flytting som *kaster* gir én toast og ikke kaster videre, at `taskToTimeDrop` deler `pid:tid` og treffer underoppgaven, og at pollingens døde catch er borte. **6 av 626 feiler mot live-koden** (`b97b0cc`).
- Mappa: `backups/` fra 101 filer / 9,7 MB til **32 / 3,4 MB** (tre nyeste per fil, pluss pre-v5 og pre-adr0052 alltid). `_to_delete/`, `Claude outputs/` og `starter.json` slettet etter Marias godkjenning.
- `node --check` OK, 105 handlere, 0 duplikater, 0 `console.log`, 0 TODO.

## Alternatives considered

**Fjerne alle 16 tomme catch-ene.** Konsekvent, og lett å begrunne som «ingen stille feil». Forkastet: flere av dem *må* være stille. En `showToast` hver gang `selectionStart` kaster på et datofelt ville vært støy hun ikke kan gjøre noe med, og støy lærer folk å ignorere varsler. Regelen er ikke «aldri stille» — den er «stille bare der du kan si hvorfor».

**Logge til konsollen uten toast.** Billigere, og nok for meg. Forkastet: hun ser ikke konsollen. ADR 0022 ble skrevet fordi feil var synlige bare der.

**La drop-handlerne kaste videre til dispatcheren.** Den har allerede en `try/catch` med `console.error`. Forkastet: den svelger like stille, bare et nivå opp — og drop-handlerne er bundet med `ondrop=`, så de går ikke engang gjennom den.

**Rydde i `docs/` samtidig.** Fristende — seks løse filer. Forkastet: `CHANGELOG.md` viser til to av dem ved navn i historiske innslag, og en endringslogg er en protokoll. Å flytte filene ville gjort loggen feil for å gjøre en mappe penere.
