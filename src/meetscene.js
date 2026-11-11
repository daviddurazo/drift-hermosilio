// Escena del meet: estacionamiento de noche en 3D de cubitos. Tu carro, tú recargado en él, carros y gente
// de otros (sin interacción) y carros que pasan por la calle. Solo es una escena: el XP lo sigue llevando el juego.
// Medidas en metros; la cámara está del lado +z mirando hacia -z (la calle y los edificios quedan al fondo).
(function () {
  'use strict';

  const { model, mul, tiltX } = HmoGL;
  const FACE_Z = -Math.PI / 2;   // yaw para que un carro (frente en +x) mire hacia +z
  const STALL = 2.8;             // ancho de cada cajón
  const ROW_Z = -2.6;            // centro de la fila de cajones de atrás
  const FRONT_Z = 6.2;           // centro de la fila de enfrente (los carros ven hacia -z)
  const LANES = [{ z: -9.2, dir: 1 }, { z: -12.0, dir: -1 }];
  const TARGET = [0.9, 0.95, -2.2];
  const LIGHT = { r: 1, g: 0.72, b: 0.42 };

  // ---------- escenario fijo (se arma una vez) ----------
  function groundBoxes() {
    const V = 0.2, q = (m) => Math.round(m / V);
    const out = [];
    const B = (x0, x1, z0, z1, y0, y1, c, em) => out.push({ x: [q(x0), q(x1) - 1], y: [y0, y1], z: [q(z0), q(z1) - 1], c, em });
    const r = HmoTuning.rng(77);
    B(-26, 26, -5.4, 10, -1, -1, '#2a2d38');                         // estacionamiento
    for (let i = 0; i < 200; i++) {                                    // parches del asfalto
      const x = -26 + r() * 50, z = -5.2 + r() * 14.6;
      B(x, x + 0.4 + r() * 0.8, z, z + 0.4 + r() * 0.6, -1, -1, r() < 0.5 ? '#262833' : '#30333f');
    }
    for (let k = -9; k <= 8; k++) {                                    // rayas de los cajones
      const x = k * STALL + STALL / 2;
      B(x - 0.1, x + 0.1, -5.2, 0, -1, -1, '#c9c4b6');
      B(x - 0.1, x + 0.1, 3.4, 8.8, -1, -1, '#c9c4b6');
    }
    B(-26, 26, -7.2, -5.4, -1, 0, '#6d6a66');                         // banqueta
    B(-26, 26, -5.6, -5.4, 0, 0, '#8f8b84');                           // orilla de la banqueta
    B(-26, 26, -13.8, -7.2, -1, -1, '#1f2129');                        // calle
    for (let x = -26; x < 26; x += 3) B(x, x + 1.6, -10.7, -10.5, -1, -1, '#d9a92e', 0.2); // raya central
    B(-26, 26, -15.6, -13.8, -1, 0, '#6d6a66');                        // banqueta de enfrente
    return { boxes: out, vox: V };
  }

  function buildingBoxes() {
    const V = 0.5, out = [];
    const B = (x0, x1, y0, y1, z0, z1, c, em, sp) => out.push({ x: [x0, x1], y: [y0, y1], z: [z0, z1], c, em, sp });
    const r = HmoTuning.rng(4321);
    const pal = ['#e6336f', '#18a999', '#f2a900', '#2d5bd2', '#f0652a', '#3fae4f', '#c0392b', '#8e44ad', '#ffcf33', '#e8ecf2'];
    let x = -72;
    while (x < 72) {
      const w = 10 + Math.floor(r() * 10), h = 8 + Math.floor(r() * 18), c = pal[Math.floor(r() * pal.length)];
      const z0 = -44, z1 = -33; // de -22 a -16.5 m (en cubitos de medio metro)
      B(x, x + w - 1, 0, h, z0, z1, c);
      B(x, x + w - 1, h + 1, h + 1, z1 - 1, z1, '#3a3d48');           // pretil
      for (let yy = 2; yy < h - 1; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) {
        const lit = r();
        const col = lit < 0.35 ? '#ffd98a' : lit < 0.5 ? '#9fd3ff' : '#1a1d26';
        B(xx, xx, yy, yy + 1, z1, z1, col, lit < 0.5 ? 0.9 : 0, 0.6);
      }
      if (r() < 0.35) B(x + 1, x + w - 2, 1, 1, z1 + 1, z1 + 1, ['#ff2e88', '#00d1c1', '#ffcf33'][Math.floor(r() * 3)], 1); // anuncio
      x += w + (r() < 0.3 ? 2 : 0);
    }
    return { boxes: out, vox: V };
  }

  function lampBoxes() {
    const out = [];
    const B = (x0, x1, y0, y1, z0, z1, c, em) => out.push({ x: [x0, x1], y: [y0, y1], z: [z0, z1], c, em });
    B(-1, 0, 0, 1, -1, 0, '#3a3d46');          // base
    B(0, 0, 0, 55, 0, 0, '#4a4e58');           // poste (10 cm)
    B(0, 0, 55, 55, 0, 14, '#4a4e58');         // brazo hacia el estacionamiento
    B(-1, 1, 53, 54, 12, 16, '#2d3038');       // cabeza
    B(-1, 1, 52, 52, 12, 16, '#fff1cf', 1);    // foco
    return { boxes: out, vox: 0.1 };
  }

  function palmBoxes() {
    const out = [];
    const B = (x0, x1, y0, y1, z0, z1, c) => out.push({ x: [x0, x1], y: [y0, y1], z: [z0, z1], c });
    for (let y = 0; y < 52; y++) { const s = Math.round(Math.sin(y / 14) * 2); B(s, s + 1, y, y, 0, 1, y % 4 === 0 ? '#5b4630' : '#6e5539'); }
    const top = 52, sx = Math.round(Math.sin(top / 14) * 2);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      for (let k = 1; k <= 9; k++) {
        const drop = Math.floor((k * k) / 14);
        B(sx + dx * k, sx + dx * k + 1, top - drop, top - drop, dz * k, dz * k + 1, k % 2 ? '#2f9e4f' : '#1f7a3c');
      }
    }
    B(sx - 1, sx + 2, top - 1, top + 1, -1, 2, '#2a8a43');
    return { boxes: out, vox: 0.12 };
  }

  const LAMPS = [[-6, -6.4], [8, -6.4], [-20, -6.4], [22, -6.4]];
  const PALMS = [[1.5, -6.6], [-13, -6.6], [15, -6.4]];

  class Scene {
    constructor(api) {
      this.api = api;
      this.root = document.getElementById('meet-escena');
      this.cv = document.createElement('canvas');
      this.cv.className = 'escena-cv';
      document.getElementById('me-3d').replaceChildren(this.cv);
      this.r = new HmoGL.Renderer(this.cv);
      this.running = false;
      this.loop = (t) => this.frame(t);
      this.yawCam = 0; this.yawTarget = 0;
      HmoGL.dragRotate(this.cv, (dx) => { this.yawTarget = Math.max(-1.1, Math.min(0.45, this.yawTarget - dx * 0.006)); });
      document.getElementById('me-volver').onclick = (e) => { e.currentTarget.blur(); this.api.back(); };
      document.getElementById('me-dejar').onclick = (e) => { e.currentTarget.blur(); this.api.leaveCar(); };
    }
    get isOpen() { return !this.root.hidden; }

    // cfg: { seed, street, player: { look, spec, paint, rim, neon } }
    open(cfg) {
      this.root.hidden = false;
      this.cfg = cfg;
      document.getElementById('me-calle').textContent = cfg.street || 'Meet';
      if (!this.r.ok) { document.getElementById('me-sin3d').hidden = false; return; }
      this.buildStatic();
      this.populate(cfg);
      this.yawCam = this.yawTarget = 0;
      this.running = true;
      this.last = 0;
      requestAnimationFrame(this.loop);
    }
    close() {
      this.root.hidden = true;
      this.running = false;
      if (this.people) for (const p of this.people) this.r.free(p.h);
      this.people = null;
    }

    buildStatic() {
      if (this.ground) return;
      const mk = (b) => this.r.upload(HmoModel3D.fromBoxes(b.boxes, b.vox, true, true));
      this.ground = mk(groundBoxes());
      this.buildings = mk(buildingBoxes());
      this.lamp = mk(lampBoxes());
      this.palm = mk(palmBoxes());
    }

    // carros y gente de otros: cambian con cada meet (misma semilla = misma escena)
    populate(cfg) {
      const r = HmoTuning.rng(1000 + cfg.seed * 7919);
      const T = HmoTuning, CARS = HmoCars.CARS;
      const randCar = (slot) => {
        const spec = CARS[Math.floor(r() * CARS.length)];
        const paint = { color: T.PAINT_COLORS[Math.floor(r() * T.PAINT_COLORS.length)], finish: ['solido', 'metalico', 'perlado'][Math.floor(r() * 3)], wrap: r() < 0.7 ? 'ninguno' : ['franjas', 'dostonos', 'cuadros', 'camuflaje'][Math.floor(r() * 4)] };
        let neon = null;
        if (r() < 0.5) {
          const cs = T.NEON.colors.slice().sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * 3));
          neon = r() < 0.4 ? { mode: 'estatico', colors: cs.slice(0, 1) } : { mode: 'dinamico', colors: cs, pattern: Object.keys(T.NEON.patterns)[Math.floor(r() * 7)] };
        }
        return { spec, paint, rim: T.RIM_COLORS[Math.floor(r() * 4)], neon, slot, t0: r() * 10 };
      };
      // tu carro, en el cajón de en medio, de frente a la cámara
      const p = cfg.player;
      this.cars = [{ spec: p.spec, paint: p.paint, rim: p.rim, neon: p.neon, slot: 'tuyo', x: 0, z: ROW_Z, yaw: FACE_Z, t0: 0 }];
      // otros estacionados (se deja libre el cajón de tu derecha, donde estás parado)
      // (los cajones de la derecha quedan junto a la cámara: ahí solo uno, más lejos, para no tapar)
      const stalls = [[-1, ROW_Z, FACE_Z], [-2, ROW_Z, FACE_Z], [-3, ROW_Z, FACE_Z], [-4, ROW_Z, FACE_Z], [3, ROW_Z, FACE_Z], [-3, FRONT_Z, -FACE_Z], [-5, FRONT_Z, -FACE_Z], [-6, FRONT_Z, -FACE_Z]];
      stalls.forEach(([k, z, yaw], i) => {
        if (r() < 0.25) return; // algunos cajones vacíos
        const c = randCar('npc' + i);
        Object.assign(c, { x: k * STALL, z, yaw: yaw + (r() - 0.5) * 0.06 });
        this.cars.push(c);
      });
      // gente: tú recargado en tu carro y grupitos junto a los otros
      const C = HmoCharacter;
      this.people = [];
      const add = (look, pose, x, z, yaw, lean) => this.people.push({ h: this.r.upload(C.build(look, pose)), x, z, yaw, lean: lean || 0, t0: r() * 6 });
      add(p.look, 'cruzado', 1.25, ROW_Z + 0.5, 1.0, -0.16);
      const spots = [[-2.8 + 1.4, ROW_Z + 3.2], [-5.6 + 1.5, ROW_Z + 3.0], [-8.4 + 1.3, ROW_Z + 3.4], [-11.2 + 1.2, ROW_Z + 3.1], [-6.5, FRONT_Z - 3.2], [-13.5, FRONT_Z - 3.4], [9.5, ROW_Z + 2.6]];
      for (const [gx, gz] of spots) {
        if (r() < 0.3) continue;
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + r();
          const x = gx + Math.cos(a) * 0.55 * (n > 1 ? 1 : 0), z = gz + Math.sin(a) * 0.55 * (n > 1 ? 1 : 0);
          const yaw = n > 1 ? Math.atan2(gx - x, gz - z) : r() * Math.PI * 2; // en grupo se ven entre sí
          add(C.randomLook(r), ['parado', 'cruzado', 'telefono'][Math.floor(r() * 3)], x, z, yaw);
        }
      }
      // carros que pasan
      this.traffic = [];
      this.nextCar = [1.5, 4];
      this.trafficRand = r;
      this.randCar = randCar;
    }

    spawn(lane) {
      const L = LANES[lane];
      const used = new Set(this.traffic.map((c) => c.slot));
      let slot = 'pasa0';
      for (let i = 0; i < 6; i++) if (!used.has('pasa' + i)) { slot = 'pasa' + i; break; }
      const c = this.randCar(slot);
      Object.assign(c, { x: -L.dir * 48, z: L.z, yaw: L.dir > 0 ? 0 : Math.PI, v: L.dir * (9 + this.trafficRand() * 6) });
      this.traffic.push(c);
    }

    frame(t) {
      if (!this.running) return;
      requestAnimationFrame(this.loop);
      const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
      this.last = t;
      // tráfico
      for (let i = 0; i < 2; i++) {
        this.nextCar[i] -= dt;
        if (this.nextCar[i] <= 0) { this.spawn(i); this.nextCar[i] = 3 + this.trafficRand() * 6; }
      }
      for (const c of this.traffic) c.x += c.v * dt;
      this.traffic = this.traffic.filter((c) => Math.abs(c.x) < 50);
      this.yawCam += (this.yawTarget - this.yawCam) * (1 - Math.exp(-dt * 6));
      this.draw(t / 1000);
    }

    draw(t) {
      const r = this.r;
      const sway = Math.sin(t * 0.13) * 0.05;
      const a = 0.62 + this.yawCam + sway, R = 8.6;
      const eye = [TARGET[0] + Math.sin(a) * R, 2.1, TARGET[2] + Math.cos(a) * R];
      r.begin(eye, TARGET, aspect0(this.cv) < 1 ? 0.95 : 0.72, 140);
      // piso primero; luego sombras y luces encima del piso; luego todo lo demás
      r.meshes([{ h: this.ground, M: model(0, 0, 0, 0) }], 0.55);
      r.floorDepth = true;
      const cars = this.cars.concat(this.traffic);
      r.shadows(cars.map((c) => ({ M: model(c.x, 0, c.z, c.yaw), sx: c.spec.length / 2 + 0.35, sz: c.spec.width / 2 + 0.3, a: 0.6 }))
        .concat(this.people.map((p) => ({ M: model(p.x, 0, p.z, p.yaw), sx: 0.35, sz: 0.3, a: 0.45 }))));
      const glows = [];
      for (const [x, z] of LAMPS) glows.push({ M: model(x, 0, z + 1.5, 0), sx: 7, sz: 7, spots: [{ x: 0, y: 0, ...LIGHT, i: 0.85 }], sig: 9, gain: 0.32 });
      for (const c of cars) {
        if (c.neon) {
          const n = HmoTuning.neonOf({ neon: c.neon });
          glows.push({ M: model(c.x, 0, c.z, c.yaw), sx: c.spec.length / 2 + 1.6, sz: c.spec.width / 2 + 1.6, spots: HmoTuning.neonSpots(n, t + c.t0, c.spec.length, c.spec.width), spread: [1.06, 1.2], sig: 0.7, gain: 0.75 });
        }
        if (c.v) { // faros y calaveras de los que pasan
          const h = c.spec.length / 2;
          glows.push({ M: model(c.x, 0, c.z, c.yaw), sx: h + 7, sz: 3.5, spots: [{ x: h + 3.5, y: 0.6, r: 1, g: 0.95, b: 0.8, i: 0.7 }, { x: h + 3.5, y: -0.6, r: 1, g: 0.95, b: 0.8, i: 0.7 }, { x: -h - 0.4, y: 0.6, r: 1, g: 0.1, b: 0.08, i: 0.6 }, { x: -h - 0.4, y: -0.6, r: 1, g: 0.1, b: 0.08, i: 0.6 }], sig: 2.2, gain: 0.45 });
        }
      }
      r.glows(glows);
      r.floorDepth = false;
      const list = [{ h: this.buildings, M: model(0, 0, 0, 0) }];
      for (const [x, z] of LAMPS) list.push({ h: this.lamp, M: model(x, 0, z, 0) });
      for (const [x, z] of PALMS) list.push({ h: this.palm, M: model(x, 0.2, z, 0) });
      for (const c of cars) list.push({ h: r.car(c.spec, c.paint, c.rim, c.slot), M: model(c.x, 0, c.z, c.yaw) });
      for (const p of this.people) {
        const bob = Math.sin(t * 1.6 + p.t0) * 0.006; // respiran
        const M = mul(model(p.x, bob, p.z, p.yaw), tiltX(p.lean));
        list.push({ h: p.h, M });
      }
      r.meshes(list, 0.8);
    }

    // texto de arriba (lo actualiza el juego mientras la escena está abierta)
    hud(info) {
      const set = (id, v) => { const e = document.getElementById(id); if (e.textContent !== v) e.textContent = v; };
      set('me-xp', info.xp);
      set('me-nivel', info.level);
      document.getElementById('me-xpbar').style.width = (info.frac * 100).toFixed(1) + '%';
    }
  }
  const aspect0 = (cv) => (cv.clientWidth || 1) / (cv.clientHeight || 1);

  window.HmoMeetScene = { Scene };
})();
