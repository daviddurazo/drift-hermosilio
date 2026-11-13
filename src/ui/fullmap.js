// Mapa completo a pantalla entera: moverse, acercar y elegir un lugar para ir o para poner tu casa.
// No sabe nada del juego: lo que necesita lo recibe en `opts` (estado y acciones).
(function () {
  'use strict';

  const HIT = 16; // px de tolerancia para atinarle a un ícono

  class FullMap {
    constructor(opts) {
      this.o = opts;
      this.root = document.getElementById('mapa-completo');
      this.cv = document.getElementById('mapa-full');
      this.ctx = this.cv.getContext('2d');
      this.isOpen = false;
      this.cam = { x: 0, y: 0, s: 1 }; // centro en tiles, s = px de dispositivo por tile
      this.sel = null;
      this.mode = 'destino';
      this.pointers = new Map();
      this.dirty = true;
      this.bind();
    }

    get dpr() { return Math.min(window.devicePixelRatio || 1, 2); }

    fitScale() {
      const m = this.o.map;
      return Math.min(this.cv.width / m.w, this.cv.height / m.h) * 0.95;
    }

    open(mode = 'destino') {
      this.mode = mode;
      this.isOpen = true;
      this.root.hidden = false;
      this.resize();
      const { map } = this.o;
      // abre mostrando todo el mapa
      this.cam = { x: map.w / 2, y: map.h / 2, s: this.fitScale() };
      this.sel = null;
      this.updateCard();
      document.getElementById('mc-hint').textContent = mode === 'casa'
        ? 'Elige dónde quieres tu casa: haz clic en el mapa.'
        : 'Arrastra para moverte, rueda o +/− para acercar, clic para elegir un lugar.';
      this.dirty = true;
    }

    close() {
      this.isOpen = false;
      this.root.hidden = true;
      this.pointers.clear();
      if (this.o.onClose) this.o.onClose();
    }

    resize() {
      const d = this.dpr;
      this.cv.width = Math.round(innerWidth * d);
      this.cv.height = Math.round(innerHeight * d);
      this.dirty = true;
    }

    toWorld(clientX, clientY) {
      const { TM } = this.o, c = this.cam, d = this.dpr;
      const tx = (clientX * d - this.cv.width / 2) / c.s + c.x;
      const ty = (clientY * d - this.cv.height / 2) / c.s + c.y;
      return [tx * TM, ty * TM];
    }

    toScreen(xm, ym) {
      const { TM } = this.o, c = this.cam;
      return [(xm / TM - c.x) * c.s + this.cv.width / 2, (ym / TM - c.y) * c.s + this.cv.height / 2];
    }

    zoomAt(f, clientX, clientY) {
      const before = this.toWorld(clientX, clientY);
      const min = this.fitScale() * 0.8, max = this.o.TILE * 3 * this.dpr;
      this.cam.s = Math.max(min, Math.min(max, this.cam.s * f));
      const after = this.toWorld(clientX, clientY);
      this.cam.x += (before[0] - after[0]) / this.o.TM;
      this.cam.y += (before[1] - after[1]) / this.o.TM;
      this.dirty = true;
    }

    bind() {
      const cv = this.cv;
      addEventListener('resize', () => { if (this.isOpen) this.resize(); });
      cv.addEventListener('pointerdown', (e) => {
        cv.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
        this.moved = false;
        if (this.pointers.size === 2) this.pinch = this.pinchDist();
      });
      cv.addEventListener('pointermove', (e) => {
        const p = this.pointers.get(e.pointerId);
        if (!p) return;
        const d = this.dpr;
        if (this.pointers.size === 2) {
          p.x = e.clientX; p.y = e.clientY;
          const nd = this.pinchDist();
          if (this.pinch) {
            const [a, b] = [...this.pointers.values()];
            this.zoomAt(nd / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
          }
          this.pinch = nd;
          this.moved = true;
          return;
        }
        if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 5) this.moved = true;
        if (this.moved) {
          this.cam.x -= (e.clientX - p.x) * d / this.cam.s;
          this.cam.y -= (e.clientY - p.y) * d / this.cam.s;
          this.dirty = true;
        }
        p.x = e.clientX; p.y = e.clientY;
      });
      const up = (e) => {
        const wasClick = this.pointers.size === 1 && !this.moved;
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch = null;
        if (wasClick && e.type === 'pointerup') this.pick(e.clientX, e.clientY);
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });

      const btn = (id, fn) => { document.getElementById(id).onclick = (e) => { fn(); e.currentTarget.blur(); }; };
      btn('mc-mas', () => this.zoomAt(1.5, innerWidth / 2, innerHeight / 2));
      btn('mc-menos', () => this.zoomAt(1 / 1.5, innerWidth / 2, innerHeight / 2));
      btn('mc-centrar', () => {
        const st = this.o.state();
        this.cam.x = st.car.x / this.o.TM; this.cam.y = st.car.y / this.o.TM;
        this.cam.s = Math.max(this.cam.s, this.o.TILE * 0.9 * this.dpr);
        this.dirty = true;
      });
      btn('mc-cerrar', () => this.close());
      btn('mc-ir', () => { if (this.sel) { this.o.go(this.sel); this.close(); } });
      btn('mc-casa', () => { if (this.sel) { this.o.setHome(this.sel.x, this.sel.y); this.close(); } });
      btn('mc-cancelar', () => { this.sel = null; this.updateCard(); this.dirty = true; });
    }

    pinchDist() {
      const [a, b] = [...this.pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    // clic: gasolinera, casa, lugar conocido o un punto cualquiera
    pick(clientX, clientY) {
      const [wx, wy] = this.toWorld(clientX, clientY);
      const st = this.o.state();
      const d = this.dpr;
      const near = (x, y) => { const [sx, sy] = this.toScreen(x, y); return Math.hypot(sx - clientX * d, sy - clientY * d) / d < HIT; };
      let sel = null;
      if (this.mode !== 'casa') {
        if (st.home && near(st.home.x, st.home.y)) sel = { kind: 'casa', x: st.home.x, y: st.home.y, title: 'Tu casa', sub: st.home.street || '' };
        if (!sel) for (const s of st.stations) if (near(s.c[0], s.c[1])) { sel = { kind: 'gasolinera', x: s.c[0], y: s.c[1], title: 'Gasolinera', station: s }; break; }
        if (!sel) for (const m of st.markers || []) if (near(m.x, m.y)) { sel = { kind: 'lugar', x: m.x, y: m.y, title: m.label, kindLabel: m.kindLabel }; break; }
        if (!sel) for (const p of st.places) if (near(p.x, p.y)) { sel = { kind: 'lugar', x: p.x, y: p.y, title: p.label }; break; }
      }
      if (!sel) {
        const street = this.o.streets.nameAt(wx, wy, 80);
        sel = { kind: 'punto', x: wx, y: wy, title: street || 'Punto marcado', sub: street ? '' : 'Sin calle con nombre cerca' };
      }
      if (sel.kind === 'gasolinera' || sel.kind === 'lugar') {
        const street = this.o.streets.nameAt(sel.x, sel.y, 80);
        sel.sub = street || '';
      }
      const dist = Math.hypot(sel.x - st.car.x, sel.y - st.car.y);
      sel.dist = dist;
      this.sel = sel;
      this.updateCard();
      this.dirty = true;
    }

    updateCard() {
      const card = document.getElementById('mc-card');
      const s = this.sel;
      card.hidden = !s;
      if (!s) return;
      const kinds = { casa: 'Tu casa', gasolinera: 'Gasolinera', lugar: 'Lugar', punto: 'Calle' };
      document.getElementById('mc-kind').textContent = s.kindLabel || kinds[s.kind];
      document.getElementById('mc-title').textContent = s.title;
      const dist = s.dist >= 1000 ? (s.dist / 1000).toFixed(1) + ' km' : Math.round(s.dist / 10) * 10 + ' m';
      document.getElementById('mc-sub').textContent = [s.sub, `a ${dist} en línea recta`].filter(Boolean).join(' · ');
      const ir = document.getElementById('mc-ir'), casa = document.getElementById('mc-casa');
      ir.hidden = this.mode === 'casa';
      casa.hidden = s.kind === 'gasolinera' || s.kind === 'casa';
      casa.classList.toggle('primary', this.mode === 'casa');
      ir.classList.toggle('primary', this.mode !== 'casa');
    }

    draw() {
      if (!this.isOpen) return;
      const { ren, TM } = this.o;
      const g = this.ctx, W = this.cv.width, H = this.cv.height, d = this.dpr;
      const st = this.o.state();
      g.setTransform(1, 0, 0, 1, 0, 0);
      const done = ren.draw(g, this.cam.x, this.cam.y, this.cam.s, W, H, 6, 0.65);
      const S = (x, y) => this.toScreen(x, y);

      // ruta
      if (st.route) {
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath();
        const [cx, cy] = S(st.car.x, st.car.y); g.moveTo(cx, cy);
        for (let i = st.route.idx; i < st.route.pts.length; i++) { const [x, y] = S(st.route.pts[i][0], st.route.pts[i][1]); g.lineTo(x, y); }
        g.strokeStyle = 'rgba(20,22,30,0.85)'; g.lineWidth = 5 * d; g.stroke();
        g.strokeStyle = '#3fc5f0'; g.lineWidth = 2.5 * d; g.stroke();
      }

      const label = (x, y, txt) => {
        g.font = `600 ${12 * d}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'top';
        g.lineWidth = 3.5 * d; g.strokeStyle = 'rgba(20,22,30,0.9)';
        g.strokeText(txt, x, y); g.fillStyle = '#f3ede2'; g.fillText(txt, x, y);
      };

      // lugares conocidos
      for (const p of st.places) {
        const [x, y] = S(p.x, p.y);
        if (x < -100 || y < -50 || x > W + 100 || y > H + 50) continue;
        g.fillStyle = '#f2c14e'; g.strokeStyle = '#14161e'; g.lineWidth = 2 * d;
        g.beginPath();
        if (p.kind === 'peak') { g.moveTo(x, y - 7 * d); g.lineTo(x + 7 * d, y + 5 * d); g.lineTo(x - 7 * d, y + 5 * d); g.closePath(); }
        else g.arc(x, y, 5 * d, 0, Math.PI * 2);
        g.fill(); g.stroke();
        label(x, y + 9 * d, p.label);
      }
      // gasolineras
      for (const s of st.stations) {
        const [x, y] = S(s.c[0], s.c[1]);
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        g.fillStyle = '#4aa3c4'; g.strokeStyle = '#14161e'; g.lineWidth = 2 * d;
        g.beginPath(); g.roundRect(x - 8 * d, y - 8 * d, 16 * d, 16 * d, 3 * d); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.font = `700 ${11 * d}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('G', x, y + 0.5 * d);
      }
      // marcadores: talleres, meets (cuadro de color con una letra)
      for (const mk of st.markers || []) {
        const [x, y] = S(mk.x, mk.y);
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        g.fillStyle = mk.color; g.strokeStyle = '#14161e'; g.lineWidth = 2 * d;
        g.beginPath(); g.roundRect(x - 8 * d, y - 8 * d, 16 * d, 16 * d, mk.round ? 8 * d : 3 * d); g.fill(); g.stroke();
        g.fillStyle = '#fff'; g.font = `700 ${11 * d}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mk.letter, x, y + 0.5 * d);
        if (this.cam.s > this.o.TILE * 0.35 * d || mk.alwaysLabel) label(x, y + 11 * d, mk.label);
      }
      // casa
      if (st.home) {
        const [x, y] = S(st.home.x, st.home.y);
        const u = d * 1.4;
        g.fillStyle = '#7fc77a'; g.strokeStyle = '#14161e'; g.lineWidth = 2 * d; g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(x, y - 7 * u); g.lineTo(x + 6.5 * u, y - u); g.lineTo(x + 4.5 * u, y - u); g.lineTo(x + 4.5 * u, y + 5 * u);
        g.lineTo(x - 4.5 * u, y + 5 * u); g.lineTo(x - 4.5 * u, y - u); g.lineTo(x - 6.5 * u, y - u); g.closePath();
        g.fill(); g.stroke();
        label(x, y + 9 * u, 'Tu casa');
      }
      // destino actual
      if (st.dest) {
        const [x, y] = S(st.dest.x, st.dest.y);
        g.fillStyle = '#3fc5f0'; g.strokeStyle = '#fff'; g.lineWidth = 2 * d;
        g.beginPath(); g.arc(x, y, 6 * d, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      // tu carro
      {
        const [x, y] = S(st.car.x, st.car.y);
        g.save(); g.translate(x, y); g.rotate(st.car.h);
        const u = d * 1.4;
        g.fillStyle = '#e4572e'; g.strokeStyle = '#fff'; g.lineWidth = 2 * d; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(8 * u, 0); g.lineTo(-6 * u, -5.5 * u); g.lineTo(-3 * u, 0); g.lineTo(-6 * u, 5.5 * u); g.closePath();
        g.fill(); g.stroke();
        g.restore();
      }
      // selección: alfiler
      if (this.sel) {
        const [x, y] = S(this.sel.x, this.sel.y);
        const u = d;
        g.fillStyle = this.mode === 'casa' ? '#7fc77a' : '#3fc5f0'; g.strokeStyle = '#14161e'; g.lineWidth = 2 * u;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x - 4 * u, y - 8 * u, x - 9 * u, y - 12 * u, x - 9 * u, y - 18 * u);
        g.arc(x, y - 18 * u, 9 * u, Math.PI, 0);
        g.bezierCurveTo(x + 9 * u, y - 12 * u, x + 4 * u, y - 8 * u, x, y);
        g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#14161e';
        g.beginPath(); g.arc(x, y - 18 * u, 3.5 * u, 0, Math.PI * 2); g.fill();
      }
      return done;
    }
  }

  window.HmoFullMap = { FullMap };
})();
