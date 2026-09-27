// Automatische tests voor de loonberekening. Uitvoeren met: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const Loon = require('../loon.js');

const ctx = (settings = {}, holidays = {}) => ({
  ratePeriods: Loon.DEFAULT_RATE_PERIODS,
  settings: { ...Loon.DEFAULT_SETTINGS, ...settings },
  holidays,
});
const shift = (date, code, extra = {}) => ({ id: `${date}-${code}`, date, code, kind: 'full', overtime: 0, ...extra });

test('echte loonbrief Cewez augustus 2026, periode A (betaald 19/08/2026)', () => {
  // 1 volle shift, zaterdag 15/08/2026 (O.L.V. Hemelvaart), 08u00, gelegenheidsarbeider,
  // eigen vervoer vanuit Assebroek, ongehuwd, geen personen ten laste
  const r = Loon.calcPeriod([shift('2026-08-15', '08')], ctx({ status: 'gelegenheid', place: 'Assebroek', civil: 'ongehuwd' }));
  const line = (key) => r.lines.find((l) => l.key === key)?.amount;

  assert.equal(r.shifts[0].row, 'ZA'); // feestdag op zaterdag: gewoon zaterdagtarief
  assert.equal(line('shiftloon'), 270.18);
  assert.equal(line('premie'), 5.28);
  assert.equal(r.basisRsz, 275.46);
  assert.equal(r.rsz, 38.88);
  assert.equal(r.werkbonus, 0);
  assert.equal(r.belastbaar, 236.58);
  assert.equal(r.voorheffing, 0);
  assert.equal(r.D, 4.35); // kledij 1,59 + eigen vervoer 2,76
  assert.equal(line('kledij'), 1.59);
  assert.equal(line('vervoer'), 2.76);
  assert.equal(r.special, 0);
  assert.equal(r.groupInsurance, 0);
  assert.equal(r.mtc, 1.09);
  assert.equal(r.netto, 239.84);
  assert.equal(r.betaald, 239.84);
  assert.equal(r.payment.date, '2026-08-19');
  assert.equal(line('internet'), undefined); // gelegenheidsarbeider: geen internetvergoeding
});

test('zondagtarief vanaf 18u00 de dag voor een zon- of feestdag', () => {
  assert.equal(Loon.tariffRow('2026-08-22', '18'), 'ZO'); // zaterdag 22u00
  assert.equal(Loon.tariffRow('2026-08-22', '14'), 'ZA'); // zaterdag overdag
  assert.equal(Loon.tariffRow('2026-11-10', '18'), 'ZO'); // dinsdag avond voor 11 november
  assert.equal(Loon.tariffRow('2026-11-10', '14'), '14');
  assert.equal(Loon.tariffRow('2026-11-11', '08'), 'ZO'); // feestdag zelf
  assert.equal(Loon.tariffRow('2026-09-23', '06'), '06'); // gewone weekdag
});

test('feestdag in het weekend telt op de vervangingsdag', () => {
  assert.equal(Loon.tariffRow('2026-11-01', '08'), 'ZO'); // zondag blijft zondag
  assert.equal(Loon.holidayOn('2026-08-15'), undefined);
  const overrides = { '2026-08-15': '2026-08-14' };
  assert.equal(Loon.holidayOn('2026-08-14', overrides), 'O.L.V. Hemelvaart');
  assert.equal(Loon.tariffRow('2026-08-14', '08', overrides), 'ZO');
  assert.equal(Loon.tariffRow('2026-08-15', '08', overrides), 'ZA');
});

test('wettelijke feestdagen 2026 (zonder 11 juli)', () => {
  assert.deepEqual(Loon.legalHolidays(2026).map((h) => h.date), [
    '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25',
    '2026-07-21', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25',
  ]);
});

test('uitbetalingsperiodes', () => {
  assert.equal(Loon.periodOf('2026-09-15').key, '2026-09-A');
  assert.equal(Loon.periodOf('2026-09-16').key, '2026-09-B');
  assert.equal(Loon.periodOf('2026-09-30').end, '2026-09-30');
  // periode B september: 3e werkdag na 30/09 = maandag 5 oktober
  assert.equal(Loon.paymentDate(Loon.periodOf('2026-09-20')).date, '2026-10-05');
});

test('voorheffing-schatting', () => {
  // 2000 x 24 = 48000; kosten 6070; basis 41930; belasting 14885 - 2887,50 = 11997,50; / 24
  assert.equal(Loon.estimateWithholding(2000, {}, '2026-09-01').amount, 499.9);
  assert.equal(Loon.estimateWithholding(236.58, {}, '2026-08-01').amount, 0);
  const r = Loon.estimateWithholding(2000, { kids: 1 }, '2026-09-01');
  assert.equal(r.calculated, false);
  assert.equal(r.amount, 0);
});

test('halve shift, pool en maaltijdcheque', () => {
  const full = Loon.shiftLines(shift('2026-09-23', '06'), ctx({ status: 'pool' })).lines;
  assert.equal(full.find((l) => l.key === 'internet').amount, 0.8);
  assert.equal(full.find((l) => l.key === 'mtc').amount, 1.09);
  const half = Loon.shiftLines(shift('2026-09-23', '06', { kind: 'half' }), ctx({ status: 'pool' })).lines;
  assert.equal(half.find((l) => l.key === 'premie').amount, 2.64);
  assert.equal(half.find((l) => l.key === 'kledij').amount, 1.59);
  assert.equal(half.find((l) => l.key === 'internet'), undefined);
  assert.equal(half.find((l) => l.key === 'mtc'), undefined);
});

test('geschat netto per shift verdeelt het periodenetto naar bruto', () => {
  const r = Loon.calcPeriod([shift('2026-09-21', '08'), shift('2026-09-22', '04', { overtime: 1 })], ctx());
  const total = Loon.round2(r.shifts.reduce((t, x) => t + x.netto, 0));
  assert.ok(Math.abs(total - r.netto) <= 0.01);
  assert.ok(r.shifts[1].netto > r.shifts[0].netto);
});

test('afbestelling weekend: vergoeding plus verplaatsing', () => {
  const r = Loon.calcPeriod([shift('2026-09-19', '08', { kind: 'afbestel' })], ctx());
  assert.deepEqual(r.lines.map((l) => [l.key, l.amount, l.type]), [['afbestel', 115.16, 'A'], ['vervoer', 2.76, 'D']]);
  assert.equal(r.mtc, 0);
});

test('voorheffing: eigen percentage en extra bedrag', () => {
  // augustus-loonbrief met 10% voorheffing en 5 euro extra: 236,58 x 10% = 23,66 (half-up) + 5
  const r = Loon.calcPeriod([shift('2026-08-15', '08')], ctx({ withholdingMode: 'percentage', withholdingPct: 10, extraWithholding: 5 }));
  assert.equal(r.voorheffing, 28.66);
  assert.equal(r.netto, 211.18);
  assert.equal(r.estimate, false);
  // met percentage wordt de voorheffing ook berekend bij personen ten laste
  const k = Loon.calcPeriod([shift('2026-08-15', '08')], ctx({ withholdingMode: 'percentage', withholdingPct: 10, kids: 2 }));
  assert.equal(k.withholdingCalculated, true);
  assert.equal(k.voorheffing, 23.66);
});

test('versienummer van de app en version.json zijn gelijk', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const appVersion = html.match(/const APP_VERSION = '([^']+)'/)[1];
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  assert.equal(appVersion, version);
  assert.equal(html.match(/<script src="loon\.js\?v=([^"]+)">/)[1], version);
});
