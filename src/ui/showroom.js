// Vitrina 3D: carrusel de carros de vóxeles en WebGL. Se desliza a la izquierda o a la derecha
// (con el dedo, el mouse, las flechas de la pantalla o del teclado). Los carros que no tienes salen en negro.
(function () {
  'use strict';

  const { model } = HmoGL;
  const carM = (x, yaw) => model(x, 0, 0, yaw);

  const FOVY = (26 * Math.PI) / 180, ELEV = 0.23, TARGET_Y = 0.55;

  class Showroom {
    // host: un div vacío. onSelect(id) se llama cuando el usuario cambia de carro.
    constructor(host, { onSelect } = {}) {
      this.host = host;
      this.onSelect = onSelect || (() => {});
      this.items = [];
      this.pos = 0; this.target = 0;
      this.yaw = -0.7;
      this.running = false;
      this.gpu = new Map();
      this.drag = null;
      this.last = 0;

      host.classList.add('vitrina-3d');
      this.cv = document.createElement('canvas');
      this.cv.setAttribute('aria-label', 'Vitrina: desliza para ver los otros carros');
      const mkBtn = (cls, label, txt, d) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'v-flecha ' + cls; b.textContent = txt;
        b.setAttribute('aria-label', label);
        b.onclick = () => { this.step(d); b.blur(); };
        return b;
      };
      this.prev = mkBtn('v-izq', 'Carro anterior', '‹', -1);
      this.next = mkBtn('v-der', 'Carro siguiente', '›', 1);
      this.dots = document.createElement('div'); this.dots.className = 'v-puntos';
      this.badge = document.createElement('p'); this.badge.className = 'v-badge';
      host.replaceChildren(this.cv, this.prev, this.next, this.dots, this.badge);

      this.r = new HmoGL.Renderer(this.cv);
      this.gl = this.r.ok ? this.r.gl : null;

      this.bindPointer();
      this.loop = (t) => this.frame(t);
    }

    // ---------- datos ----------
    // items: [{ id, spec, paint, rim, owned, badge, badgeType }]
    setItems(items) {
      const sameList = items.length === this.items.length && items.every((it, i) => it.id === this.items[i].id);
      this.items = items;
      if (!sameList) {
        this.dots.replaceChildren(...items.map((it, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', it.spec.name);
          b.onclick = () => { this.go(i); b.blur(); };
          return b;
        }));
      }
      if (this.gl) for (const it of items) this.upload(it);
      this.updateChrome();
    }
    select(id, instant) {
      const i = this.items.findIndex((it) => it.id === id);
      if (i < 0) return;
      this.target = i;
      if (instant) this.pos = i;
      this.updateChrome();
    }
    step(d) { this.go(Math.round(this.target) + d); }
    go(i) {
      i = Math.max(0, Math.min(this.items.length - 1, i));
      const changed = i !== this.target;
      this.target = i;
      this.updateChrome();
      if (changed) this.onSelect(this.items[i].id);
    }
    updateChrome() {
      const i = this.target, it = this.items[i];
      this.prev.disabled = i <= 0;
      this.next.disabled = i >= this.items.length - 1;
      [...this.dots.children].forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
      if (it) {
        this.badge.textContent = it.badge || '';
        this.badge.dataset.tipo = it.badgeType || '';
        this.badge.hidden = !it.badge;
      }
    }

    upload(it) { this.gpu.set(it.id, this.r.car(it.spec, it.paint, it.rim)); }

    // ---------- arrastre ----------
    bindPointer() {
      const cv = this.cv;
      cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !this.items.length) return;
        this.drag = { x: e.clientX, pos: this.pos, lx: e.clientX, lt: performance.now(), v: 0, moved: false, id: e.pointerId };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
        cv.classList.add('arrastrando');
      });
      cv.addEventListener('pointermove', (e) => {
        const d = this.drag;
        if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 5) d.moved = true;
        const now = performance.now(), dt = Math.max(1, now - d.lt);
        d.v = d.v * 0.6 + ((e.clientX - d.lx) / dt) * 0.4; // px/ms
        d.lx = e.clientX; d.lt = now;
        let p = d.pos - dx / this.pxPerSlot();
        const max = this.items.length - 1;
        if (p < 0) p = p * 0.3; else if (p > max) p = max + (p - max) * 0.3; // resistencia en las orillas
        this.pos = p;
      });
      const end = (e) => {
        const d = this.drag;
        if (!d || e.pointerId !== d.id) return;
        this.drag = null;
        cv.classList.remove('arrastrando');
        if (d.moved) {
          if (performance.now() - d.lt > 120) d.v = 0;
          const fling = (-d.v * 220) / this.pxPerSlot(); // proyección del aventón
          const base = this.pos + Math.max(-1, Math.min(1, fling));
          this.go(Math.round(base));
        } else if (e.type === 'pointerup') {
          // un toque en la orilla también cambia de carro
          const r = cv.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
          if (fx < 0.22) this.step(-1); else if (fx > 0.78) this.step(1);
        }
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
    }

    // ---------- cámara ----------
    camera() {
      const W = this.cv.clientWidth || 1, H = this.cv.clientHeight || 1, aspect = W / H;
      const tanH = Math.tan(FOVY / 2);
      const dist = Math.max(5.3 / (2 * tanH * aspect * 0.84), 2.7 / (2 * tanH * 0.9));
      const visW = 2 * dist * tanH * aspect;
      const spacing = Math.max(5.1, visW * 0.6);
      return { W, H, aspect, dist, visW, spacing };
    }
    pxPerSlot() { const c = this.camera(); return (c.W / c.visW) * c.spacing; }

    // ---------- ciclo ----------
    start() {
      if (this.running) return;
      this.running = true;
      this.last = 0;
      this.pos = this.target;
      requestAnimationFrame(this.loop);
    }
    stop() { this.running = false; this.drag = null; }

    frame(t) {
      if (!this.running) return;
      requestAnimationFrame(this.loop);
      const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
      this.last = t;
      if (!this.drag) this.pos += (this.target - this.pos) * (1 - Math.exp(-dt * 9));
      if (Math.abs(this.target - this.pos) < 1e-4) this.pos = this.target;
      this.yaw += dt * 0.32;
      if (this.gl) this.draw(); else this.drawFlat();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(this.cv.clientWidth * dpr), h = Math.round(this.cv.clientHeight * dpr);
      if (w && h && (this.cv.width !== w || this.cv.height !== h)) { this.cv.width = w; this.cv.height = h; }
    }

    draw() {
      const r = this.r;
      const cam = this.camera();
      const eye = [0, TARGET_Y + Math.sin(ELEV) * cam.dist, Math.cos(ELEV) * cam.dist];
      r.begin(eye, [0, TARGET_Y, 0], FOVY, 80);
      const t = performance.now() / 1000;
      const visible = this.items.map((it, i) => ({ it, off: i - this.pos })).filter((o) => Math.abs(o.off) < 1.8 && this.gpu.has(o.it.id));
      const dimOf = (o) => 1 - Math.min(1, Math.abs(o.off)) * 0.45;
      r.shadows(visible.map((o) => {
        const m = this.gpu.get(o.it.id).mesh;
        return { M: carM(o.off * cam.spacing, this.yaw), sx: m.length / 2 + 0.35, sz: m.width / 2 + 0.3, a: 0.55 * (1 - Math.min(1, Math.abs(o.off)) * 0.4) };
      }));
      // luces de neón de los carros que tienes
      r.glows(visible.filter((o) => o.it.owned && o.it.neon && o.it.neon.mode !== 'ninguno').map((o) => {
        const m = this.gpu.get(o.it.id).mesh, dim = dimOf(o);
        const spots = HmoTuning.neonSpots(o.it.neon, t, m.length, m.width).map((p) => Object.assign(p, { i: p.i * dim }));
        return { M: carM(o.off * cam.spacing, this.yaw), sx: m.length / 2 + 1.6, sz: m.width / 2 + 1.6, spots, spread: [1.06, 1.2], sig: 0.7, gain: 0.75 };
      }));
      r.meshes(visible.map((o) => ({ h: this.gpu.get(o.it.id), M: carM(o.off * cam.spacing, this.yaw), black: !o.it.owned, dim: dimOf(o) })), 1);
    }

    // sin WebGL: el dibujo plano de siempre, visto desde arriba
    drawFlat() {
      this.resize();
      const g = this.cv.getContext('2d');
      if (!g) return;
      const W = this.cv.width, H = this.cv.height;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      const cam = this.camera();
      for (let i = 0; i < this.items.length; i++) {
        const off = i - this.pos;
        if (Math.abs(off) > 1.5) continue;
        const it = this.items[i];
        let spr = HmoCars.makeSprite(it.spec, it.paint);
        if (!it.owned) {
          // silueta negra
          const c2 = document.createElement('canvas');
          c2.width = spr.width; c2.height = spr.height;
          const g2 = c2.getContext('2d');
          g2.drawImage(spr, 0, 0);
          g2.globalCompositeOperation = 'source-in';
          g2.fillStyle = '#050608';
          g2.fillRect(0, 0, c2.width, c2.height);
          spr = c2;
        }
        const k = Math.min((W * 0.7) / spr.width, (H * 0.6) / spr.height);
        g.save();
        g.translate(W / 2 + off * (W / cam.visW) * cam.spacing, H / 2);
        g.globalAlpha = 1 - Math.min(1, Math.abs(off)) * 0.5;
        g.drawImage(spr, (-spr.width * k) / 2, (-spr.height * k) / 2, spr.width * k, spr.height * k);
        g.restore();
      }
    }
  }

  window.HmoShowroom = { Showroom };
})();
