// Modo noche: una capa oscura a media resolución donde cada luz "abre un hoyo" (postes, faros, gasolineras),
// y luego un brillo cálido encima. Los postes vienen del mapa (pois.lamps), algunos en grupos apagados.
(function () {
  'use strict';

  const DARK = 'rgba(8, 12, 34, 0.84)';
  const RES = 0.5; // resolución de la capa de oscuridad respecto a la pantalla

  // sprite circular: centro opaco que se desvanece (para recortar oscuridad o como brillo)
  function radial(size, stops) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return cv;
  }

  // haz de faros: cuña hacia +x que se desvanece con la distancia
  function cone(w, h, spread) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(0, h / 2, 0, 0, h / 2, w);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, h / 2 - h * 0.04);
    g.lineTo(w, h / 2 - h * spread);
    g.lineTo(w, h / 2 + h * spread);
    g.lineTo(0, h / 2 + h * 0.04);
    g.closePath();
    g.fill();
    return cv;
  }

  // brillo de un color (neones); se guardan en caché con el color redondeado a 8 niveles por canal
  const glowCache = new Map();
  function glow(r, g, b) {
    const q = (v) => Math.max(0, Math.min(7, Math.round(v * 7)));
    const key = (q(r) << 6) | (q(g) << 3) | q(b);
    if (!glowCache.has(key)) {
      const c = (v) => Math.round(q(v) / 7 * 255);
      const rgb = `${c(r)},${c(g)},${c(b)}`;
      glowCache.set(key, radial(64, [[0, `rgba(${rgb},0.85)`], [0.45, `rgba(${rgb},0.35)`], [1, `rgba(${rgb},0)`]]));
    }
    return glowCache.get(key);
  }
  // brillo de neón en el piso; ctx ya debe estar en coordenadas del carro (metros, x al frente)
  function drawNeon(ctx, spots, size, alpha) {
    if (!spots) return;
    for (const p of spots) {
      if (p.i < 0.02) continue;
      ctx.globalAlpha = Math.min(1, p.i * alpha);
      ctx.drawImage(glow(p.r, p.g, p.b), p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  class Night {
    constructor(map, tileM) {
      this.cv = document.createElement('canvas');
      this.g = this.cv.getContext('2d');
      this.cut = radial(128, [[0, 'rgba(0,0,0,1)'], [0.35, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,0)']]);
      this.warm = radial(128, [[0, 'rgba(255,176,90,0.55)'], [0.4, 'rgba(255,150,60,0.18)'], [1, 'rgba(255,150,60,0)']]);
      this.white = radial(128, [[0, 'rgba(235,245,255,0.6)'], [0.5, 'rgba(200,225,255,0.15)'], [1, 'rgba(200,225,255,0)']]);
      this.red = radial(64, [[0, 'rgba(255,40,30,0.7)'], [1, 'rgba(255,40,30,0)']]);
      this.beam = cone(256, 160, 0.42);
      this.beamGlow = (() => {
        const cv = cone(256, 160, 0.42);
        const g = cv.getContext('2d');
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = 'rgba(255,244,210,0.22)';
        g.fillRect(0, 0, cv.width, cv.height);
        return cv;
      })();

      // postes en metros, con una cuadrícula para encontrar rápido los que se ven
      const raw = (map.pois && map.pois.lamps) || [];
      this.lamps = new Float32Array(raw.length * 3);
      this.cell = 60;
      this.grid = new Map();
      raw.forEach((l, i) => {
        const x = l[0] / 10 * tileM, y = l[1] / 10 * tileM;
        this.lamps[i * 3] = x; this.lamps[i * 3 + 1] = y; this.lamps[i * 3 + 2] = l[2];
        const k = Math.floor(x / this.cell) + ',' + Math.floor(y / this.cell);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(i);
      });
    }

    visibleLamps(cx, cy, R) {
      const out = [];
      const c = this.cell;
      for (let gy = Math.floor((cy - R) / c); gy <= Math.floor((cy + R) / c); gy++) {
        for (let gx = Math.floor((cx - R) / c); gx <= Math.floor((cx + R) / c); gx++) {
          const list = this.grid.get(gx + ',' + gy);
          if (list) for (const i of list) out.push(i);
        }
      }
      return out;
    }

    // ctx debe tener la transformación del mundo (metros) ya puesta. lights: { cars, stations }
    draw(ctx, vw, vh, cx, cy, R, lights) {
      const w = Math.ceil(vw * RES), h = Math.ceil(vh * RES);
      if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
      const g = this.g;
      const m = ctx.getTransform();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, w, h);
      g.fillStyle = DARK;
      g.fillRect(0, 0, w, h);
      g.setTransform(m.a * RES, m.b * RES, m.c * RES, m.d * RES, m.e * RES, m.f * RES);
      g.globalCompositeOperation = 'destination-out';

      const vis = this.visibleLamps(cx, cy, R);
      const L = this.lamps;
      const LR = 13; // radio de luz de un poste, en metros
      for (const i of vis) {
        if (!L[i * 3 + 2]) continue;
        g.drawImage(this.cut, L[i * 3] - LR, L[i * 3 + 1] - LR, LR * 2, LR * 2);
      }
      for (const st of lights.stations) {
        if (Math.abs(st[0] - cx) > R || Math.abs(st[1] - cy) > R) continue;
        g.drawImage(this.cut, st[0] - 20, st[1] - 20, 40, 40);
        g.drawImage(this.cut, st[0] - 20, st[1] - 20, 40, 40);
      }
      for (const car of lights.cars) {
        // faros
        g.save(); g.translate(car.x, car.y); g.rotate(car.h);
        g.drawImage(this.beam, car.s.length / 2 - 0.4, -11, 34, 22);
        g.drawImage(this.cut, -4, -4, 8, 8); // un poco de luz alrededor del carro
        if (car.neon) {
          for (const p of car.neon) {
            if (p.i < 0.02) continue;
            g.globalAlpha = Math.min(1, p.i * 0.8);
            g.drawImage(this.cut, p.x - 2.6, p.y - 2.6, 5.2, 5.2);
          }
          g.globalAlpha = 1;
        }
        g.restore();
      }

      // oscuridad sobre la escena
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.cv, 0, 0, vw, vh);
      ctx.restore();

      // brillos encima (suman luz)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const i of vis) {
        if (!L[i * 3 + 2]) continue;
        ctx.drawImage(this.warm, L[i * 3] - 9, L[i * 3 + 1] - 9, 18, 18);
      }
      for (const st of lights.stations) {
        if (Math.abs(st[0] - cx) > R || Math.abs(st[1] - cy) > R) continue;
        ctx.drawImage(this.white, st[0] - 16, st[1] - 16, 32, 32);
      }
      for (const car of lights.cars) {
        ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.h);
        ctx.drawImage(this.beamGlow, car.s.length / 2 - 0.4, -11, 34, 22);
        const L2 = car.s.length / 2, W2 = car.s.width / 2;
        const br = car.braking ? 2.6 : 1.4;
        ctx.drawImage(this.red, -L2 - br / 2, -W2 + 0.2 - br / 2, br, br);
        ctx.drawImage(this.red, -L2 - br / 2, W2 - 0.2 - br / 2, br, br);
        drawNeon(ctx, car.neon, 3.4, 0.45); // un poco de luz de color encima, como reflejo
        ctx.restore();
      }
      ctx.restore();

      // cabezas de los postes: punto brillante si está prendido, gris si no
      for (const i of vis) {
        const on = L[i * 3 + 2];
        ctx.fillStyle = on ? '#ffe2a8' : '#4a4d58';
        ctx.beginPath(); ctx.arc(L[i * 3], L[i * 3 + 1], on ? 0.35 : 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  window.HmoNight = { Night, glow, drawNeon };
})();
