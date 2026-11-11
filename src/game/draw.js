// Dibujo del mundo: mapa, marcas, gasolineras, talleres, meet, casa, el carro, humo, noche y ruta.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, save, ctx, ren, TM, view } = G;
  const { MARGIN } = HmoCars;

  function render() {
    const cam = G.cam, vw = view.vw, vh = view.vh;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const rotating = Math.abs(cam.rot) > 0.0005;
    const D = Math.ceil(Math.hypot(vw, vh));
    const viewW = rotating ? D : vw, viewH = rotating ? D : vh;
    const sx = (Math.random() - 0.5) * cam.shake * view.dpr, sy = (Math.random() - 0.5) * cam.shake * view.dpr;
    ctx.translate(vw / 2 + sx, vh / 2 + sy);
    if (rotating) ctx.rotate(-cam.rot);
    ctx.translate(-viewW / 2, -viewH / 2);
    ren.draw(ctx, cam.x / TM, cam.y / TM, cam.pxm * TM, viewW, viewH, 4);

    // a partir de aquí, coordenadas en metros
    ctx.translate(viewW / 2 - cam.x * cam.pxm, viewH / 2 - cam.y * cam.pxm);
    ctx.scale(cam.pxm, cam.pxm);
    const R = Math.max(viewW, viewH) / cam.pxm;

    G.drawMarks(ctx, R);
    G.drawStations(ctx, R);
    G.drawShops(ctx, R);
    G.drawMeet(ctx);
    drawHome();
    // neones del carro: el mismo color en el piso, en la noche y en la vitrina
    const neon = HmoTuning.neonSpots(HmoTuning.neonOf(save.tuning[save.current]), performance.now() / 1000, car.s.length, car.s.width);
    drawCar(neon);
    G.drawSmoke(ctx);

    // de noche siempre: oscuridad con postes, faros y gasolineras; la ruta va encima para que se vea
    const meet = G.activeMeet();
    G.night.draw(ctx, vw, vh, cam.x, cam.y, R * 0.6 + 20, {
      cars: [{ x: car.x, y: car.y, h: car.h, s: car.s, braking: G.lastInput.brake > 0 && car.tel.u > 0.5, neon }],
      stations: G.STATIONS.map((st) => st.c).concat(G.visibleShops().map((sh) => [sh.x, sh.y]), meet ? [[meet.x, meet.y]] : []),
    });
    G.drawRoute(ctx);
  }

  // casa: aro verde punteado
  function drawHome() {
    const home = G.home;
    if (!home) return;
    ctx.save();
    ctx.translate(home.x, home.y);
    ctx.fillStyle = 'rgba(127,199,122,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(127,199,122,0.9)'; ctx.lineWidth = 0.25; ctx.setLineDash([0.8, 0.5]);
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawCar(neon) {
    const s = car.s, L = s.length, W = s.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    // luz de neón en el piso, alrededor del carro. Con 'lighten' cada canal toma el máximo en vez de sumarse:
    // brilla igual, pero los focos encimados ya no se vuelven una mancha blanca (el color se queda como lo elegiste).
    if (neon) {
      ctx.save();
      ctx.rotate(car.h);
      ctx.globalCompositeOperation = 'lighten';
      const out = neon.map((p) => Object.assign({}, p, { x: p.x * 1.06, y: p.y * 1.15 }));
      HmoNight.drawNeon(ctx, out, 3.8, 0.95);
      ctx.restore();
    }
    // sombra fija hacia el sureste, como la del mapa
    ctx.save();
    ctx.translate(0.35, 0.5);
    ctx.rotate(car.h);
    ctx.fillStyle = 'rgba(25,22,45,0.3)';
    ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 0.35); ctx.fill();
    ctx.restore();

    ctx.rotate(car.h);
    const hw = W / 2 - 0.08;
    const rim = HmoTuning.RIM_COLORS[save.tuning[save.current].rines || 0];
    const wheel = (x, y, st) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(st);
      ctx.fillStyle = '#15171c'; ctx.fillRect(-0.32, -0.13, 0.64, 0.26);
      ctx.fillStyle = rim; ctx.fillRect(-0.18, -0.06, 0.36, 0.12);
      ctx.restore();
    };
    wheel(car.a, -hw, car.steer); wheel(car.a, hw, car.steer);
    wheel(-car.b, -hw, 0); wheel(-car.b, hw, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(G.spriteFor(save.current), -L / 2 - MARGIN, -W / 2 - MARGIN, L + MARGIN * 2, W + MARGIN * 2);
    // luces de freno
    if (G.lastInput.brake > 0 && car.tel.u > 0.5 || car.tel.handbrake) {
      ctx.fillStyle = 'rgba(255,60,50,0.95)';
      ctx.fillRect(-L / 2 + 0.02, -W / 2 + 0.1, 0.11, 0.38);
      ctx.fillRect(-L / 2 + 0.02, W / 2 - 0.48, 0.11, 0.38);
      ctx.fillStyle = 'rgba(255,60,50,0.25)';
      ctx.fillRect(-L / 2 - 0.5, -W / 2 + 0.02, 0.55, 0.55);
      ctx.fillRect(-L / 2 - 0.5, W / 2 - 0.57, 0.55, 0.55);
    }
    ctx.restore();
  }

  G.render = render;
})();
