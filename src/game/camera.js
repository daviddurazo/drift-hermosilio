// Cámara que sigue al carro. Por defecto gira con él: el frente siempre apunta hacia arriba
// y el volante coincide con la pantalla.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car } = G;

  const cam = { x: car.x, y: car.y, rot: car.h + Math.PI / 2, pxm: 10, rotate: true, shake: 0 };

  function updateCamera(dt) {
    const sp = Math.hypot(car.vx, car.vy);
    const look = Math.min(18, sp * 0.35) / Math.max(sp, 0.001);
    const tx = car.x + car.vx * look, ty = car.y + car.vy * look;
    const k = 1 - Math.exp(-dt * 6);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    // más lejos mientras más rápido
    const visible = 70 + 75 * Math.min(1, Math.max(0, (sp - 4) / 40));
    const target = Math.min(G.view.vw, G.view.vh * 1.6) / visible;
    cam.pxm += (target - cam.pxm) * (1 - Math.exp(-dt * 2.2));
    // de lado, la cámara sigue a medias la dirección en que se desliza el carro: se ve cruzado sin que el mapa gire de golpe
    const t = car.tel;
    const slide = sp > 4 && t.u > 0 ? 0.6 * Math.atan2(t.v, Math.abs(t.u)) : 0;
    const goal = cam.rotate ? car.h + slide + Math.PI / 2 : 0;
    let d = goal - cam.rot;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.rot += d * (1 - Math.exp(-dt * (cam.rotate ? 4.5 : 8)));
    cam.shake *= Math.exp(-dt * 9);
  }

  function toggleCamera() {
    cam.rotate = !cam.rotate;
    const b = document.getElementById('btn-cam');
    b.setAttribute('aria-pressed', cam.rotate);
    b.textContent = cam.rotate ? 'Cámara: gira con el carro' : 'Cámara: norte arriba';
  }

  Object.assign(G, { cam, updateCamera, toggleCamera });
})();
