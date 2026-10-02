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

  // [shift, uur, overuur] in de volgorde van RATE_ROWS (loontabel havenarbeider alle werk)
  const ratesFrom = (rows) => Object.fromEntries(RATE_ROWS.map((x, i) => [x.id, { shift: rows[i][0], uur: rows[i][1], overuur: rows[i][2] }]));
  const DEFAULT_RATE_PERIODS = [
    { from: '', values: ratesFrom([
      [261.74, 36.10, 54.15], [222.48, 30.69, 46.04], [183.21, 25.27, 37.91], [178.12, 24.57, 36.86], [174.49, 24.07, 36.11],
      [185.34, 25.56, 38.34], [187.58, 25.87, 38.81], [187.58, 25.87, 38.81], [200.66, 27.68, 41.52], [200.66, 27.68, 41.52],
      [200.66, 27.68, 41.52], [209.10, 28.84, 43.26], [217.52, 30.00, 45.00], [225.94, 31.16, 46.74],
      [261.74, 36.10, 54.15], [261.74, 36.10, 54.15], [348.98, 48.14, 72.21],
    ]) },
    { from: '2026-07-07', values: ratesFrom([
      [270.18, 37.27, 55.91], [229.66, 31.68, 47.52], [189.13, 26.09, 39.14], [183.82, 25.35, 38.03], [180.12, 24.84, 37.26],
      [191.28, 26.38, 39.57], [193.63, 26.71, 40.07], [193.63, 26.71, 40.07], [207.14, 28.57, 42.86], [207.14, 28.57, 42.86],
      [207.14, 28.57, 42.86], [215.83, 29.77, 44.66], [224.53, 30.97, 46.46], [233.23, 32.17, 48.26],
      [270.18, 37.27, 55.91], [270.18, 37.27, 55.91], [360.24, 49.69, 74.54],
    ]) },
  ];

  // --- functies (Codex art. 20 en 31) ---------------------------------------------
  // Functieloon = basisloon alle werk van die shift + een toeslag uit dezelfde rij van de loontabel.
  const FUNCTION_GROUPS = {
    alle: { label: 'Alle werk', extra: () => 0 },
    chauffeur: { label: 'Chauffeurs (+ 1× overuurloon)', extra: (r) => r.overuur },
    tuig1: { label: 'Speciale tuigen (+ 2× uurloon)', extra: (r) => 2 * r.uur },
    tuig2: { label: 'Speciale tuigen (+ 2× overuurloon)', extra: (r) => 2 * r.overuur },
  };
  const FUNCTIONS = [
    ['alle', 'Alle werk', 'alle'],
    ['highheavy', 'High/heavy chauffeur', 'alle'],
    ['tugmaster', 'Tugmasterchauffeur', 'chauffeur'],
    ['heftruck', 'Heftruckchauffeur', 'chauffeur'],
    ['bobcat', 'Bobcatchauffeur', 'chauffeur'],
    ['unimog', 'Unimogbestuurder', 'chauffeur'],
    ['ech', 'Empty container handler', 'chauffeur'],
    ['hoogwerker', 'Chauffeur hoogwerker', 'chauffeur'],
    ['tugmasterkaai', 'Tugmasterchauffeur kaai 1xx', 'chauffeur'],
    ['verreiker', 'Chauffeur verreiker (manitou)', 'chauffeur'],
    ['bull', 'Bullchauffeur', 'tuig1'],
    ['heftruck20', 'Heftruckchauffeur +20 ton', 'tuig1'],
    ['reachstacker', 'Reachstackerchauffeur', 'tuig1'],
    ['giekkraan-20', 'Giekkraanman −20 ton', 'tuig1'],
    ['hydraulisch', 'Bediener hydraulische kraan', 'tuig1'],
    ['straddle', 'Straddle-carrierchauffeur', 'tuig2'],
    ['portaalkraan', 'Portaalkraanman', 'tuig2'],
    ['giekkraan+20', 'Giekkraanman +20 ton', 'tuig2'],
    ['rmgrtg', 'RMG/RTG-bediener', 'tuig2'],
  ].map(([id, label, group]) => ({ id, label, group }));
  const functionOf = (id) => FUNCTIONS.find((f) => f.id === id) || FUNCTIONS[0];

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
    withholdingMode: 'schatting', // 'schatting' | 'percentage' (percentage gevraagd aan Cewez)
    withholdingPct: 0,          // % van het belastbaar bedrag bij 'percentage'
    extraWithholding: 0,        // extra vrijwillige voorheffing per periode (vast bedrag)
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

  // oudere bewaarde tabellen hebben geen uurloon: dat is het shiftloon / 7,25 betaalde uren
  const rateFor = (ratePeriods, date, row) => {
    const r = validOn(ratePeriods, date).values[row];
    return { ...r, uur: r.uur ?? round2(r.shift / 7.25) };
  };

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
    const fn = functionOf(entry.func);
    const shiftWage = round2(rate.shift + FUNCTION_GROUPS[fn.group].extra(rate));
    const label = `Shiftloon${fn.id === 'alle' ? '' : ` ${fn.label.toLowerCase()}`}${full ? '' : ' (halve shift)'}`;
    // aanname: een halve shift = de helft van het (functie)loon
    add('shiftloon', label, full ? shiftWage : shiftWage / 2, 'A');
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
    // voorheffing: eigen percentage (afgesproken met Cewez) of de schatting, plus een vast extra bedrag
    const vh = s.withholdingMode === 'percentage'
      ? { amount: round2(Math.max(0, belastbaar) * (Number(s.withholdingPct) || 0) / 100), calculated: true, exact: true }
      : estimateWithholding(belastbaar, s, period.start);
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
      voorheffing, withholdingCalculated: vh.calculated, estimate: vh.calculated && !vh.exact && voorheffing > 0,
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

  // --- kledijpunten (Codex art. 39 en bijlage 11) ----------------------------------
  // Per gewerkte shift punten opbouwen; het saldo wordt continu afgetopt op het maximum
  // en mag niet negatief worden (enkel voor één artikel uit het basispakket).
  const CLOTHING = [{
    from: '2024-11-21',
    max: 300,
    perShift: { lashing: 2, other: 1 }, // lashing roro / container / high & heavy = 2; al de rest = 1
  }];
  const CLOTHING_ITEMS = [
    ['minimum', 'Handschoenen (per paar)', 2], ['minimum', 'Oordopjes', 2], ['minimum', 'Impacthandschoenen (per paar)', 3],
    ['minimum', 'Fluo gilet', 9], ['minimum', 'Signalisatiebroek', 27], ['minimum', 'Broek stretch', 30],
    ['minimum', 'Helm met veiligheidsbril', 34], ['minimum', 'Sweater', 37], ['minimum', 'Samurai merlot schoenen', 46],
    ['minimum', 'Albatros schoenen', 66], ['minimum', 'Elten schoenen', 81], ['minimum', 'Winterparka', 90],
    ['basis', 'Signaalfluitje', 2], ['basis', 'Zonnebril', 8], ['basis', 'Stootpet', 20], ['basis', 'Helm', 26],
    ['basis', 'Signalisatieregenbroek', 28], ['basis', 'Signalisatiebretelbroek', 38], ['basis', 'Softshell', 40],
    ['basis', 'Bretelbroek stretch', 40], ['basis', 'Otoplastieken (op maat)', 60], ['basis', 'Winterlaarzen', 79],
    ['aanvullend', 'Life saving kiss', 2], ['aanvullend', 'Zweetbandje helm', 2], ['aanvullend', 'Schoenveters', 2],
    ['aanvullend', 'Helmmuts', 9], ['aanvullend', 'Helmcover signaalman', 11], ['aanvullend', 'Helmcover foreman', 11],
    ['aanvullend', 'Thermisch onderbroek', 11], ['aanvullend', 'Thermisch onderhemd', 11],
    ['aanvullend', 'Signalisatie t-shirt', 21], ['aanvullend', 'Regenlaarzen', 36], ['aanvullend', 'Winteroverall', 140],
  ].map(([pack, name, points]) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), pack, name, points }));

  // punten van één shift (afbestelling = niet gewerkt = geen punten)
  function clothingPointsFor(entry) {
    if (entry.kind === 'afbestel') return 0;
    return validOn(CLOTHING, entry.date).perShift[entry.work === 'lashing' ? 'lashing' : 'other'];
  }

  // Verloop van het kledijsaldo. start = { date, points } (saldo van de loonbrief op die datum;
  // shiften tot en met die datum zitten daar al in). purchases = [{ id, date, name, points, free }].
  function clothingLedger(entries, purchases = [], start = {}) {
    const from = start.date || '';
    const events = [
      ...entries.filter((e) => e.date > from).map((e) => ({ date: e.date, order: 0, kind: 'shift', entry: e, points: clothingPointsFor(e) })),
      ...purchases.filter((p) => p.date > from).map((p) => ({ date: p.date, order: 1, kind: 'purchase', purchase: p, points: p.free ? 0 : -p.points })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
    let balance = Number(start.points) || 0, earned = 0, lost = 0, spent = 0;
    for (const ev of events) {
      if (ev.kind === 'shift') {
        const max = validOn(CLOTHING, ev.date).max;
        const room = Math.max(0, max - balance);
        const added = Math.min(ev.points, room);
        balance += added; earned += added; lost += ev.points - added;
        ev.added = added;
      } else {
        balance += ev.points; spent -= ev.points;
      }
      ev.balance = balance;
    }
    return { balance, earned, lost, spent, max: validOn(CLOTHING, isoToday()).max, events };
  }
  const isoToday = () => toIso(new Date());

  const api = {
    round2, addDays, weekday, periodOf, paymentDate,
    START_HOURS, RATE_ROWS, DEFAULT_RATE_PERIODS, FUNCTIONS, FUNCTION_GROUPS, functionOf, PARAMS, TRAVEL, PLACES, DEFAULT_SETTINGS,
    legalHolidays, holidays, holidayOn, tariffRow, rateFor, travelAllowance,
    shiftLines, estimateWithholding, calcPeriod, calcAll,
    CLOTHING, CLOTHING_ITEMS, clothingPointsFor, clothingLedger,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Loon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
