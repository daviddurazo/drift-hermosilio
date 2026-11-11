// HUD: velocímetro, ángulo, superficie, calle, gasolina, ruta, dinero, Street XP, combo y botones.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, save, fuel } = G;
  const { levelFromXP } = HmoProgress;

  const el = (id) => document.getElementById(id);
  const hud = { speed: el('vel'), angle: el('angulo'), bar: el('angulo-bar'), surf: el('superficie'), gasL: el('gas-l'), gasBar: el('gas-bar'), gasMsg: el('gas-msg'), routeInfo: el('ruta-info'), quitar: el('btn-quitar'), street: el('calle') };
  const km = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m');

  function updateCarPanel() {
    const s = car.s;
    el('carro-nombre').textContent = s.name;
    el('carro-datos').textContent = `${Math.round(s.powerKW)} kW · ${Math.round(s.mass)} kg · tracción ${s.drive === 'RWD' ? 'trasera' : s.drive === 'FWD' ? 'delantera' : 'integral'}`;
  }

  let lastMoneyTxt = '', lastLevel = -1;
  function updateProgressHud() {
    const m = G.fmtMoney(save.money);
    if (m !== lastMoneyTxt) { el('hud-dinero').textContent = m; lastMoneyTxt = m; }
    const lv = levelFromXP(save.xp);
    if (lv.level !== lastLevel) { el('hud-nivel').textContent = 'Nivel ' + lv.level; lastLevel = lv.level; }
    el('hud-xpbar').style.width = (lv.frac * 100).toFixed(1) + '%';
    // combo de drift
    const ds = G.driftScore;
    const dh = el('drift-hud');
    const on = ds.state !== 'idle' && ds.combo >= 1;
    dh.hidden = !on;
    if (on) {
      el('drift-pts').textContent = Math.round(ds.combo).toLocaleString('es-MX');
      const mult = ds.chainMult * ds.durMult;
      el('drift-mult').textContent = `x${mult.toFixed(1)}${ds.chain > 1 ? ` · ${ds.chain} encadenados` : ''}`;
      el('drift-grace').style.width = (ds.state === 'grace' ? ds.graceT / HmoDrift.CFG.grace * 100 : 100) + '%';
    }
    const pt = G.promptText();
    const pe = el('prompt');
    if (pe.textContent !== pt) pe.textContent = pt;
    pe.hidden = !pt;
  }

  let streetTimer = 0, driftAngle = 0;
  function updateHud() {
    const t = car.tel;
    hud.speed.textContent = Math.round(t.speed * 3.6);
    const ang = t.speed > 5 ? Math.abs(t.beta) * 180 / Math.PI : 0;
    driftAngle += (ang - driftAngle) * 0.2;
    hud.angle.textContent = Math.round(driftAngle) + '°';
    hud.bar.style.width = Math.min(100, driftAngle / 60 * 100) + '%';
    hud.bar.dataset.on = driftAngle > 12 ? '1' : '0';
    hud.surf.textContent = t.surfR ? t.surfR.name : '—';
    streetTimer -= 1;
    if (streetTimer <= 0) {
      streetTimer = 15;
      const n = G.streets.nameAt(car.x, car.y, 20);
      hud.street.textContent = n || '—';
    }
    const s = car.s, f = fuel[s.id], frac = f / s.tankL, fs = G.fuelState;
    hud.gasL.textContent = `${Math.round(f)} / ${s.tankL} L`;
    hud.gasBar.style.width = (frac * 100).toFixed(1) + '%';
    hud.gasBar.dataset.nivel = f <= 0 || frac < 0.12 ? 'reserva' : frac < 0.3 ? 'bajo' : 'ok';
    let msg = '';
    if (fs.fueling && fs.noMoney) msg = 'No te alcanza para gasolina. Derrapa para juntar dinero.';
    else if (fs.fueling) msg = `Cargando gasolina… ${G.fmtMoney(fs.paid)}`;
    else if (f <= 0) msg = 'Sin gasolina. El motor apenas empuja: llega a una gasolinera (G azul) o llama a la grúa.';
    else if (frac < 0.3) { const st = G.nearestStation(); if (st) msg = `Gasolinera más cercana: ${km(st.dist)}`; }
    if (hud.gasMsg.textContent !== msg) hud.gasMsg.textContent = msg;
    el('btn-grua').hidden = !(f <= 0.5 || (fs.fueling && fs.noMoney));
    const route = G.route;
    const rt = route ? `Ruta a ${G.dest.label}: ${km(route.remaining)}` : '';
    if (hud.routeInfo.textContent !== rt) hud.routeInfo.textContent = rt;
    hud.quitar.hidden = !route;
  }

  function toggleHelp() {
    const h = el('ayuda');
    h.hidden = !h.hidden;
  }

  // botones: después del clic se quita el foco para que Espacio (freno de mano) no los vuelva a activar
  const btn = (id, fn) => { el(id).onclick = (e) => { fn(); e.currentTarget.blur(); }; };
  btn('btn-cam', () => G.toggleCamera());
  btn('btn-reset', () => G.resetCar());
  btn('btn-ayuda', toggleHelp);
  btn('btn-gas', () => G.routeToNearestStation());
  btn('btn-quitar', () => G.clearRoute());
  btn('btn-mapa', () => G.toggleMini());
  btn('btn-casa', () => G.routeHome());
  btn('btn-poner-casa', () => G.startHomeMode());
  btn('btn-grua', () => G.callTow());

  Object.assign(G, { updateCarPanel, updateProgressHud, updateHud, toggleHelp });
  updateCarPanel();
})();
