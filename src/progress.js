// Partida guardada (en este navegador), economía y niveles de Street XP.
(function () {
  'use strict';

  const KEY = 'hmo.partida.v1';

  // ---- economía ----
  const ECON = {
    startMoney: 5000,
    moneyPerPoint: 0.5,     // pesos por punto de drift
    fuelPrice: 24,          // pesos por litro
    carPrice: { pitic: 0, mezquite: 45000, choya: 85000 },
    meetXP: 120,            // Street XP por llegar a un meet (una vez por meet)
    meetMinutes: 15,        // cada cuánto cambia de lugar el meet
    driftPointsPerXP: 40,   // por drift también se gana Street XP, menos que en los meets
    farmBase: 6,            // Street XP por minuto estacionado en un meet (Ba-tsuru de fábrica)
    farmCapHours: 12,       // tope de tiempo que cuenta con el carro dejado en el meet
    carXPFactor: { pitic: 1, mezquite: 1.3, choya: 1.6 },
    towPrice: 300,          // grúa
    hiddenMinutes: 20,      // cada cuánto se mueven los talleres escondidos
    emergencyFuelL: 6,      // bidón gratis en casa si no tienes ni gasolina ni dinero
  };

  // ---- Street XP: nivel n necesita 200·n·(n+1)/2 acumulado (200, 600, 1200, 2000…) ----
  function levelFromXP(xp) {
    let n = 1;
    while (xp >= 100 * n * (n + 1)) n++;
    const prev = 100 * (n - 1) * n, next = 100 * n * (n + 1);
    return { level: n, into: xp - prev, need: next - prev, frac: (xp - prev) / (next - prev) };
  }

  // Street XP por minuto en un meet: mejor carro y más tuneo, más XP
  function farmRate(carId, tuning) {
    const t = tuning || {};
    const tiers = ['motor', 'llantas', 'suspension', 'frenos', 'rines'].reduce((a, k) => a + (t[k] || 0), 0);
    const paint = t.paint || {};
    const neon = (t.neon && t.neon.mode) || 'ninguno';
    const look = (paint.finish === 'perlado' ? 0.1 : paint.finish === 'metalico' ? 0.05 : 0) + (paint.wrap && paint.wrap !== 'ninguno' ? 0.1 : 0) +
      (neon === 'dinamico' ? 0.1 : neon === 'estatico' ? 0.05 : 0);
    return ECON.farmBase * (ECON.carXPFactor[carId] || 1) * (1 + 0.08 * tiers + look);
  }
  // XP que juntó el carro dejado en el meet (tiempo real, con tope)
  function parkedXP(parked, now = Date.now()) {
    if (!parked) return 0;
    const min = Math.min((now - parked.since) / 60000, ECON.farmCapHours * 60);
    return Math.max(0, Math.floor(min * parked.rate));
  }

  function defaultPaint(spec) { return { color: spec.color, finish: 'solido', wrap: 'ninguno' }; }
  function defaultTuning(spec) {
    return {
      motor: 0, llantas: 0, suspension: 0, frenos: 0, rines: 0, drive: null, paint: defaultPaint(spec),
      // luces de neón: 'ninguno' | 'estatico' | 'dinamico'; patterns = patrones ya comprados
      neon: { mode: 'ninguno', colors: ['#38bdf8'], pattern: 'respirar', patterns: [] },
    };
  }

  function fresh(cars) {
    const st = {
      v: 1, money: ECON.startMoney, xp: 0,
      owned: ['pitic'], current: 'pitic',
      tuning: {}, fuel: {},
      home: null, playTime: 0,
      meetDone: -1, hiddenFound: { epoch: -1, ids: [] }, parked: null,
      stats: { bestCombo: 0, totalPoints: 0, meets: 0 },
    };
    for (const c of cars) { st.tuning[c.id] = defaultTuning(c); st.fuel[c.id] = c.tankL * 0.6; }
    return st;
  }

  function load(cars) {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
    const base = fresh(cars);
    if (!st || st.v !== 1) {
      // trae la casa de la versión anterior si existía
      try { const h = JSON.parse(localStorage.getItem('hmo.casa') || 'null'); if (h && isFinite(h.x)) base.home = h; } catch (e) { /* nada */ }
      return base;
    }
    // completa lo que falte (carros nuevos, campos nuevos)
    for (const k in base) if (st[k] === undefined) st[k] = base[k];
    for (const c of cars) {
      if (!st.tuning[c.id]) st.tuning[c.id] = defaultTuning(c);
      for (const k in base.tuning[c.id]) if (st.tuning[c.id][k] === undefined) st.tuning[c.id][k] = base.tuning[c.id][k];
      if (!isFinite(st.fuel[c.id])) st.fuel[c.id] = c.tankL * 0.6;
    }
    if (!st.owned.includes(st.current)) st.current = st.owned[0];
    return st;
  }

  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } }

  const money = (n) => '$' + Math.round(n).toLocaleString('es-MX');

  window.HmoProgress = { ECON, levelFromXP, load, save, wipe, fresh, money, defaultTuning, farmRate, parkedXP };
})();
