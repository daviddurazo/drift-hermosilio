// Rutas con A* sobre las calles, destino actual y tu casa.
// G.route y G.dest son el estado que leen el mapa completo, el minimapa y el HUD.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, map, TM } = G;

  const router = new HmoRoute.Router(map);
  G.dest = null;   // { x, y, label, station }
  G.route = null;  // { pts, cum, total, idx, remaining }
  let offTimer = 0, lastReroute = 0;

  function buildRoute(tx, ty) {
    const s0 = router.snap(Math.floor(car.x / TM), Math.floor(car.y / TM), 8);
    const g0 = router.snap(Math.floor(tx / TM), Math.floor(ty / TM), 25);
    if (!s0 || !g0) return null;
    const tiles = router.find(s0[0], s0[1], g0[0], g0[1]);
    if (!tiles) return null;
    const pts = HmoRoute.toPoints(tiles, TM);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, total: cum[cum.length - 1], idx: 0, remaining: cum[cum.length - 1] };
  }
  function setDestination(x, y, label, station) {
    const r = buildRoute(x, y);
    if (!r) { G.showToast('No encontré camino a ese punto'); return; }
    G.dest = { x, y, label, station: station || null };
    G.route = r;
    offTimer = 0;
    G.showToast('Ruta a ' + label);
  }
  function setStationDest(st) {
    const b = G.nearestBay(st);
    setDestination(b[0], b[1], 'Gasolinera', st);
  }
  function routeToNearestStation() {
    // de las 3 más cercanas en línea recta, la de ruta más corta
    const near = G.STATIONS.slice().sort((a, b) => Math.hypot(a.c[0] - car.x, a.c[1] - car.y) - Math.hypot(b.c[0] - car.x, b.c[1] - car.y)).slice(0, 3);
    let best = null;
    for (const st of near) {
      const r = buildRoute(st.bays[0][0], st.bays[0][1]);
      if (r && (!best || r.total < best.r.total)) best = { st, r };
    }
    if (!best) { G.showToast('No encontré camino a una gasolinera'); return; }
    setStationDest(best.st);
  }
  function clearRoute() { G.dest = null; G.route = null; }

  // ---------- casa ----------
  function startHomeMode() { G.openFullMap('casa'); }
  function setHome(x, y) {
    const t = router.snap(Math.floor(x / TM), Math.floor(y / TM), 20);
    if (!t) { G.showToast('Ahí no se puede llegar en carro, elige otro lugar'); return; }
    const hx = (t[0] + 0.5) * TM, hy = (t[1] + 0.5) * TM;
    const street = G.streets.nameAt(hx, hy, 80);
    G.home = { x: hx, y: hy, street };
    G.persist();
    G.showToast(street ? 'Tu casa quedó en ' + street : 'Tu casa quedó marcada');
  }
  function routeHome() {
    if (!G.home) { startHomeMode(); return; }
    setDestination(G.home.x, G.home.y, 'casa');
  }

  // avanza sobre la ruta, detecta la llegada y recalcula si te sales
  function routeStep(dt, now) {
    const route = G.route, dest = G.dest;
    if (!route) return;
    const pts = route.pts;
    let bi = route.idx, bd = Infinity;
    for (let i = route.idx; i < Math.min(pts.length, route.idx + 40); i++) {
      const d = Math.hypot(pts[i][0] - car.x, pts[i][1] - car.y);
      if (d < bd) { bd = d; bi = i; }
    }
    route.idx = bi;
    route.remaining = route.total - route.cum[bi] + bd;
    const arrived = dest.station
      ? dest.station.bays.some((b) => Math.hypot(b[0] - car.x, b[1] - car.y) < 5)
      : Math.hypot(dest.x - car.x, dest.y - car.y) < 12;
    if (arrived) { G.showToast(dest.station ? 'Llegaste a la gasolinera: detente en un lugar amarillo' : 'Llegaste a tu destino'); clearRoute(); return; }
    // fuera de la ruta: recalcula
    offTimer = bd > 18 ? offTimer + dt : 0;
    if (offTimer > 0.7 && now - lastReroute > 1000) {
      lastReroute = now; offTimer = 0;
      const r = buildRoute(dest.x, dest.y);
      if (r) G.route = r;
    }
  }

  // ruta: línea punteada que avanza, sobre las calles, unos 350 m por delante
  function drawRoute(ctx) {
    const route = G.route, dest = G.dest;
    if (!route) return;
    const pts = route.pts;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(car.x, car.y);
    for (let i = route.idx, n = 0; i < pts.length && n < 140; i++, n++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = 'rgba(20,40,60,0.3)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = 'rgba(63,197,240,0.9)'; ctx.lineWidth = 0.35;
    ctx.setLineDash([1.1, 1.0]); ctx.lineDashOffset = -performance.now() / 1000 * 5;
    ctx.stroke();
    ctx.setLineDash([]);
    // destino: aro que late
    const k = 1 + Math.sin(performance.now() / 300) * 0.15;
    ctx.strokeStyle = '#3fc5f0'; ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.arc(dest.x, dest.y, 2.2 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(63,197,240,0.2)';
    ctx.beginPath(); ctx.arc(dest.x, dest.y, 2.2 * k, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  Object.assign(G, { setDestination, setStationDest, routeToNearestStation, clearRoute, startHomeMode, setHome, routeHome, routeStep, drawRoute });
})();
