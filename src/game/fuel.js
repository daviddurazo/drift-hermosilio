// Gasolina: consumo, gasolineras con 4 lugares de carga, cobro al cargar y la grúa.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, save, fuel, ECON, TM, map } = G;

  // cada gasolinera: 4 lugares de carga (en metros) y el eje de la calle a la que da
  const STATIONS = (map.pois.fuel || []).map((st) => {
    const bays = st.bays.map((b) => [b[0] * TM, b[1] * TM]);
    const c = [bays.reduce((a, b) => a + b[0], 0) / bays.length, bays.reduce((a, b) => a + b[1], 0) / bays.length];
    return { c, bays, axis: st.axis };
  });
  const RESERVE_POWER = 0.12;   // sin gasolina el motor apenas empuja: alcanza para llegar a la gasolinera
  const FILL_RATE = 6;          // litros por segundo al cargar
  // lo que el HUD necesita saber de la carga
  const fs = { fueling: false, noMoney: false, paid: 0, bay: null };

  function nearestStation() {
    let best = null, bd = Infinity;
    for (const st of STATIONS) { const d = Math.hypot(st.c[0] - car.x, st.c[1] - car.y); if (d < bd) { bd = d; best = st; } }
    return best ? { pos: best.c, dist: bd, st: best } : null;
  }
  // el lugar de carga de esa gasolinera más cercano al carro
  function nearestBay(st) {
    let b = st.bays[0];
    for (const q of st.bays) if (Math.hypot(q[0] - car.x, q[1] - car.y) < Math.hypot(b[0] - car.x, b[1] - car.y)) b = q;
    return b;
  }
  // el lugar de carga donde está parado el carro (o null)
  function bayUnderCar() {
    for (const st of STATIONS) {
      if (Math.abs(st.c[0] - car.x) > 25 || Math.abs(st.c[1] - car.y) > 25) continue;
      for (const b of st.bays) if (Math.hypot(b[0] - car.x, b[1] - car.y) < 3.2) return b;
    }
    return null;
  }

  function fuelStep(dt) {
    const s = car.s;
    // litros por segundo: ralentí + acelerador, proporcional a la potencia (tiempo de juego, más rápido que el real)
    fuel[s.id] = Math.max(0, fuel[s.id] - (0.06 + 0.94 * car.thr) * s.powerKW * 0.00065 * dt);
    fs.bay = bayUnderCar();
    fs.fueling = !!fs.bay && car.tel.speed < 1.5 && fuel[s.id] < s.tankL - 0.01;
    fs.noMoney = fs.fueling && save.money < ECON.fuelPrice * 0.1;
    if (fs.fueling && !fs.noMoney) {
      // cargas lo que alcanza a pagar tu dinero
      const L = Math.min(FILL_RATE * dt, s.tankL - fuel[s.id], save.money / ECON.fuelPrice);
      fuel[s.id] += L;
      save.money -= L * ECON.fuelPrice;
      fs.paid += L * ECON.fuelPrice;
    } else if (!fs.fueling && fs.paid > 0) {
      G.showToast(`Pagaste ${G.fmtMoney(fs.paid)} de gasolina`);
      fs.paid = 0;
      G.persist();
    }
  }
  // sin gasolina el motor casi no empuja
  const powerScale = () => (fuel[car.s.id] > 0 ? 1 : RESERVE_POWER);

  // gasolinera: los 4 lugares de carga marcados con línea amarilla punteada
  function drawStations(ctx, R) {
    const cam = G.cam;
    for (const st of STATIONS) {
      if (Math.abs(st.c[0] - cam.x) > R || Math.abs(st.c[1] - cam.y) > R) continue;
      const w = st.axis === 'h' ? 8.4 : 5.2, h = st.axis === 'h' ? 5.2 : 8.4;
      for (const b of st.bays) {
        const on = fs.bay === b;
        ctx.fillStyle = on ? 'rgba(242,193,78,0.32)' : 'rgba(242,193,78,0.10)';
        ctx.fillRect(b[0] - w / 2, b[1] - h / 2, w, h);
        ctx.strokeStyle = 'rgba(242,193,78,0.9)';
        ctx.lineWidth = 0.22;
        ctx.setLineDash([0.9, 0.6]);
        ctx.strokeRect(b[0] - w / 2, b[1] - h / 2, w, h);
        ctx.setLineDash([]);
      }
    }
  }

  // ---------- grúa ----------
  // si alcanza, te deja en la gasolinera más cercana; si no, te lleva a tu casa (ahí hay bidón gratis)
  let towing = false;
  function callTow() {
    if (towing || G.garage.isOpen || G.shopUI.isOpen || G.fullMap.isOpen) return;
    towing = true;
    G.keys.clear();
    const f = document.getElementById('fundido');
    const canPay = save.money >= ECON.towPrice;
    document.getElementById('fundido-txt').textContent = canPay ? 'La grúa va en camino a la gasolinera…' : 'No te alcanza: la grúa te lleva a tu casa…';
    f.hidden = false;
    setTimeout(() => {
      G.driftScore.reset();
      G.clearRoute();
      if (canPay) {
        const st = nearestStation().st;
        const b = nearestBay(st);
        G.placeCar(b[0], b[1], st.axis === 'h' ? 0 : Math.PI / 2);
        save.money -= ECON.towPrice;
        G.showToast(`La grúa te dejó en la gasolinera (−${G.fmtMoney(ECON.towPrice)})`);
      } else {
        const paid = save.money;
        save.money = 0;
        const home = G.home;
        const p = home ? G.nearestRoadM(home.x, home.y) : G.nearestRoadM(car.x, car.y);
        G.placeCar(p[0], p[1], G.bestHeading(p[0], p[1]));
        G.showToast(`La grúa te llevó a tu casa (−${G.fmtMoney(paid)}). En tu taller hay un bidón gratis.`);
      }
      G.persist();
      f.hidden = true;
      towing = false;
      if (!canPay && G.home) G.openGarage();
    }, 1200);
  }

  function emergencyFuel() {
    fuel[save.current] = Math.max(fuel[save.current], ECON.emergencyFuelL);
    G.persist();
    G.showToast(`Te pusieron ${ECON.emergencyFuelL} L de un bidón`);
  }

  Object.assign(G, { STATIONS, fuelState: fs, nearestStation, nearestBay, fuelStep, powerScale, drawStations, callTow, emergencyFuel });
})();
