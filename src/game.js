// Bucle principal: física a paso fijo de 120 Hz y, en cada cuadro, rutas, meets, talleres, cámara, dibujo y HUD.
// Todo lo demás vive en src/game/ y se comparte por window.HmoGame (G).
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, save, cam } = G;

  function physicsStep(dt, inp) {
    inp.powerScale = G.powerScale();
    const impact = car.step(dt, inp, G.world);
    G.fuelStep(dt);
    save.playTime += dt;
    const ev = G.driftScore.update(dt, car.tel, impact);
    if (ev) G.onDriftEvent(ev);
    if (impact > 3) cam.shake = Math.min(14, cam.shake + impact * 0.8);
    G.skidStep();
  }

  const DT = 1 / 120;
  let acc = 0, last = performance.now();
  let autosave = 5, parkedTick = 0;
  addEventListener('beforeunload', G.persist);

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    G.tickNotices(dt);
    if (G.paused()) {
      // en pausa: el mapa completo se dibuja; las pantallas de taller tapan todo
      if (G.fullMap.isOpen) G.fullMap.draw();
      if (G.garage.isOpen && save.parked && (parkedTick -= dt) <= 0) { parkedTick = 1; G.garage.renderParked(save); }
      acc = 0;
      requestAnimationFrame(frame);
      return;
    }
    G.lastInput = G.readInput();
    acc += dt;
    while (acc >= DT) { physicsStep(DT, G.lastInput); acc -= DT; }
    G.updateSmoke(dt);
    G.routeStep(dt, now);
    G.meetStep(dt);
    G.shopsStep();
    autosave -= dt;
    if (autosave <= 0) { autosave = 5; G.persist(); }
    G.updateCamera(dt);
    G.render();
    G.drawMini();
    G.updateHud();
    G.updateProgressHud();
    requestAnimationFrame(frame);
  }

  // cada vez que entras al juego empiezas en tu taller
  G.garage.open();
  requestAnimationFrame(frame);
})();
