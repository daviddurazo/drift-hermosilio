// Rutas: A* sobre la cuadrícula del mapa (8 direcciones). Prefiere calles; banqueta, pasto y tierra cuestan más.
(function () {
  'use strict';

  // costo por tile (por metro relativo); Infinity = no se puede pasar
  const COST = new Float32Array(256).fill(Infinity);
  const set = (ids, c) => ids.forEach((i) => { COST[i] = c; });
  set([1, 2], 1);             // calle
  set([4, 19, 27], 1.6);      // estacionamiento, patio de gasolinera o taller
  set([3], 4);                // banqueta
  set([5, 17], 5);            // plaza, pista
  set([8, 11, 16], 6);        // andador, escuela, terracería
  set([13, 20, 21, 22, 23, 24], 10); // matorral y cerro
  set([6, 7], 12);            // pasto, cancha
  set([9], 40);               // agua

  class Router {
    constructor(map) {
      this.map = map;
      const N = map.w * map.h;
      this.g = new Float32Array(N);
      this.came = new Int32Array(N);
      this.seen = new Uint32Array(N);
      this.closed = new Uint32Array(N);
      this.stamp = 0;
      this.heapN = new Int32Array(1 << 22);
      this.heapF = new Float32Array(1 << 22);
    }

    passable(x, y) { return COST[this.map.get(x, y) & 255] < Infinity && this.map.get(x, y) >= 0; }

    // el tile transitable más cercano (prefiere calle) dentro de un radio
    snap(x, y, r = 20, roadOnly = false) {
      for (let k = 0; k <= r; k++) {
        let best = null;
        for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue;
          const id = this.map.get(x + dx, y + dy);
          if (id < 0) continue;
          const c = COST[id];
          if (c === Infinity || (roadOnly && c > 1.6)) continue;
          if (!best || c < best[2]) best = [x + dx, y + dy, c];
        }
        if (best) return [best[0], best[1]];
      }
      return null;
    }

    // devuelve lista de tiles [[x,y], ...] o null
    find(sx, sy, gx, gy, maxExpand = 1500000) {
      const m = this.map, W = m.w, H = m.h, t = m.t;
      const st = ++this.stamp;
      const { g, came, seen, closed, heapN, heapF } = this;
      const start = sy * W + sx, goal = gy * W + gx;
      let hn = 0;
      const push = (n, f) => {
        if (hn >= heapN.length) return;
        let i = hn++;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (heapF[p] <= f) break;
          heapN[i] = heapN[p]; heapF[i] = heapF[p]; i = p;
        }
        heapN[i] = n; heapF[i] = f;
      };
      const pop = () => {
        const top = heapN[0];
        const n = heapN[--hn], f = heapF[hn];
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= hn) break;
          if (c + 1 < hn && heapF[c + 1] < heapF[c]) c++;
          if (heapF[c] >= f) break;
          heapN[i] = heapN[c]; heapF[i] = heapF[c]; i = c;
        }
        heapN[i] = n; heapF[i] = f;
        return top;
      };
      const h = (x, y) => {
        const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
        return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
      };
      g[start] = 0; seen[start] = st; came[start] = -1;
      push(start, h(sx, sy));
      let expanded = 0;
      const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
      while (hn > 0) {
        const cur = pop();
        if (closed[cur] === st) continue;
        closed[cur] = st;
        if (cur === goal) {
          const out = [];
          for (let n = cur; n !== -1; n = came[n]) out.push([n % W, (n / W) | 0]);
          return out.reverse();
        }
        if (++expanded > maxExpand) return null;
        const cx = cur % W, cy = (cur / W) | 0, gc = g[cur];
        for (let k = 0; k < 8; k++) {
          const nx = cx + DX[k], ny = cy + DY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          const c = COST[t[n]];
          if (c === Infinity || closed[n] === st) continue;
          let step = c;
          if (k >= 4) {
            // diagonal: no cortar esquinas de cosas sólidas
            if (COST[t[cy * W + nx]] === Infinity || COST[t[ny * W + cx]] === Infinity) continue;
            step = c * Math.SQRT2;
          }
          const ng = gc + step;
          if (seen[n] !== st || ng < g[n]) {
            seen[n] = st; g[n] = ng; came[n] = cur;
            push(n, ng + h(nx, ny));
          }
        }
      }
      return null;
    }
  }

  // tiles -> puntos en metros, quitando los que siguen en línea recta
  function toPoints(tiles, tileM) {
    const pts = [];
    for (let i = 0; i < tiles.length; i++) {
      if (i > 0 && i < tiles.length - 1) {
        const [ax, ay] = tiles[i - 1], [bx, by] = tiles[i], [cx, cy] = tiles[i + 1];
        if (bx - ax === cx - bx && by - ay === cy - by && i % 6 !== 0) continue;
      }
      pts.push([(tiles[i][0] + 0.5) * tileM, (tiles[i][1] + 0.5) * tileM]);
    }
    return pts;
  }

  window.HmoRoute = { Router, toPoints, COST };
})();
