// Motor 3D mínimo en WebGL (sin librerías) para todo lo que es de cubitos: la vitrina, el editor de personaje
// y la escena del meet. Dibuja mallas de cubitos (HmoVoxels, HmoModel3D), sombras suaves en el piso y luces de color en el piso.
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
  // uExpo: cuánta luz hay (1 en la vitrina; menos de noche en el meet). Lo emisivo (faros, ventanas) no cambia.
  const FS = `
    precision mediump float;
    uniform vec3 uEye; uniform float uBlack; uniform float uDim; uniform float uExpo;
    varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying vec3 vX;
    void main() {
      vec3 n = normalize(vN);
      vec3 v = normalize(uEye - vW);
      vec3 l1 = normalize(vec3(-0.35, 0.9, 0.45));  // luz de arriba, cálida
      vec3 l2 = normalize(vec3(0.7, 0.25, -0.6));   // contraluz fría
      float k = max(dot(n, l1), 0.0), r = max(dot(n, l2), 0.0), sky = 0.5 + 0.5 * n.y;
      float ao = vX.x;
      vec3 c = vCol * (vec3(1.0, 0.95, 0.86) * k * 0.85 + vec3(0.55, 0.65, 0.9) * r * 0.45 + 0.2 + 0.18 * sky) * ao * uExpo;
      vec3 h = normalize(l1 + v);
      float rim = 1.0 - max(dot(n, v), 0.0);
      c += vec3(1.0, 0.97, 0.9) * pow(max(dot(n, h), 0.0), 32.0) * vX.z * ao * uExpo;
      c += vec3(0.6, 0.7, 0.9) * rim * rim * rim * 0.12 * vX.z;
      c = mix(c, vCol * 1.15, vX.y);
      vec3 blk = vec3(0.018, 0.019, 0.024) * (0.6 + 0.8 * k) + vec3(0.05, 0.06, 0.09) * rim * rim * 0.6;
      gl_FragColor = vec4(mix(c, blk, uBlack) * uDim, 1.0);
    }`;
  // sombra suave en el piso (rectángulo de esquinas redondas que se desvanece)
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
  // luz de color en el piso: hasta 8 focos (neones, postes, faros)
  const NVS = `
    attribute vec2 aQ; uniform mat4 uVP; uniform mat4 uM; uniform vec2 uSize; varying vec2 vP;
    void main() { vP = aQ * uSize; gl_Position = uVP * uM * vec4(vP.x, 0.006, vP.y, 1.0); }`;
  const NFS = `
    precision mediump float; uniform vec4 uS[8]; uniform vec2 uSP[8]; uniform vec2 uSpread; uniform float uSig; uniform float uGain;
    varying vec2 vP;
    void main() {
      vec3 c = vec3(0.0);
      // se suman los focos, pero si un canal pasa de 1 se escala todo junto: conserva el tono y nunca llega a blanco
      for (int i = 0; i < 8; i++) {
        vec2 d = vP - uSP[i] * uSpread;
        c += uS[i].rgb * uS[i].a * exp(-dot(d, d) / uSig);
      }
      c *= uGain;
      float top = max(c.r, max(c.g, c.b));
      if (top > 1.0) c /= top;
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
    // los arreglos se llaman "uS[0]" en unos navegadores y "uS" en otros
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
  // mueve a (x, y, z) y gira en Y; con el frente del modelo en +x, yaw = 0 mira a +x
  function model(x, y, z, yaw) {
    const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1];
  }
  // inclinación sobre el eje x local (para recargarse hacia atrás)
  function tiltX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  }

  class Renderer {
    constructor(cv) {
      this.cv = cv;
      this.gl = null;
      this.shapes = new Map(); // id del modelo → forma en la GPU (se sube una vez)
      this.paints = new Map(); // lugar (slot) → colores de ese carro (se rehacen solo si cambia la pintura)
      this.floorDepth = false; // true: sombras y luces respetan el piso 3D (escena del meet)
      let gl = null;
      try { gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }); } catch (e) { gl = null; }
      if (!gl) return;
      try {
        this.prog = program(gl, VS, FS);
        this.shadowProg = program(gl, SVS, SFS);
        this.glowProg = program(gl, NVS, NFS);
        this.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
        this.gl = gl;
      } catch (e) { console.warn('3D sin WebGL:', e); }
    }
    get ok() { return !!this.gl; }

    // ---------- mallas ----------
    upload(m) {
      const gl = this.gl;
      const h = { verts: m.verts, stat: gl.createBuffer(), dyn: gl.createBuffer(), size: m.size };
      gl.bindBuffer(gl.ARRAY_BUFFER, h.stat); gl.bufferData(gl.ARRAY_BUFFER, m.stat, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, h.dyn); gl.bufferData(gl.ARRAY_BUFFER, m.dyn, gl.DYNAMIC_DRAW);
      return h;
    }
    free(h) { if (h && this.gl) { this.gl.deleteBuffer(h.stat); this.gl.deleteBuffer(h.dyn); } }
    // carro con su pintura y rines. La forma se sube una vez por modelo; cada lugar (slot) tiene sus propios
    // colores, que solo se rehacen si cambia la pintura. Sin slot, el lugar es el modelo (vitrina).
    car(spec, paint, rim, slot) {
      const gl = this.gl;
      let shape = this.shapes.get(spec.id);
      if (!shape) {
        const mesh = HmoModel3D.build(spec);
        const stat = new Float32Array(mesh.verts * 7);
        for (let v = 0; v < mesh.verts; v++) {
          stat.set([mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2], mesh.nor[v * 3], mesh.nor[v * 3 + 1], mesh.nor[v * 3 + 2], mesh.ao[v]], v * 7);
        }
        shape = { mesh, stat: gl.createBuffer() };
        gl.bindBuffer(gl.ARRAY_BUFFER, shape.stat); gl.bufferData(gl.ARRAY_BUFFER, stat, gl.STATIC_DRAW);
        this.shapes.set(spec.id, shape);
      }
      const slotKey = slot || spec.id;
      let p = this.paints.get(slotKey);
      if (!p) { p = { dyn: gl.createBuffer(), key: '' }; this.paints.set(slotKey, p); }
      const k = JSON.stringify([spec.id, paint, rim]);
      if (k !== p.key) {
        p.key = k;
        gl.bindBuffer(gl.ARRAY_BUFFER, p.dyn);
        gl.bufferData(gl.ARRAY_BUFFER, HmoModel3D.colors(shape.mesh, spec, paint, rim), gl.DYNAMIC_DRAW);
      }
      const m = shape.mesh;
      return { verts: m.verts, mesh: m, stat: shape.stat, dyn: p.dyn, size: { x: m.length, y: m.height, z: m.width } };
    }

    // ---------- cuadro ----------
    // prepara el lienzo y la cámara; devuelve las medidas en px de CSS
    begin(eye, target, fovy, far) {
      const gl = this.gl, cv = this.cv;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const aspect = (cv.clientWidth || 1) / (cv.clientHeight || 1);
      this.eye = eye;
      this.vp = mul(persp(fovy, aspect, 0.3, far || 80), lookAt(eye, target));
      return { W: cv.clientWidth || 1, H: cv.clientHeight || 1, aspect };
    }

    quadPass(P, list, set) {
      const gl = this.gl;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (this.floorDepth) {
        // encima del piso ya dibujado: respeta la profundidad (banquetas tapan) pero no la escribe
        gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -8);
      } else gl.disable(gl.DEPTH_TEST);
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.loc.uVP, false, this.vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(P.loc.aQ);
      gl.vertexAttribPointer(P.loc.aQ, 2, gl.FLOAT, false, 0, 0);
      for (const o of list) { set(o); gl.drawArrays(gl.TRIANGLES, 0, 6); }
      gl.disableVertexAttribArray(P.loc.aQ);
      gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // sombras: [{ M, sx, sz, a }] (medio ancho en x y en z, en metros)
    shadows(list) {
      const gl = this.gl, P = this.shadowProg;
      this.quadPass(P, list, (o) => {
        gl.uniformMatrix4fv(P.loc.uM, false, o.M);
        gl.uniform2f(P.loc.uSize, o.sx, o.sz);
        gl.uniform1f(P.loc.uA, o.a);
      });
    }
    // luces en el piso: [{ M, sx, sz, spots: [{ x, y, r, g, b, i }] (≤ 8, x/y locales), spread, sig, gain }]
    glows(list) {
      const gl = this.gl, P = this.glowProg;
      const col = new Float32Array(32), pos = new Float32Array(16);
      this.quadPass(P, list, (o) => {
        col.fill(0); pos.fill(0);
        o.spots.slice(0, 8).forEach((p, i) => { col.set([p.r, p.g, p.b, p.i], i * 4); pos.set([p.x, p.y], i * 2); });
        gl.uniform4fv(P.loc.uS, col);
        gl.uniform2fv(P.loc.uSP, pos);
        gl.uniform2fv(P.loc.uSpread, o.spread || [1, 1]);
        gl.uniform1f(P.loc.uSig, o.sig || 0.7);
        gl.uniform1f(P.loc.uGain, o.gain == null ? 0.75 : o.gain);
        gl.uniformMatrix4fv(P.loc.uM, false, o.M);
        gl.uniform2f(P.loc.uSize, o.sx, o.sz);
      });
    }
    // mallas: [{ h, M, black, dim }]; expo = cuánta luz hay
    meshes(list, expo) {
      const gl = this.gl, P = this.prog, L = P.loc;
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(L.uVP, false, this.vp);
      gl.uniform3fv(L.uEye, this.eye);
      gl.uniform1f(L.uExpo, expo == null ? 1 : expo);
      const at = ['aPos', 'aNor', 'aAO', 'aCol', 'aES'];
      for (const k of at) gl.enableVertexAttribArray(L[k]);
      for (const o of list) {
        gl.uniformMatrix4fv(L.uM, false, o.M);
        gl.uniform1f(L.uBlack, o.black ? 1 : 0);
        gl.uniform1f(L.uDim, o.dim == null ? 1 : o.dim);
        gl.bindBuffer(gl.ARRAY_BUFFER, o.h.stat);
        gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(L.aNor, 3, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(L.aAO, 1, gl.FLOAT, false, 28, 24);
        gl.bindBuffer(gl.ARRAY_BUFFER, o.h.dyn);
        gl.vertexAttribPointer(L.aCol, 3, gl.FLOAT, false, 20, 0);
        gl.vertexAttribPointer(L.aES, 2, gl.FLOAT, false, 20, 12);
        gl.drawArrays(gl.TRIANGLES, 0, o.h.verts);
      }
      for (const k of at) gl.disableVertexAttribArray(L[k]);
    }
  }

  // arrastre horizontal para girar (editor de personaje y escena del meet)
  function dragRotate(el, onMove) {
    let d = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      d = { x: e.clientX, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
      el.classList.add('arrastrando');
    });
    el.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      onMove(e.clientX - d.x);
      d.x = e.clientX;
    });
    const end = (e) => { if (d && e.pointerId === d.id) { d = null; el.classList.remove('arrastrando'); } };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  window.HmoGL = { Renderer, persp, lookAt, mul, model, tiltX, dragRotate };
})();
