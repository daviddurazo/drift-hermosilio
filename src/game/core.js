// Núcleo del juego: mapa, superficies, partida guardada, el carro, el canvas y los avisos.
// Crea window.HmoGame (G). Los demás archivos de src/game/ le cuelgan sus funciones y su estado,
// y se llaman entre sí a través de G (por eso el orden de los <script> solo importa para lo que corre al cargar).
(function () {
  'use strict';

  const { HmoMap, Renderer } = Hmo;
  const { CARS, makeSprite } = HmoCars;
  const { Car } = HmoPhysics;

  const G = (window.HmoGame = {});

  const map = new HmoMap(window.HMO_MAP);
  const ren = new Renderer(map);
  ren.maxCache = 120;
  const TM = map.tileM;

  // ---------- superficies ----------
  // grip multiplica la fricción de la llanta; drag frena (pasto, tierra, agua)
  const PAVED = { grip: 1.0, drag: 0.0, kind: 'paved', name: 'Calle' };
  const SURF = {
    1: PAVED, 2: PAVED,
    3: { grip: 0.95, drag: 0.05, kind: 'paved', name: 'Banqueta' },
    4: { grip: 1.0, drag: 0.0, kind: 'paved', name: 'Estacionamiento' },
    5: { grip: 0.9, drag: 0.05, kind: 'paved', name: 'Plaza' },
    6: { grip: 0.55, drag: 0.6, kind: 'grass', name: 'Pasto' },
    14: { grip: 0.55, drag: 0.6, kind: 'grass', name: 'Pasto' },
    7: { grip: 0.6, drag: 0.5, kind: 'grass', name: 'Cancha' },
    8: { grip: 0.85, drag: 0.1, kind: 'dirt', name: 'Andador' },
    9: { grip: 0.35, drag: 2.5, kind: 'water', name: 'Agua' },
    11: { grip: 0.85, drag: 0.1, kind: 'paved', name: 'Escuela' },
    13: { grip: 0.6, drag: 0.5, kind: 'dirt', name: 'Matorral' },
    15: { grip: 0.6, drag: 0.5, kind: 'dirt', name: 'Matorral' },
    16: { grip: 0.7, drag: 0.3, kind: 'dirt', name: 'Terracería' },
    17: { grip: 0.9, drag: 0.05, kind: 'paved', name: 'Pista' },
    19: { grip: 1.0, drag: 0.0, kind: 'paved', name: 'Gasolinera' },
    27: { grip: 0.95, drag: 0.0, kind: 'paved', name: 'Taller' },
  };
  const CERRO = { grip: 0.65, drag: 0.4, kind: 'dirt', name: 'Cerro' };
  const OUT = { grip: 1, drag: 0, kind: 'paved', name: '—' };
  const surfOf = (id) => SURF[id] || (id >= 20 && id <= 24 ? CERRO : OUT);

  const world = {
    tileM: TM,
    solidAt: (tx, ty) => map.solid(map.get(tx, ty)),
    surface: (x, y) => surfOf(map.get(Math.floor(x / TM), Math.floor(y / TM))),
  };

  // ---------- calles: dónde aparecer y hacia dónde mirar ----------
  const isRoad = (id) => id === 1 || id === 2;
  function nearestRoad(tx, ty) {
    for (let r = 0; r < 120; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx, y = ty + dy;
          if (isRoad(map.get(x, y)) && isRoad(map.get(x + 1, y)) && isRoad(map.get(x, y + 1)) && isRoad(map.get(x + 1, y + 1))) {
            return [(x + 1) * TM, (y + 1) * TM];
          }
        }
      }
    }
    return [map.w * TM / 2, map.h * TM / 2];
  }
  // la calle más cercana a un punto en metros
  const nearestRoadM = (x, y) => nearestRoad(Math.floor(x / TM), Math.floor(y / TM));
  function bestHeading(x, y) {
    let best = 0, bestD = -1;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8;
      let d = 0;
      while (d < 150 && isRoad(map.get(Math.floor((x + Math.cos(a) * d) / TM), Math.floor((y + Math.sin(a) * d) / TM)))) d += 1.5;
      if (d > bestD) { bestD = d; best = a; }
    }
    return best;
  }
  const poi = map.pois.plaza_zaragoza || [map.w / 2, map.h / 2];
  const SPAWN = nearestRoad(poi[0], poi[1]);
  const SPAWN_H = bestHeading(SPAWN[0], SPAWN[1]);

  const night = new HmoNight.Night(map, TM);
  const streets = new HmoStreets.Streets(map, TM);

  // ---------- partida guardada (dinero, Street XP, carros, tuneo, gasolina, casa) ----------
  const save = HmoProgress.load(CARS);
  G.home = save.home;
  function persist() { save.home = G.home; HmoProgress.save(save); }

  const baseOf = (id) => CARS.find((c) => c.id === id);
  const specOf = (id) => HmoTuning.apply(baseOf(id), save.tuning[id]);
  // el dibujo depende de la pintura: se guarda en caché por carro + pintura
  const spriteCache = new Map();
  function spriteFor(id) {
    const paint = save.tuning[id].paint;
    const key = id + JSON.stringify(paint);
    if (!spriteCache.has(key)) spriteCache.set(key, makeSprite(baseOf(id), paint));
    return spriteCache.get(key);
  }

  // ---------- el carro ----------
  const start = G.home ? nearestRoadM(G.home.x, G.home.y) : SPAWN;
  const car = new Car(specOf(save.current), start[0], start[1], G.home ? bestHeading(start[0], start[1]) : SPAWN_H);
  function applyCurrentCar() { car.setSpec(specOf(save.current)); G.updateCarPanel(); }
  function stopCar() { car.vx = car.vy = car.w = 0; car.steer = 0; car.thr = 0; }
  // pone el carro en un lugar, parado, y la cámara encima
  function placeCar(x, y, h) {
    car.x = x; car.y = y; car.h = h;
    stopCar();
    G.resetMarks();
    G.cam.x = car.x; G.cam.y = car.y; G.cam.rot = car.h + Math.PI / 2;
  }
  // R: a la calle más cercana (la cámara lo sigue sola)
  function resetCar() {
    const p = nearestRoadM(car.x, car.y);
    car.x = p[0]; car.y = p[1];
    car.h = bestHeading(p[0], p[1]);
    car.vx = car.vy = car.w = 0; car.steer = 0;
    G.resetMarks();
  }

  // ---------- canvas ----------
  const cv = document.getElementById('juego');
  const ctx = cv.getContext('2d');
  const view = { dpr: 1, vw: 0, vh: 0 };
  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.vw = cv.width = Math.round(innerWidth * view.dpr);
    view.vh = cv.height = Math.round(innerHeight * view.dpr);
  }
  addEventListener('resize', resize);
  resize();

  // ---------- avisos ----------
  let toastTimer = 0, popTimer = 0;
  function showToast(text) {
    const t = document.getElementById('aviso');
    t.textContent = text;
    t.hidden = false;
    toastTimer = 2.8;
  }
  // letrero grande de puntos o XP; tipo: 'bank' | 'fail' | 'xp'
  function popup(text, tipo) {
    const p = document.getElementById('drift-pop');
    p.textContent = text; p.dataset.tipo = tipo; p.hidden = false;
    popTimer = 2.2;
  }
  function tickNotices(dt) {
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) document.getElementById('aviso').hidden = true; }
    if (popTimer > 0) { popTimer -= dt; if (popTimer <= 0) document.getElementById('drift-pop').hidden = true; }
  }

  Object.assign(G, {
    map, ren, TM, CARS, world, ECON: HmoProgress.ECON, fmtMoney: HmoProgress.money,
    nearestRoad, nearestRoadM, bestHeading, night, streets,
    save, fuel: save.fuel, persist, baseOf, specOf, spriteFor,
    car, applyCurrentCar, stopCar, placeCar, resetCar,
    ctx, view, showToast, popup, tickNotices,
  });
})();
