// Mapa completo (pantalla entera, para elegir destino o casa) y minimapa de la esquina.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, map, ren, TM, fuel } = G;

  const PLACES = [
    ['campana', 'Cerro de la Campana', 'peak'], ['catedral', 'Catedral', 'dot'],
    ['plaza_zaragoza', 'Plaza Zaragoza', 'dot'], ['parque_madero', 'Parque Madero', 'dot'],
  ].filter(([k]) => map.pois[k]).map(([k, label, kind]) => ({ x: (map.pois[k][0] + 0.5) * TM, y: (map.pois[k][1] + 0.5) * TM, label, kind }));

  // talleres y meet, para los dos mapas
  function mapMarkers() {
    const out = G.visibleShops().map((sh) => ({
      x: sh.x, y: sh.y, letter: 'T', color: sh.hidden ? '#c99a3c' : '#e4572e',
      label: `${sh.name} · nivel ${sh.level}`, kindLabel: sh.hidden ? 'Taller escondido' : 'Taller',
    }));
    const m = G.activeMeet();
    if (m) out.push({ x: m.x, y: m.y, letter: 'M', color: '#8b5cf6', round: true, label: 'Meet', kindLabel: 'Meet', alwaysLabel: true });
    return out;
  }

  // ---------- mapa completo ----------
  const fullMap = new HmoFullMap.FullMap({
    map, ren, TM, TILE: Hmo.TILE, streets: G.streets,
    state: () => ({ car, home: G.home, stations: G.STATIONS, places: PLACES, route: G.route, dest: G.dest, markers: mapMarkers() }),
    onClose: () => G.afterFullMap(),
    go: (sel) => {
      if (sel.kind === 'gasolinera') G.setStationDest(sel.station);
      else if (sel.kind === 'casa') G.routeHome();
      else if (sel.kindLabel === 'Meet') G.setDestination(sel.x, sel.y, 'meet');
      else G.setDestination(sel.x, sel.y, sel.kind === 'punto' && sel.title === 'Punto marcado' ? 'tu punto marcado' : sel.title);
    },
    setHome: (x, y) => G.setHome(x, y),
  });
  function openFullMap(mode) {
    G.keys.clear();
    fullMap.open(mode);
  }
  // M y el botón de mapa abren el mapa completo
  function toggleMini() { if (fullMap.isOpen) fullMap.close(); else openFullMap('destino'); }

  // ---------- minimapa ----------
  // usa la imagen de 1 px por tile del renderer; va centrado en el carro y gira igual que la cámara
  const mini = document.getElementById('minimapa');
  const mctx = mini.getContext('2d');
  function sizeMini() {
    const css = innerWidth < 700 ? 120 : 180;
    mini.style.width = mini.style.height = css + 'px';
    mini.width = mini.height = Math.round(css * G.view.dpr);
  }
  mini.addEventListener('click', () => openFullMap('destino'));
  addEventListener('resize', sizeMini);
  sizeMini();

  function drawMini() {
    const cam = G.cam, route = G.route, dest = G.dest, home = G.home;
    const S = mini.width, r = S / 2, sp = car.tel.speed;
    const radiusM = 380 + Math.min(sp, 45) * 4;
    const pxm = r / radiusM, pxt = pxm * TM;
    const g = mctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    g.fillStyle = '#14161e';
    g.fillRect(0, 0, S, S);
    g.translate(r, r);
    g.rotate(-cam.rot);
    g.imageSmoothingEnabled = true;
    g.drawImage(ren.overview, -car.x * pxm, -car.y * pxm, map.w * pxt, map.h * pxt);
    const u = G.view.dpr;
    // ruta
    if (route) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 0);
      for (let i = route.idx; i < route.pts.length; i++) g.lineTo((route.pts[i][0] - car.x) * pxm, (route.pts[i][1] - car.y) * pxm);
      g.strokeStyle = 'rgba(20,22,30,0.9)'; g.lineWidth = 3.5 * u; g.stroke();
      g.strokeStyle = '#3fc5f0'; g.lineWidth = 1.8 * u; g.stroke();
    }
    // gasolineras: cuadrito azul con una G (no giran)
    for (const st of G.STATIONS) {
      const x = (st.c[0] - car.x) * pxm, y = (st.c[1] - car.y) * pxm;
      if (Math.abs(x) > r * 1.5 || Math.abs(y) > r * 1.5) continue;
      g.save(); g.translate(x, y); g.rotate(cam.rot);
      g.fillStyle = '#4aa3c4'; g.strokeStyle = '#14161e'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.roundRect(-5 * u, -5 * u, 10 * u, 10 * u, 2 * u); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.font = `700 ${8 * u}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('G', 0, 0.5 * u);
      g.restore();
    }
    // lugares
    for (const p of PLACES) {
      const x = (p.x - car.x) * pxm, y = (p.y - car.y) * pxm;
      if (Math.hypot(x, y) > r * 1.1) continue;
      g.save(); g.translate(x, y); g.rotate(cam.rot); // los íconos y textos no giran
      g.fillStyle = '#f2c14e'; g.strokeStyle = '#14161e'; g.lineWidth = 1.5 * u;
      g.beginPath();
      if (p.kind === 'peak') { g.moveTo(0, -5 * u); g.lineTo(5 * u, 4 * u); g.lineTo(-5 * u, 4 * u); g.closePath(); }
      else g.arc(0, 0, 3.5 * u, 0, Math.PI * 2);
      g.fill(); g.stroke();
      g.restore();
    }
    // talleres y meet
    for (const mk of mapMarkers()) {
      const x = (mk.x - car.x) * pxm, y = (mk.y - car.y) * pxm;
      if (Math.abs(x) > r * 1.5 || Math.abs(y) > r * 1.5) continue;
      g.save(); g.translate(x, y); g.rotate(cam.rot);
      g.fillStyle = mk.color; g.strokeStyle = '#14161e'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.roundRect(-5 * u, -5 * u, 10 * u, 10 * u, mk.round ? 5 * u : 2 * u); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.font = `700 ${8 * u}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mk.letter, 0, 0.5 * u);
      g.restore();
    }
    // casa
    if (home) {
      const x = (home.x - car.x) * pxm, y = (home.y - car.y) * pxm;
      g.save(); g.translate(x, y); g.rotate(cam.rot);
      g.fillStyle = '#7fc77a'; g.strokeStyle = '#14161e'; g.lineWidth = 1.5 * u; g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(0, -7 * u); g.lineTo(6.5 * u, -1 * u); g.lineTo(4.5 * u, -1 * u); g.lineTo(4.5 * u, 5 * u);
      g.lineTo(-4.5 * u, 5 * u); g.lineTo(-4.5 * u, -1 * u); g.lineTo(-6.5 * u, -1 * u); g.closePath();
      g.fill(); g.stroke();
      g.restore();
    }
    // destino
    if (dest) {
      const x = (dest.x - car.x) * pxm, y = (dest.y - car.y) * pxm;
      g.fillStyle = '#3fc5f0'; g.strokeStyle = '#ffffff'; g.lineWidth = 2 * u;
      g.beginPath(); g.arc(x, y, 5 * u, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.restore();

    // tu carro: flecha al centro
    g.save();
    g.translate(r, r);
    g.rotate(car.h - cam.rot);
    g.fillStyle = '#e4572e'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 * u; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(8 * u, 0); g.lineTo(-6 * u, -5.5 * u); g.lineTo(-3 * u, 0); g.lineTo(-6 * u, 5.5 * u); g.closePath();
    g.fill(); g.stroke();
    g.restore();

    // con poca gasolina: flecha en la orilla hacia la gasolinera más cercana si no se ve
    const st = dest ? { pos: [dest.x, dest.y] } : (fuel[car.s.id] < car.s.tankL * 0.3 ? G.nearestStation() : null);
    if (st) {
      const dx = (st.pos[0] - car.x) * pxm, dy = (st.pos[1] - car.y) * pxm;
      const cr = Math.cos(-cam.rot), sr = Math.sin(-cam.rot);
      const ex = dx * cr - dy * sr, ey = dx * sr + dy * cr;
      const lim = r - 10 * u;
      if (Math.abs(ex) > lim || Math.abs(ey) > lim) {
        const k = lim / Math.max(Math.abs(ex), Math.abs(ey));
        g.save(); g.translate(r + ex * k, r + ey * k); g.rotate(Math.atan2(ey, ex));
        g.fillStyle = dest ? '#3fc5f0' : '#4aa3c4'; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 * u;
        g.beginPath(); g.moveTo(7 * u, 0); g.lineTo(-5 * u, -6 * u); g.lineTo(-5 * u, 6 * u); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    }

    // borde y norte (la N se pega a la orilla del cuadro)
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2 * u;
    g.strokeRect(u, u, S - 2 * u, S - 2 * u);
    const na = -cam.rot - Math.PI / 2, nr = r - 11 * u;
    const nk = nr / Math.max(Math.abs(Math.cos(na)), Math.abs(Math.sin(na)));
    const nx = r + Math.cos(na) * nk, ny = r + Math.sin(na) * nk;
    g.fillStyle = 'rgba(20,22,30,0.9)';
    g.beginPath(); g.arc(nx, ny, 8 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2c14e';
    g.font = `700 ${10 * u}px 'Chakra Petch', Inter, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', nx, ny + 0.5 * u);
  }

  Object.assign(G, { fullMap, openFullMap, toggleMini, drawMini });
})();
