# Cewez-Calculator

Werkuren en loon bijhouden voor havenarbeid in Zeebrugge: kies per dag het bedrijf en het startuur, vul eventuele overuren in (na 7u45) en zie per maand het bruto en het geschatte netto per uitbetaling.

- Open `index.html` in de browser (of via GitHub Pages).
- Gegevens blijven op je toestel (browseropslag); maak af en toe een back-up via "Back-up & export".

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
- Kledijpunten: de Codex geldt voor de pool; nog na te gaan of dezelfde regels gelden voor gelegenheidsarbeiders.

## Kaart

Per bedrijf kun je een spelt op de kaart zetten (satelliet of kaart) en verslepen naar de juiste kaai; de route-knop gaat dan naar die spelt. De kaart gebruikt [Leaflet](https://leafletjs.com) 1.9.4 (BSD-2, in `vendor/leaflet/`) met tegels van OpenStreetMap en Esri World Imagery.
