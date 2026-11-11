// Tuneo: catálogo de piezas (3 niveles por categoría), su efecto en la física, pintura, y los talleres.
(function () {
  'use strict';

  // precio base por nivel; cada taller lo multiplica por su propio factor
  const PARTS = {
    motor: {
      label: 'Motor',
      opts: [
        { name: 'Servicio básico', price: 2500, desc: '+8% potencia' },
        { name: 'Servicio premium', price: 7000, desc: '+18% potencia' },
        { name: 'Servicio VIP', price: 16000, desc: '+32% potencia' },
      ],
    },
    llantas: {
      label: 'Llantas',
      opts: [
        { name: 'Calle', price: 1800, desc: '+4% agarre, derrape algo más estable' },
        { name: 'Deportivas', price: 5000, desc: '+8% agarre, derrape más estable' },
        { name: 'Semi-slick de drift', price: 11000, desc: '+13% agarre, derrape muy controlable' },
      ],
    },
    suspension: {
      label: 'Suspensión',
      opts: [
        { name: 'Genéricos', price: 2200, desc: 'Un poco más baja' },
        { name: 'Agencia', price: 6500, desc: 'Más baja, responde más rápido' },
        { name: 'Coilovers', price: 14000, desc: 'Baja y firme, volante muy rápido' },
      ],
    },
    frenos: {
      label: 'Frenos',
      opts: [
        { name: 'Genéricos', price: 1500, desc: '+8% frenado' },
        { name: 'Agencia', price: 4500, desc: '+15% frenado' },
        { name: 'Kit de alto desempeño', price: 10000, desc: '+30% frenado' },
      ],
    },
    rines: {
      label: 'Rines',
      opts: [
        { name: 'Genéricos', price: 1200, desc: '−5 kg' },
        { name: 'Agencia', price: 3500, desc: '−10 kg' },
        { name: 'Drift', price: 8000, desc: '−18 kg, la cola se suelta más fácil' },
      ],
    },
  };
  const PART_KEYS = ['motor', 'llantas', 'suspension', 'frenos', 'rines'];

  const DRIVES = {
    RWD: { name: 'Trasera', price: 8000, desc: 'Derrapa con acelerador' },
    FWD: { name: 'Delantera', price: 6000, desc: 'Estable, cuesta derrapar' },
    AWD: { name: 'Integral', price: 14000, desc: 'Mucha tracción: derrapa, pero se endereza rápido' },
  };

  const PAINT_COLORS = [
    '#ecebe4', '#c9ccd1', '#6f7680', '#22252c', '#d6332f', '#e4572e',
    '#f2c14e', '#7fc77a', '#2e8a6e', '#3fa3d6', '#2b4c9a', '#7b4cc2',
    '#d96aa8', '#8a5a3c',
  ];
  const FINISHES = {
    solido: { name: 'Sólido', price: 1200 },
    metalico: { name: 'Metálico', price: 2200 },
    perlado: { name: 'Perlado', price: 3800 },
  };
  const WRAPS = {
    ninguno: { name: 'Sin wrap', price: 0 },
    franjas: { name: 'Franjas', price: 2500 },
    dostonos: { name: 'Dos tonos', price: 3200 },
    cuadros: { name: 'Cuadros', price: 4000 },
    camuflaje: { name: 'Camuflaje desierto', price: 5000 },
  };
  const RIM_COLORS = ['#3a3e47', '#8a8f96', '#c9ced4', '#c99a3c'];

  // especificación del carro con el tuneo aplicado (lo que lee la física)
  function apply(base, t) {
    const s = Object.assign({}, base);
    const L = (k) => (t && t[k]) || 0;
    if (L('motor')) { const m = [1.08, 1.18, 1.32][L('motor') - 1]; s.powerKW = base.powerKW * m; s.topKmh = base.topKmh * (1 + (m - 1) * 0.35); }
    if (L('llantas')) { s.grip = base.grip * [1.04, 1.08, 1.13][L('llantas') - 1]; s.slideGrip = [0.4, 0.45, 0.52][L('llantas') - 1]; }
    if (L('suspension')) {
      const i = L('suspension') - 1;
      s.cgHeight = base.cgHeight * [0.95, 0.9, 0.8][i];
      s.grip = (s.grip || base.grip) * [1.0, 1.02, 1.04][i];
      s.steerSpeed = [3.4, 3.7, 4.2][i];
    }
    if (L('frenos')) s.brake = base.brake * [1.08, 1.15, 1.3][L('frenos') - 1];
    if (L('rines')) {
      const i = L('rines') - 1;
      s.mass = base.mass - [5, 10, 18][i];
      if (i === 2) s.handbrakeGrip = base.handbrakeGrip * 0.9;
    }
    if (t && t.drive) s.drive = t.drive;
    return s;
  }

  // ---- talleres ----
  const SHOP_NAMES = ['Taller El Güero', 'Mecánica Hermanos Valenzuela', 'Servicio Automotriz La Sierra', 'Taller Don Chuy',
    'Llantera y Taller El Yaqui', 'Autoservicio El Pitic', 'Taller La Campana', 'Garage del Norte', 'Mecánica Express Sonora'];
  const HIDDEN_NAMES = ['El Taller del Compa', 'Garage Sin Nombre', 'Los del Callejón'];

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // 3 talleres por nivel; dentro de cada nivel uno barato, uno normal y uno caro
  function normalShops(pois, tileM) {
    const list = (pois.shops || []).map((s, i) => ({ i, x: s.c[0] * tileM, y: s.c[1] * tileM, axis: s.axis }));
    const r = rng(4242);
    const order = shuffle(list.map((_, i) => i), r);
    const levels = [1, 1, 1, 2, 2, 2, 3, 3, 3];
    const bands = [[0.78, 0.9], [0.95, 1.08], [1.15, 1.35]];
    return order.map((idx, k) => {
      const s = list[idx];
      const level = levels[k % 9];
      const band = bands[k % 3];
      const mult = band[0] + r() * (band[1] - band[0]);
      return { id: 'n' + idx, name: SHOP_NAMES[k % SHOP_NAMES.length], x: s.x, y: s.y, axis: s.axis, level, mult: Math.round(mult * 100) / 100, hidden: false };
    });
  }

  // 3 talleres escondidos de calidad: cambian de lugar cada `epoch`
  function hiddenShops(pois, tileM, epoch) {
    const spots = pois.hiddenSpots || [];
    if (!spots.length) return [];
    const r = rng(9001 + epoch * 7919);
    const pick = shuffle(spots.map((_, i) => i), r).slice(0, 3);
    return pick.map((idx, k) => ({
      id: 'h' + epoch + '-' + idx, name: HIDDEN_NAMES[k], x: (spots[idx][0] + 0.5) * tileM, y: (spots[idx][1] + 0.5) * tileM,
      level: 3, mult: Math.round((0.72 + r() * 0.15) * 100) / 100, hidden: true,
    }));
  }

  // lo que un taller ofrece según su nivel
  const shopOffers = (shop) => ({
    maxTier: shop.level,                         // nivel 1: solo lo básico; 3: todo
    drive: shop.level >= 2,                      // cambio de tracción desde nivel 2
    finishes: shop.level >= 3 ? ['solido', 'metalico', 'perlado'] : shop.level === 2 ? ['solido', 'metalico'] : ['solido'],
    wraps: shop.level >= 3 ? Object.keys(WRAPS) : shop.level === 2 ? ['ninguno', 'franjas', 'dostonos'] : ['ninguno'],
  });

  // la clase del carro también mueve el precio
  const CAR_FACTOR = { pitic: 0.85, mezquite: 1.0, choya: 1.2 };
  const price = (base, shop, carId) => Math.round(base * shop.mult * (CAR_FACTOR[carId] || 1) / 50) * 50;

  window.HmoTuning = { PARTS, PART_KEYS, DRIVES, PAINT_COLORS, FINISHES, WRAPS, RIM_COLORS, apply, normalShops, hiddenShops, shopOffers, price, rng };
})();
