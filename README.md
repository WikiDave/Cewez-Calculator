# Cewez-Calculator

![Toestellen die de app gebruiken](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fabacus.jasoncameron.dev%2Fget%2Fcewez-calculator%2Ftoestellen&query=%24.value&label=toestellen&color=0f5c8c&cacheSeconds=3600)
![Hoe vaak de link gedeeld is](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fabacus.jasoncameron.dev%2Fget%2Fcewez-calculator%2Fgedeeld&query=%24.value&label=gedeeld&color=e87a3e&cacheSeconds=3600)

Hobbyproject van een havenarbeider, David Schütt, gebouwd met behulp van AI (Claude). Dit project heeft niets te maken met Cewez. De informatie kan fout zijn. De app werkt offline op de gsm; gegevens blijven op het toestel en worden niet gedeeld.

Werkuren en loon bijhouden voor havenarbeid in Zeebrugge: kies per dag het bedrijf en het startuur, vul eventuele overuren in (na 7u45) en zie per maand het bruto en het geschatte netto per uitbetaling.

- Open de app via GitHub Pages en zet hem op je beginscherm (de knop "Uitleg" legt uit hoe). Hij werkt ook offline (service worker in `sw.js`, manifest in `manifest.webmanifest`).
- Gegevens blijven op je toestel (browseropslag); maak af en toe een back-up via "Back-up & export".

## Gebruikers tellen

Er wordt alleen geteld, zonder namen of gegevens, via tellers van [Abacus](https://abacus.jasoncameron.dev): bij de eerste start op de echte site (wikidave.github.io) stuurt een toestel één keer "+1" (`cewez-calculator/toestellen`), en elke keer dat iemand de knop "Link delen" gebruikt telt `cewez-calculator/gedeeld`. De aantallen staan niet in de app, enkel in de badges bovenaan deze README. De teller vervalt na ongeveer 6 maanden zonder nieuw toestel.

## Loonberekening

De berekening staat in `loon.js` (zonder schermcode) en volgt de opbouw van de Cewez-loonbrief:

- Twee uitbetalingen per maand: dag 1–15 (rond de 19e) en dag 16–einde maand (uiterlijk 3 werkdagen later).
- Per shift: shiftloon, vaste premie en overuren (RSZ + voorheffing), kledij, verplaatsing en internet (pool) zonder RSZ en voorheffing, eigen bijdrage maaltijdcheque.
- RSZ: 13,07% op 108% van basis RSZ. Voorheffing: voorlopige schatting (half maandloon x 24, schalen 2026), enkel voor een alleenstaande zonder personen ten laste.
- Zon- en feestdagtarief vanaf 18u00 de dag ervoor; een feestdag in het weekend telt op de vervangingsdag.

Tests (met een echte loonbrief van augustus 2026 die tot op de cent moet kloppen):

```
node --test
```

## Functies

Functieloon volgens de Codex (artikel 31): basisloon alle werk van de shift plus 1× overuurloon (chauffeurs: tugmaster, heftruck, bobcat, unimog, empty container handler, hoogwerker, tugmaster kaai, verreiker), 2× uurloon (bull, heftruck +20 ton, reachstacker, giekkraan −20 ton, hydraulische kraan) of 2× overuurloon (straddle carrier, portaalkraan, giekkraan +20 ton, RMG/RTG). High/heavy chauffeur = alle werk.

## Kledijpunten

Volgens de Codex (artikel 39 en bijlage 11): 1 punt per gewerkte shift, 2 punten voor lashing roro, container en high & heavy; saldo afgetopt op 300. Vul het saldo van je loonbrief in als vertrekpunt; afgehaalde kledij gaat van het saldo af.

## Nog open

- Werkbonus, speciale bijdrage sociale zekerheid: staan op 0 (instelbaar).
- Exacte voorheffing: officiële sleutelformule 2026, of kalibreren met een loonbrief met voorheffing.
- Vervangingsdagen voor 15/08/2026 en 01/11/2026 (instelbaar bij Feestdagen).
- Fietsvergoeding per km.
- Of wijzigings- en afbestelvergoeding onder RSZ vallen (instelbaar).
- Halve shift: nu gerekend als de helft van het shiftloon.
- Overuren: nu exact per minuut gerekend (afronding nog te bevestigen).
- Functies: overuren worden nog aan het overuurtarief alle werk gerekend; foreman, ceelbaas en andere functies (jumbo, markeerder, stouwer, telescopische kraan) staan er nog niet in.
- Kledijpunten: de Codex geldt voor de pool; nog na te gaan of dezelfde regels gelden voor gelegenheidsarbeiders.

## Kaart

Per bedrijf kun je een spelt op de kaart zetten (satelliet of kaart) en verslepen naar de juiste kaai; de route-knop gaat dan naar die spelt. De kaart gebruikt [Leaflet](https://leafletjs.com) 1.9.4 (BSD-2, in `vendor/leaflet/`) met tegels van OpenStreetMap en Esri World Imagery.
