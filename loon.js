/*
 * Loonberekening havenarbeider Zeebrugge (uitbetaald door Cewez).
 * Zuivere rekenfuncties zonder schermcode: werkt in de browser (window.Loon)
 * en in Node (require('./loon.js')) voor de automatische tests.
 */
(function (root) {
  'use strict';

  // --- afronden en datums -------------------------------------------------
  // half-up op 2 decimalen; toFixed(6) vangt zwevendekommafouten op (1,5 x 37,91 = 56,8649999…)
  function round2(n) {
    const sign = n < 0 ? -1 : 1;
    return sign * Math.round(Number((Math.abs(n) * 100).toFixed(6))) / 100;
  }
  const sum = (list) => round2(list.reduce((t, n) => t + n, 0));

  const pad = (n) => String(n).padStart(2, '0');
  const parse = (iso) => new Date(iso + 'T00:00:00Z');
  const toIso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const addDays = (iso, n) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
  const weekday = (iso) => parse(iso).getUTCDay(); // 0 = zondag, 6 = zaterdag
  const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

  // kies uit een lijst [{ from: 'YYYY-MM-DD', ... }] de laatste die al geldt op `date`
  const validOn = (list, date) => list.filter((x) => x.from <= date).pop() || list[0];

  // --- loontabel ------------------------------------------------------------
  const START_HOURS = [
    ['04', '04u00 (I)'], ['05', '05u00 (J)'], ['06', '06u00 (H)'], ['07', '07u00 (B)'], ['08', '08u00 (A)'],
    ['09', '09u00 (C)'], ['10', '10u00 (D)'], ['11', '11u00 (E)'], ['12', '12u00 (F)'], ['13', '13u00 (G)'],
    ['14', '14u00 (N)'], ['15', '15u00 (O)'], ['16', '16u00 (P)'], ['17', '17u00 (Q)'],
    ['18', '18u–22u (V W X Y Z)'],
  ].map(([id, label]) => ({ id, label }));
  const RATE_ROWS = [...START_HOURS, { id: 'ZA', label: 'Zaterdag' }, { id: 'ZO', label: 'Zon- en feestdag' }];

  // [shift, overuur] in de volgorde van RATE_ROWS
  const ratesFrom = (pairs) => Object.fromEntries(RATE_ROWS.map((x, i) => [x.id, { shift: pairs[i][0], overuur: pairs[i][1] }]));
  const DEFAULT_RATE_PERIODS = [
    { from: '', values: ratesFrom([
      [261.74, 54.15], [222.48, 46.04], [183.21, 37.91], [178.12, 36.86], [174.49, 36.11],
      [185.34, 38.34], [187.58, 38.81], [187.58, 38.81], [200.66, 41.52], [200.66, 41.52],
      [200.66, 41.52], [209.10, 43.26], [217.52, 45.00], [225.94, 46.74],
      [261.74, 54.15], [261.74, 54.15], [348.98, 72.21],
    ]) },
    { from: '2026-07-07', values: ratesFrom([
      [270.18, 55.91], [229.66, 47.52], [189.13, 39.14], [183.82, 38.03], [180.12, 37.26],
      [191.28, 39.57], [193.63, 40.07], [193.63, 40.07], [207.14, 42.86], [207.14, 42.86],
      [207.14, 42.86], [215.83, 44.66], [224.53, 46.46], [233.23, 48.26],
      [270.18, 55.91], [270.18, 55.91], [360.24, 74.54],
    ]) },
  ];

  // --- vaste waarden (met geldigheidsdatum) ----------------------------------
  const PARAMS = [{
    from: '2026-01-01',
    rszFactor: 1.08, rszRate: 0.1307,        // RSZ werknemer: 13,07% op 108% van basis RSZ
    premie: 5.28, premieHalf: 2.64,           // vaste premie per volle / halve shift
    kledij: 1.59,                             // per shift, ook halve
    internet: 0.80,                           // per volle shift, enkel erkend (pool)
    mtcValue: 7.00, mtcOwn: 1.09,             // maaltijdcheque; eigen bijdrage per volle shift
    wijziging: 17.17, afbestelWeekend: 115.16,
    tax: {                                    // voorheffing-schatting, inkomsten 2026
      periodsPerYear: 24, costRate: 0.30, costMax: 6070,
      brackets: [[16720, 0.25], [29510, 0.40], [51070, 0.45], [Infinity, 0.50]],
      taxFree: 11550,
    },
  }];

  // verplaatsingsvergoeding eigen vervoer per shift (per deelgemeente)
  const TRAVEL = [{
    from: '2026-01-01',
    table: Object.fromEntries([
      [1.68, 'Zeebrugge, Heist, Lissewege, Uitkerke, Ramskapelle, Knokke, Blankenberge'],
      [1.77, 'Dudzele'],
      [1.86, 'Westkapelle'],
      [1.98, 'Oostkerke, Zuienkerke'],
      [2.07, 'Wenduine, Hoeke'],
      [2.16, 'Nieuwmunster, Koolkerke'],
      [2.25, 'Meetkerke, Damme'],
      [2.35, 'Houtave, Lapscheure'],
      [2.46, 'Moerkerke, Sint-Kruis, Vlissegem, De Haan'],
      [2.55, 'Brugge'],
      [2.65, 'Sint-Andries'],
      [2.76, 'Sijsele, Assebroek, Sint-Michiels, Varsenare, Stalhille, Klemskerke, Middelburg'],
      [3.04, 'Bredene, Jabbeke, Snellegem, Sluis'],
      [3.15, 'Oedelem, Oostkamp, Loppem'],
      [3.24, 'Ettelgem, Zerkegem, Maldegem'],
      [3.31, 'Zandvoorde, Roksem, Zedelgem, Zuidzande'],
      [3.45, 'Oostende, Westkerke, Bekegem, Beernem, Oudenburg'],
      [3.52, 'Waardamme, Sint-Laureins, Sint-Margriete'],
      [3.59, 'Stene, Gistel, Aartrijke, Veldegem, Herstberge, Sint-Joris, Knesselare, Oostburg, Aardenburg'],
      [3.73, 'Snaaskerke, Eernegem, Ruddervoorde, Waterland-Oudeman'],
      [3.96, 'Eede, Eede-Aardenburg, Leffinge, Zevekote, Moere, Eeklo, Ursel, Watervliet, Wingene, Zwevezele'],
      [4.28, 'Ichtegem, Torhout, Kaprijke, Schoondijke'],
      [4.53, 'Middelkerke, Zande, Koekelare, Bovekerke, Aalter, Ruiselede, Adegem'],
      [4.83, 'Poeke, Lotenhulle'],
    ].flatMap(([amount, places]) => places.split(', ').map((p) => [p, amount]))),
  }];
  const PLACES = Object.keys(TRAVEL[TRAVEL.length - 1].table).sort((a, b) => a.localeCompare(b, 'nl'));

  const DEFAULT_SETTINGS = {
    status: 'gelegenheid',      // 'gelegenheid' | 'pool'
    place: 'Assebroek',
    transport: 'auto',          // 'auto' (eigen vervoer) | 'fiets'
    bikeKm: 0, bikeRate: 0,     // fiets: km per shift x bedrag per km
    civil: 'ongehuwd',          // 'ongehuwd' | 'gehuwd' | 'wettelijk-samenwonend' | 'gescheiden' | 'weduwe'
    spouseDependent: false, kids: 0, others: 0,
    extraWithholding: 0,        // extra vrijwillige voorheffing per periode
    werkbonus: 0, specialContribution: 0,
    advance: 0, garnishment: 0, voluntary: 0, groupInsurance: 0,
    extraType: 'A',             // type van wijzigings- en afbestelvergoeding (nog te bevestigen)
  };

  // --- feestdagen -------------------------------------------------------------
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // wettelijke feestdagen (11 juli telt niet voor het loontarief)
  function legalHolidays(year) {
    const e = easter(year);
    return [
      [`${year}-01-01`, 'Nieuwjaar'],
      [addDays(e, 1), 'Paasmaandag'],
      [`${year}-05-01`, 'Dag van de Arbeid'],
      [addDays(e, 39), 'O.L.H. Hemelvaart'],
      [addDays(e, 50), 'Pinkstermaandag'],
      [`${year}-07-21`, 'Nationale feestdag'],
      [`${year}-08-15`, 'O.L.V. Hemelvaart'],
      [`${year}-11-01`, 'Allerheiligen'],
      [`${year}-11-11`, 'Wapenstilstand'],
      [`${year}-12-25`, 'Kerstmis'],
    ].map(([date, name]) => ({ date, name, weekend: [0, 6].includes(weekday(date)) }));
  }

  // Feestdagen met de datum waarop de haven ze viert. Valt een feestdag in het weekend,
  // dan telt een vervangingsdag (instelbaar in `overrides`: { wettelijkeDatum: gevierdeDatum }).
  // Zolang die niet ingevuld is, is er geen feestdagtarief voor die feestdag.
  function holidays(year, overrides = {}) {
    return legalHolidays(year).map((h) => ({
      ...h,
      effective: h.date in overrides ? overrides[h.date] : (h.weekend ? '' : h.date),
    }));
  }

  // naam van de feestdag die op `iso` gevierd wordt (of undefined)
  function holidayOn(iso, overrides = {}) {
    const y = Number(iso.slice(0, 4));
    for (const year of [y, y - 1]) {
      const h = holidays(year, overrides).find((x) => x.effective === iso);
      if (h) return h.name;
    }
    return undefined;
  }

  // --- tarief van een shift -----------------------------------------------------
  // forced: 'auto' | 'wk' (weekdag) | 'ZA' | 'ZO'
  function tariffRow(date, start, overrides = {}, forced = 'auto') {
    if (forced === 'ZA' || forced === 'ZO') return forced;
    if (forced === 'wk') return start;
    const isSunOrHoliday = (d) => weekday(d) === 0 || !!holidayOn(d, overrides);
    if (isSunOrHoliday(date)) return 'ZO';
    // zondagtarief vanaf 18u00 de dag voor een zon- of feestdag (bv. zaterdag 22u00).
    // Shiften die de dag erna tot 03u59 starten, bestaan niet in de tabel (vroegste start 04u00).
    if (start === '18' && isSunOrHoliday(addDays(date, 1))) return 'ZO';
    if (weekday(date) === 6) return 'ZA';
    return start;
  }

  const rateFor = (ratePeriods, date, row) => validOn(ratePeriods, date).values[row];

  function travelAllowance(date, settings) {
    if (settings.transport === 'fiets') return round2((settings.bikeKm || 0) * (settings.bikeRate || 0));
    return validOn(TRAVEL, date).table[settings.place] || 0;
  }

  // --- regels per shift -------------------------------------------------------
  // Type A = RSZ + voorheffing, B = enkel RSZ, C = enkel voorheffing, D = geen van beide, M = inhouding maaltijdcheque
  function shiftLines(entry, ctx) {
    const s = { ...DEFAULT_SETTINGS, ...ctx.settings };
    const p = validOn(PARAMS, entry.date);
    const kind = entry.kind || 'full';
    const lines = [];
    const add = (key, label, amount, type) => { if (amount) lines.push({ key, label, amount: round2(amount), type }); };

    if (kind === 'afbestel') {
      // afbestelling: vergoeding plus verplaatsing (je bent tot aan de haven gekomen)
      add('afbestel', 'Afbestelvergoeding weekend', p.afbestelWeekend, s.extraType);
      add('vervoer', s.transport === 'fiets' ? 'Fietsvergoeding' : 'Eigen vervoer', travelAllowance(entry.date, s), 'D');
      return { row: null, lines };
    }

    const full = kind === 'full';
    const row = tariffRow(entry.date, entry.code, ctx.holidays, entry.tariff);
    const rate = rateFor(ctx.ratePeriods, entry.date, row);
    // aanname: een halve shift = de helft van het shiftloon
    add('shiftloon', full ? 'Shiftloon' : 'Shiftloon (halve shift)', full ? rate.shift : rate.shift / 2, 'A');
    add('premie', 'Vaste premie', full ? p.premie : p.premieHalf, 'A');
    add('overuren', 'Overuren', (entry.overtime || 0) * rate.overuur, 'A');
    if (entry.wijziging) add('wijziging', 'Wijzigingsvergoeding', p.wijziging, s.extraType);
    add('kledij', 'Kledijvergoeding', p.kledij, 'D');
    add('vervoer', s.transport === 'fiets' ? 'Fietsvergoeding' : 'Eigen vervoer', travelAllowance(entry.date, s), 'D');
    if (full && s.status === 'pool') add('internet', 'Internetvergoeding', p.internet, 'D');
    if (full) add('mtc', 'Maaltijdcheque eigen bijdrage', p.mtcOwn, 'M');
    return { row, lines };
  }

  // bruto van één shift: alles wat onder RSZ en/of voorheffing valt
  const brutoOf = (lines) => sum(lines.filter((l) => 'ABC'.includes(l.type)).map((l) => l.amount));

  // --- uitbetalingsperiodes -----------------------------------------------------
  // A = dag 1–15, B = dag 16–einde maand; een shift hoort bij de periode van zijn startdatum
  function periodOf(date) {
    const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), half = Number(date.slice(8, 10)) <= 15 ? 'A' : 'B';
    const ym = `${y}-${pad(m)}`;
    return {
      key: `${ym}-${half}`, half, year: y, month: m,
      start: half === 'A' ? `${ym}-01` : `${ym}-16`,
      end: half === 'A' ? `${ym}-15` : `${ym}-${pad(lastDayOfMonth(y, m))}`,
    };
  }

  // A: rond de 19e; B: uiterlijk de 3e werkdag na de periode
  function paymentDate(period, overrides = {}) {
    if (period.half === 'A') return { date: `${period.year}-${pad(period.month)}-19`, approx: true };
    let d = period.end, count = 0;
    while (count < 3) {
      d = addDays(d, 1);
      if (![0, 6].includes(weekday(d)) && !holidayOn(d, overrides)) count++;
    }
    return { date: d, approx: false };
  }

  // --- voorheffing (voorlopige schatting) -----------------------------------------
  // Aanname: Cewez behandelt elke halve maand als een half maandloon.
  // Enkel geldig voor een alleenstaande zonder personen ten laste.
  function estimateWithholding(belastbaar, settings, date) {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    const alone = !['gehuwd', 'wettelijk-samenwonend'].includes(s.civil)
      && !s.spouseDependent && !Number(s.kids) && !Number(s.others);
    if (!alone) return { amount: 0, calculated: false };
    const t = validOn(PARAMS, date).tax;
    const year = belastbaar * t.periodsPerYear;
    const costs = Math.min(year * t.costRate, t.costMax);
    const base = year - costs;
    let tax = 0, lower = 0;
    for (const [upper, rate] of t.brackets) {
      if (base > lower) tax += (Math.min(base, upper) - lower) * rate;
      lower = upper;
    }
    tax -= t.taxFree * t.brackets[0][1];
    return { amount: round2(Math.max(0, tax) / t.periodsPerYear), calculated: true };
  }

  // --- berekening per periode -------------------------------------------------------
  function calcPeriod(periodEntries, ctx) {
    const s = { ...DEFAULT_SETTINGS, ...ctx.settings };
    const period = periodOf(periodEntries[0].date);
    const shifts = periodEntries.map((e) => {
      const { row, lines } = shiftLines(e, ctx);
      return { entry: e, row, lines, bruto: brutoOf(lines) };
    });
    const all = shifts.flatMap((x) => x.lines);
    const byType = (t) => sum(all.filter((l) => l.type === t).map((l) => l.amount));
    const A = byType('A'), B = byType('B'), C = byType('C'), D = byType('D'), M = byType('M');

    const p = validOn(PARAMS, period.start);
    const basisRsz = round2(A + B);
    const rsz = round2(basisRsz * p.rszFactor * p.rszRate);
    const werkbonus = round2(Number(s.werkbonus) || 0);
    const belastbaar = round2(A + C - rsz + werkbonus);
    const vh = estimateWithholding(belastbaar, s, period.start);
    const voorheffing = round2(vh.amount + (Number(s.extraWithholding) || 0));
    const special = round2(Number(s.specialContribution) || 0);
    const groupInsurance = round2(Number(s.groupInsurance) || 0);
    const otherDeductions = round2((Number(s.advance) || 0) + (Number(s.garnishment) || 0) + (Number(s.voluntary) || 0));
    const netto = round2(belastbaar - voorheffing - special + D - M - otherDeductions - groupInsurance);

    // geschat netto per shift = netto van de periode x aandeel in het bruto
    const brutoTotal = sum(shifts.map((x) => x.bruto));
    for (const x of shifts) x.netto = brutoTotal ? round2(netto * x.bruto / brutoTotal) : 0;

    return {
      period, payment: paymentDate(period, ctx.holidays), shifts, lines: all,
      A, B, C, D, M, bruto: brutoTotal,
      basisRsz, rsz, werkbonus, belastbaar,
      voorheffing, withholdingCalculated: vh.calculated, estimate: vh.calculated && voorheffing > 0,
      special, groupInsurance, otherDeductions, mtc: M, netto, betaald: netto,
    };
  }

  // alle shifts per periode berekenen; geeft { periods: {key: resultaat}, shifts: {id: {bruto, netto, row, lines}} }
  function calcAll(entries, ctx) {
    const groups = {};
    for (const e of entries) (groups[periodOf(e.date).key] ||= []).push(e);
    const periods = {}, shifts = {};
    for (const [key, list] of Object.entries(groups)) {
      const r = calcPeriod(list, ctx);
      periods[key] = r;
      for (const x of r.shifts) shifts[x.entry.id] = x;
    }
    return { periods, shifts };
  }

  const api = {
    round2, addDays, weekday, periodOf, paymentDate,
    START_HOURS, RATE_ROWS, DEFAULT_RATE_PERIODS, PARAMS, TRAVEL, PLACES, DEFAULT_SETTINGS,
    legalHolidays, holidays, holidayOn, tariffRow, rateFor, travelAllowance,
    shiftLines, estimateWithholding, calcPeriod, calcAll,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Loon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
