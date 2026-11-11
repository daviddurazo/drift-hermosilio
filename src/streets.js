// Nombres de calles: busca la calle con nombre más cercana a un punto (para el tablero y las direcciones).
(function () {
  'use strict';

  class Streets {
    constructor(map, tileM) {
      const names = (map.pois && map.pois.streetNames) || [];
      const streets = (map.pois && map.pois.streets) || [];
      this.names = names;
      this.cell = 60; // metros
      this.grid = new Map();
      this.segs = []; // [x1, y1, x2, y2, nameIdx] en metros
      const k = tileM / 2; // vienen en medios tiles
      for (const [ni, pts] of streets) {
        for (let i = 2; i + 1 < pts.length; i += 2) {
          const s = [pts[i - 2] * k, pts[i - 1] * k, pts[i] * k, pts[i + 1] * k, ni];
          const id = this.segs.push(s) - 1;
          const x0 = Math.floor(Math.min(s[0], s[2]) / this.cell), x1 = Math.floor(Math.max(s[0], s[2]) / this.cell);
          const y0 = Math.floor(Math.min(s[1], s[3]) / this.cell), y1 = Math.floor(Math.max(s[1], s[3]) / this.cell);
          for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
            const key = gx + ',' + gy;
            if (!this.grid.has(key)) this.grid.set(key, []);
            this.grid.get(key).push(id);
          }
        }
      }
    }

    // nombre de la calle más cercana a (x, y) en metros, o null si no hay una a menos de maxDist
    nameAt(x, y, maxDist = 25) {
      let best = null, bd = maxDist;
      const c = this.cell, r = Math.ceil(maxDist / c);
      const gx = Math.floor(x / c), gy = Math.floor(y / c);
      for (let j = gy - r; j <= gy + r; j++) for (let i = gx - r; i <= gx + r; i++) {
        const list = this.grid.get(i + ',' + j);
        if (!list) continue;
        for (const id of list) {
          const [x1, y1, x2, y2, ni] = this.segs[id];
          const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
          const t = L2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2)) : 0;
          const d = Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t));
          if (d < bd) { bd = d; best = ni; }
        }
      }
      return best == null ? null : this.names[best];
    }
  }

  window.HmoStreets = { Streets };
})();
