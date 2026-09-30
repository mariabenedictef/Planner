# ADR 0055 — Stjernemerking og «i dag», og hva en telefonrad har råd til

**Status:** Accepted
**Date:** 2026-09-30
**Bygger på:** 0037 (`_setDone`/feltnavn), 0042 (velg-modus), 0049 (ett lager), 0050 (mobilmodellen), 0051 (angring for endringer), 0054 (delmål i To Do's)

## Context

Maria ba om to ting i To Do's: en hurtigknapp som setter fristen til **i dag**, og **stjernemerking** som løfter fram det hun skal gjøre først. Hun valgte selv: stjernen skal **ikke** sortere om — oppgavene blir stående, bare fremhevet — knappen skal stå **i handlingsraden ved siden av utsett**, og begge deler skal gjelde **alt på lista**: frie To Do's, prosjektunderoppgaver og delmål.

Det som gjorde dette til en ADR var ikke funksjonene. Det var telefonen.

ADR 0050 skar oppgaveraden ned fra ni kontroller til én på 390 px, fordi ni ga «tre skjermer med rulling for fire oppgaver». Jeg antok at to knapper til var innafor — «tre kontroller er ikke ni» — og skrev det til og med som en kommentar i stilarket. **Målt var det feil.** En fri To Do har allerede ✎ *og* × i handlingsraden på telefon, altså to knapper, ikke én. Med stjerne og «I dag» ble det fire:

| | tittelbredde | median radhøyde |
|---|---:|---:|
| Før runden (✎ ×) | 194 px | 61 px |
| + stjerne | 150 px | 80 px |
| + stjerne + «I dag» | **98 px** | **101 px** |

98 px tittel betyr at hver oppgave brekker over to–tre linjer. Det er nøyaktig regresjonen ADR 0050 ble skrevet for å hindre.

## Decision

**`starred` er et persistert felt som settes bare når det er sant og slettes når det slås av.** Samme regel som `doneAt`: et felt som alltid ligger der med `false` er bytes i hvert blob, hver sky-push og hvert øyeblikksbilde — for informasjon fraværet allerede bærer. Ingen migrering trengs; fraværende felt betyr «ikke stjernemerket».

```js
function _setStarred(o, on){ if (!o) return null; if (on) o.starred = true; else delete o.starred; return o; }
function _isStarred(o){ return !!(o && o.starred); }
```

**Ingen omsortering.** Maria valgte «bli stående, bare fremhevet», så `_dateThenOrderCmp` er urørt og en test vokter det: tidligste frist står fortsatt først, også når en senere oppgave er stjernemerket.

**Markeringen er tredelt, med vilje.** En kantstripe (`inset 3px 0 0 var(--star)`) fanger blikket når man skummer kolonnen, bakgrunnen holder raden fremhevet mens man leser den, og en ★ foran tittelen bærer betydningen for den som ikke skiller fargene. Alle tre på variabler, så mørk modus følger med (ADR 0047). En **gjort** oppgave mister markeringen: det er ikke lenger noe å prioritere.

**«I dag» spør om feltet, ikke om objektets form.** Oppgaver bærer `due`, delmål bærer `date` — feltnavnet *er* forskjellen på dem (ADR 0037), så det sendes inn:

```js
function _setDateToday(o, field){
  if (!o || !field) return false;
  const k = todayKey();
  if (o[field] === k) return false;   // alt i dag ⇒ ingenting å angre
  o[field] = k;
  return true;
}
```

Returverdien er ikke pynt: setter man et angrepunkt for en endring som ikke skjedde, brenner man det forrige angrepunktet.

**«I dag» har angring, stjernen ikke.** «I dag» overskriver en dato hun ikke får tilbake; stjernen er ett klikk å reversere og synlig med det samme. `registerFieldUndo` har fått et femte, valgfritt argument `find`, fordi **delmål ikke ligger i `state.tasks`** og derfor ikke finnes av `_taskById`. Standarden er uendret, så alle eksisterende kallsteder oppfører seg som før. `_milestoneById(mid)` er den nye døra, i samme form som de tre fra ADR 0049.

**På telefonen slipper stjernen gjennom, «I dag» ikke — og datochipen bærer den i stedet.** Stjernen er både kontrollen og markeringen, så den må stå på raden. «I dag» kan flyttes dit informasjonen allerede er: datochipen får `data-action="dueToday"`, en stiplet understrek som affordanse, og en tittel som sier hva trykket gjør. **Det koster null bredde, fordi chipen alt står der.** På desktop står den eksplisitte knappen der Maria ba om den, ved siden av utsett; understreken vises bare på telefon, siden to måter å si det samme på er én for mye.

**En oppgave uten dato får ingen «+ i dag»-chip.** Den ble bygget, målt og forkastet: den løftet median radhøyde fra 80 til 99 px fordi den wrapper til ny linje på rader med lang tittel. I Marias egne bøtter har så godt som alt en dato.

**Delmålets knapp heter «Sett i dag», ikke «I dag».** ADR 0054 ga delmålene ingen utsett-nedtrekk med vilje — «en dato du når eller bommer på, ikke en frist du skyver». Å flytte et delmål hit er ikke en utsettelse, og knappen skal ikke låne ordlyd fra en frist.

**To eksisterende assertions er justert, ikke snudd.** «forfalt frist får `.overdue`» og «raden har absolutt dato i title» målte begge på nøyaktig markup som nå har fått en klasse og et titteltillegg. Egenskapen de vokter er den samme; bare formen er ny. Det er forskjellen på å oppdatere en test og å snu den, og bare det siste krever en begrunnelse av typen ADR 0052 og 0054 gir.

## Consequences

**Vi aksepterer:**

- **Telefonraden er 80 px i stedet for 61.** Stjernen koster ~19 px median radhøyde og 44 px tittelbredde. Det er en reell tetthetskostnad på den flaten hun bruker mest, betalt for en funksjon hun ba om — men det er en kostnad, ikke gratis.
- **«I dag» er to forskjellige ting avhengig av flate:** en knapp på desktop, et trykk på datoen på telefon. Det er én funksjon med to innganger, og den som bare bruker telefonen må oppdage understreken. Desktop-knappen lærer den bort, men ikke til den som aldri sitter ved PC-en.
- **En oppgave uten dato har ingen hurtigvei til i dag på telefon.** Den må gjennom ✎. Målingen sier at alternativet er dyrere enn det er verdt, men det er et hull.
- **Stjernen sorterer ikke.** Maria valgte det, og det er riktig for en liste man kjenner rekkefølgen på — men det betyr at en stjernemerket oppgave nederst i en lang bøtte fortsatt krever rulling.
- **`starred` er enda et felt som kan bli liggende igjen** på en oppgave som er gjort og arkivert. Det er ett boolsk felt og det slettes ved avmerking, så kostnaden er liten — men ADR 0049 ryddet bort åtte døde felt, og dette er et nytt.

**Vi får:**

- `tests/run.mjs` 649 → **677 assertions**, `tests/browser.mjs` 23 → **40**. Nettlesersuiten måler nå tittelbredde, median radhøyde og at knappene er minst 40 px på en ekte 390 px-telefon med berøring — **det var den som fant at «I dag» ikke fikk plass**, og den vokter tallet framover. **19 av 677 feiler mot live-koden** (`f1ba025`).
- Målt i ekte nettleser: stjernen lagres i `localStorage`, raden får klassen og merket, trykk på datochipen setter fristen til i dag og toasten tilbyr angring som gir den gamle fristen tilbake. 0 horisontal overflyt, 0 konsollfeil.
- 110 handlere, 0 duplikater, 0 `data-action` uten handler bak.

## Alternatives considered

**La begge knappene stå på telefon.** Det Maria valgte, lest bokstavelig. Forkastet på måling: tittelen falt til 98 px og raden til 101 px median. Å levere det hun ba om på en måte som gjør lista uleselig er ikke å levere det hun ba om.

**Droppe × på telefon for å få plass.** Ville frigjort 44 px. Forkastet: sletting uten angring bak seg er den ene knappen man ikke skal gjøre vanskeligere å nå *eller* lettere å treffe ved et uhell — og å fjerne den ville vært en endring hun ikke har bedt om, midt i en runde om noe annet.

**Stjernen som et tredje sveip.** Høyresveip = ferdig og venstresveip = slett er tatt (ADR 0039). En tredje retning finnes ikke, og en langtrykk-gest er uoppdagbar.

**Egen «★ Prioritert»-bøtte øverst.** Sterkeste signalet, og et av alternativene Maria fikk. Hun valgte det bort, og begrunnelsen holder: en oppgave ville da stått ett sted i stedet for i bøtta si, og prioritetsinndelingen er hele strukturen på sida.

**La stjernen sortere til toppen av bøtta.** Også valgt bort. Verdt å merke seg at det ville gjort tetthetskostnaden lettere å bære — det du leter etter står øverst — men det bytter bort en rekkefølge hun kjenner.
