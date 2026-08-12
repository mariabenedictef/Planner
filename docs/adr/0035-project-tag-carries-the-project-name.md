# ADR 0035 — Taggen bærer prosjektnavnet, ikke tittelen

**Status:** Accepted
**Date:** 2026-08-12
**Utvider:** 0016/0017 (tagg, ikke flytt)

## Context

Målt på Marias egne data 2026-08-12: av 12 taggede frie To Do's hadde **8** prosjektnavnet skrevet inn i tittelen:

```
Meox: Sende EOGF protokoll til signering på fredag        → tagget «Meox AS»
Anteo: Lese styremøtedokumentene. Er lastet opp i mappe.  → tagget «Anteo AS»
Piscada Aqua: Få Kjetil til å signere Styreprotokoll      → tagget «Piscada Aqua AS»
Alvestad: Preppe til pressemelding / samtale med CC       → tagget «Alvestad Marin AS»
```

Informasjonen står altså to ganger. Det er ikke gratis: etter ADR 0033 vises To Do's på prosjektkortene, der titlene kappes på én linje — så prefikset spiser nettopp den plassen som skulle vist hva oppgaven er. Og på et kort som alt heter «Meox AS» er «Meox:» ren støy.

Hvorfor oppsto vanen? Taggen ble rendret som `· Meox AS` i dempet kursiv, etter tittelen. Den leste som en fotnote, ikke som bæreren av tilhørigheten. Når merkelappen ser ut som en ettertanke, skriver man den inn i tittelen i stedet.

**Og så var det «Shive».** Den åttende treffet var:

```
Shive: Lage en peer analyse, se på om noen er større     → tagget «Dealflow»
```

«Shive» er et *selskap i pipelinen*, ikke prosjektnavnet. Dealflow-prosjektet hennes brukes som en liste over caser, og prefikset der bærer den eneste informasjonen om hvilket selskap oppgaven gjelder. **En regel som fjerner ledende «Ord:» ville slettet det.** Det var derfor dataene ble lest før regelen ble skrevet.

## Decision

**1. Prefikset fjernes bare når det matcher det taggede prosjektets tittel, på ordgrense.**

```js
_stripProjectPrefix('Meox: Sende EOGF…',  'Meox AS')  → 'Sende EOGF…'   ✓
_stripProjectPrefix('Shive: Lage en peer…','Dealflow') → null            ✗ selskap, ikke prosjekt
_stripProjectPrefix('Meo: noe',            'Meox AS')  → null            ✗ midt i et ord
```

Kravene: minst 3 tegn, prosjekttittelen må *starte med* prefikset, tegnet etter må ikke være en bokstav eller et siffer, og det må stå noe igjen etterpå. Sammenligningen er ufølsom for store/små bokstaver. Gjelder både frie taggede To Do's og prosjektets egne oppgaver.

**2. Oppryddingen er et eksplisitt valg, med lista foran seg.** En rad i Innstillinger («*N* titler gjentar prosjektnavnet») dukker bare opp når det finnes noe å gjøre, og `confirm()` viser hver enkelt endring — fra og til — før noe skjer. Øyeblikksbilde først, så det kan angres via «Lokale backups». Samme mønster som opprydding av fullførte oppgaver (ADR 0032).

**3. Ingen automatikk ved lagring.** Det var fristende å strippe prefikset når hun lagrer en To Do, men da endrer appen det hun nettopp skrev, uten at hun ba om det. Overraskende redigering av egen tekst er verre enn litt redundans.

**4. Taggen er nå en chip, ikke en fotnote.** `· Meox AS` i kursiv → en dempet pille med ramme. Fortsatt rolig, men en *ting* — en merkelapp som ser ut som en merkelapp fjerner grunnen til å skrive navnet i tittelen. Samme utseende overalt taggen vises (To Do's, Hjem Urgent, dag-dashboard), og den beholder klikk-for-å-fjerne i To Do's.

## Consequences

**Vi aksepterer:**

- **Regelen er konservativ og vil overse tilfeller.** Skriver hun «MX: …» som en forkortelse for «Meox AS», blir det stående. Det er det riktige forholdet mellom feiltypene: å la et prefiks stå er en skjønnhetsfeil, å fjerne feil prefiks er tap av informasjon.
- Oppryddingen **endrer lagrede titler**. Det er derfor den krever bekreftelse, viser hver endring, og tar øyeblikksbilde. Eksporter og sky-blob får de nye titlene ved neste synk.
- Chipen tar litt mer visuell plass enn `· tittel` i kursiv. På smale rader er det tittelen som får krympe — chipen og datoen har `flex-shrink: 0`, ellers klemte flex-oppsettet «Meox AS» til «Meox …».
- Vanen forsvinner ikke av seg selv. Raden i Innstillinger dukker opp igjen hvis nye titler får prefiks — som er greit: den er et speil, ikke en engangsjobb.

**Vi får:**

- 25 nye assertions, alle mot koden før: de fire ekte prefiksene hennes strippes, **«Shive» strippes ikke**, ordgrense og minstelengde holder, utaggede oppgaver røres ikke, øyeblikksbildet skrives før endringen, og chipen rendres uten `·`.
- Visuelt verifisert i lyst og mørkt tema. Sammenligningen er tydelig: «Sende EOGF protokoll til signering på fredag [Meox AS]» får plass på én linje, «Meox: Sende EOGF protokoll til signering på fredag» gjør det ikke.

## Alternatives considered

**Skjule prefikset ved visning i stedet for å endre dataene.** Ikke-destruktivt og reversibelt. Forkastet: da divergerer det lagrede og det viste. Søk ville funnet «Meox: …», skjemaet ville vist det, eksporten ville hatt det — og vi har alt brukt tre ADR-er i dag på at én sannhet på ett sted er verdt mer enn en pen visning.

**Strippe automatisk ved lagring.** Løser vanen ved rot, men redigerer hennes tekst uten å spørre. Se punkt 3.

**Bruke likhet på hele tittelen** (`prefix === projectTitle`). Ville vært helt trygt, men fanget **null** av hennes åtte tilfeller — hun forkorter alltid («Meox» for «Meox AS»). En regel som ikke treffer noe er ikke en trygg regel, den er en ubrukelig.

**Fjerne prefikset fra alle titler med `^Ord:`.** Enkelt, og ville tatt alle åtte — inkludert «Shive», som ville mistet hvilket selskap oppgaven gjaldt. Dette er alternativet dataene avviste.

**La `untagTaskProject` også legge prefikset tilbake i tittelen** når man fjerner taggen, så informasjonen ikke forsvinner. Forkastet som for smart: den som fjerner en tagg med vilje vil ikke ha teksten tilbake i tittelen.
