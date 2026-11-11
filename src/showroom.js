// Vitrina 3D: carrusel de carros de vóxeles en WebGL. Se desliza a la izquierda o a la derecha
// (con el dedo, el mouse, las flechas de la pantalla o del teclado). Los carros que no tienes salen en negro.
(function () {
  'use strict';

  const VS = `
    attribute vec3 aPos; attribute vec3 aNor; attribute float aAO; attribute vec3 aCol; attribute vec2 aES;
    uniform mat4 uVP; uniform mat4 uM;
    varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying vec3 vX;
    void main() {
      vec4 w = uM * vec4(aPos, 1.0);
      vW = w.xyz; vN = (uM * vec4(aNor, 0.0)).xyz; vCol = aCol; vX = vec3(aAO, aES);
      gl_Position = uVP * w;
    }`;
  const FS = `
    precision mediump float;
    uniform vec3 uEye; uniform float uBlack; uniform float uDim;
    varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying vec3 vX;
    void main() {
      vec3 n = normalize(vN);
      vec3 v = normalize(uEye - vW);
      vec3 l1 = normalize(vec3(-0.35, 0.9, 0.45));  // luz de arriba, cálida
      vec3 l2 = normalize(vec3(0.7, 0.25, -0.6));   // contraluz fría
      float k = max(dot(n, l1), 0.0), r = max(dot(n, l2), 0.0), sky = 0.5 + 0.5 * n.y;
      float ao = vX.x;
      vec3 c = vCol * (vec3(1.0, 0.95, 0.86) * k * 0.85 + vec3(0.55, 0.65, 0.9) * r * 0.45 + 0.2 + 0.18 * sky) * ao;
      vec3 h = normalize(l1 + v);
      float rim = 1.0 - max(dot(n, v), 0.0);
      c += vec3(1.0, 0.97, 0.9) * pow(max(dot(n, h), 0.0), 32.0) * vX.z * ao;
      c += vec3(0.6, 0.7, 0.9) * rim * rim * rim * 0.12 * vX.z;
      c = mix(c, vCol * 1.15, vX.y);
      vec3 blk = vec3(0.018, 0.019, 0.024) * (0.6 + 0.8 * k) + vec3(0.05, 0.06, 0.09) * rim * rim * 0.6;
      gl_FragColor = vec4(mix(c, blk, uBlack) * uDim, 1.0);
    }`;
  // sombra suave bajo el carro
  const SVS = `
    attribute vec2 aQ; uniform mat4 uVP; uniform mat4 uM; uniform vec2 uSize; varying vec2 vQ;
    void main() { vQ = aQ; gl_Position = uVP * uM * vec4(aQ.x * uSize.x, 0.004, aQ.y * uSize.y, 1.0); }`;
  const SFS = `
    precision mediump float; uniform float uA; varying vec2 vQ;
    void main() {
      vec2 q = abs(vQ);
      float d = pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25);
      gl_FragColor = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.45, 1.0, d)) * uA);
    }`;
  // neón: luz de color en el piso, suma de 8 focos alrededor del carro
  const NVS = `
    attribute vec2 aQ; uniform mat4 uVP; uniform mat4 uM; uniform vec2 uSize; varying vec2 vP;
    void main() { vP = aQ * uSize; gl_Position = uVP * uM * vec4(vP.x, 0.006, vP.y, 1.0); }`;
  const NFS = `
    precision mediump float; uniform vec4 uS[8]; uniform vec2 uSP[8]; varying vec2 vP;
    void main() {
      vec3 c = vec3(0.0);
      for (int i = 0; i < 8; i++) { vec2 d = vP - uSP[i]; c += uS[i].rgb * uS[i].a * exp(-dot(d, d) / 0.8); }
      c = min(c * 0.9, vec3(1.0));
      gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
    }`;

  function program(gl, vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES), nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i).name; loc[a] = gl.getAttribLocation(p, a); }
    for (let i = 0; i < nu; i++) { const u = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); loc[u] = gl.getUniformLocation(p, u); }
    return { p, loc };
  }

  // ---------- matrices (column-major, como las quiere WebGL) ----------
  function persp(fy, a, n, f) {
    const t = 1 / Math.tan(fy / 2);
    return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0];
  }
  function lookAt(e, c) {
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = nrm(sub(e, c)), x = nrm(cross([0, 1, 0], z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
  }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  // gira en Y (el frente del carro es +x) y lo mueve a x
  function model(x, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, 0, 0, 1];
  }

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

      let gl = null;
      try { gl = this.cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); } catch (e) { gl = null; }
      this.gl = gl;
      if (gl) {
        try {
          this.prog = program(gl, VS, FS);
          this.shadow = program(gl, SVS, SFS);
          this.neonProg = program(gl, NVS, NFS);
          this.quad = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
        } catch (e) { console.warn('Vitrina 3D sin WebGL:', e); this.gl = null; }
      }

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

    upload(it) {
      const gl = this.gl;
      let g = this.gpu.get(it.id);
      if (!g) {
        const mesh = HmoModel3D.build(it.spec);
        const stat = new Float32Array(mesh.verts * 7);
        for (let v = 0; v < mesh.verts; v++) {
          stat.set([mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2], mesh.nor[v * 3], mesh.nor[v * 3 + 1], mesh.nor[v * 3 + 2], mesh.ao[v]], v * 7);
        }
        g = { mesh, stat: gl.createBuffer(), dyn: gl.createBuffer(), key: '' };
        gl.bindBuffer(gl.ARRAY_BUFFER, g.stat);
        gl.bufferData(gl.ARRAY_BUFFER, stat, gl.STATIC_DRAW);
        this.gpu.set(it.id, g);
      }
      const key = JSON.stringify([it.paint, it.rim]);
      if (key !== g.key) {
        g.key = key;
        gl.bindBuffer(gl.ARRAY_BUFFER, g.dyn);
        gl.bufferData(gl.ARRAY_BUFFER, HmoModel3D.colors(g.mesh, it.spec, it.paint, it.rim), gl.DYNAMIC_DRAW);
      }
    }

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
      const gl = this.gl;
      this.resize();
      const cam = this.camera();
      gl.viewport(0, 0, this.cv.width, this.cv.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const eye = [0, TARGET_Y + Math.sin(ELEV) * cam.dist, Math.cos(ELEV) * cam.dist];
      const vp = mul(persp(FOVY, cam.aspect, 0.5, 80), lookAt(eye, [0, TARGET_Y, 0]));
      const visible = this.items.map((it, i) => ({ it, i, off: i - this.pos })).filter((o) => Math.abs(o.off) < 1.8 && this.gpu.has(o.it.id));

      // sombras
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      const S = this.shadow;
      gl.useProgram(S.p);
      gl.uniformMatrix4fv(S.loc.uVP, false, vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(S.loc.aQ);
      gl.vertexAttribPointer(S.loc.aQ, 2, gl.FLOAT, false, 0, 0);
      for (const o of visible) {
        const m = this.gpu.get(o.it.id).mesh;
        gl.uniformMatrix4fv(S.loc.uM, false, model(o.off * cam.spacing, this.yaw));
        gl.uniform2f(S.loc.uSize, m.length / 2 + 0.35, m.width / 2 + 0.3);
        gl.uniform1f(S.loc.uA, 0.55 * (1 - Math.min(1, Math.abs(o.off)) * 0.4));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.disableVertexAttribArray(S.loc.aQ);
      this.drawNeon(visible, vp, cam);

      // carros
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      const P = this.prog, Lc = P.loc;
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(Lc.uVP, false, vp);
      gl.uniform3fv(Lc.uEye, eye);
      for (const k of ['aPos', 'aNor', 'aAO', 'aCol', 'aES']) gl.enableVertexAttribArray(Lc[k]);
      for (const o of visible) {
        const g = this.gpu.get(o.it.id);
        gl.uniformMatrix4fv(Lc.uM, false, model(o.off * cam.spacing, this.yaw));
        gl.uniform1f(Lc.uBlack, o.it.owned ? 0 : 1);
        gl.uniform1f(Lc.uDim, 1 - Math.min(1, Math.abs(o.off)) * 0.45);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.stat);
        gl.vertexAttribPointer(Lc.aPos, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(Lc.aNor, 3, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(Lc.aAO, 1, gl.FLOAT, false, 28, 24);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.dyn);
        gl.vertexAttribPointer(Lc.aCol, 3, gl.FLOAT, false, 20, 0);
        gl.vertexAttribPointer(Lc.aES, 2, gl.FLOAT, false, 20, 12);
        gl.drawArrays(gl.TRIANGLES, 0, g.mesh.verts);
      }
      for (const k of ['aPos', 'aNor', 'aAO', 'aCol', 'aES']) gl.disableVertexAttribArray(Lc[k]);
    }

    // luces de neón de los carros que tienes
    drawNeon(visible, vp, cam) {
      const gl = this.gl, N = this.neonProg, t = performance.now() / 1000;
      const lit = visible.filter((o) => o.it.owned && o.it.neon && o.it.neon.mode !== 'ninguno');
      if (!lit.length) return;
      gl.useProgram(N.p);
      gl.uniformMatrix4fv(N.loc.uVP, false, vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(N.loc.aQ);
      gl.vertexAttribPointer(N.loc.aQ, 2, gl.FLOAT, false, 0, 0);
      const col = new Float32Array(32), pos = new Float32Array(16);
      for (const o of lit) {
        const m = this.gpu.get(o.it.id).mesh;
        const spots = HmoTuning.neonSpots(o.it.neon, t, m.length, m.width);
        const dim = 1 - Math.min(1, Math.abs(o.off)) * 0.45;
        spots.forEach((p, i) => {
          col.set([p.r, p.g, p.b, p.i * dim], i * 4);
          pos.set([p.x, p.y], i * 2);
        });
        gl.uniform4fv(N.loc.uS, col);
        gl.uniform2fv(N.loc.uSP, pos);
        gl.uniformMatrix4fv(N.loc.uM, false, model(o.off * cam.spacing, this.yaw));
        gl.uniform2f(N.loc.uSize, m.length / 2 + 1.6, m.width / 2 + 1.6);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.disableVertexAttribArray(N.loc.aQ);
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
