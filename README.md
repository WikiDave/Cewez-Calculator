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

## Nog open

- Werkbonus, speciale bijdrage sociale zekerheid: staan op 0 (instelbaar).
- Exacte voorheffing: officiële sleutelformule 2026, of kalibreren met een loonbrief met voorheffing.
- Vervangingsdagen voor 15/08/2026 en 01/11/2026 (instelbaar bij Feestdagen).
- Fietsvergoeding per km.
- Of wijzigings- en afbestelvergoeding onder RSZ vallen (instelbaar).
- Halve shift: nu gerekend als de helft van het shiftloon.
- Overuren: nu exact per minuut gerekend (afronding nog te bevestigen).
