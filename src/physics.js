// Física de manejo: modelo de bicicleta (un eje delantero y uno trasero) con llantas que se saturan,
// círculo de fricción, transferencia de peso y freno de mano. Unidades SI; x a la derecha, y hacia abajo.
// heading h: el frente del carro apunta a (cos h, sin h); h crece en sentido horario en pantalla.
(function () {
  'use strict';

  const G = 9.81;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // fuerza de un eje: longitudinal pedida (Fx) y lateral según el ángulo de deslizamiento
  function axle(N, mu, Fx, vLong, vLat, B, minLat = 0.35) {
    const max = mu * N;
    let spin = 0;
    if (Math.abs(Fx) > max) { spin = Math.abs(Fx) / max - 1; Fx = Math.sign(Fx) * max; }
    // lo que queda del círculo de fricción para el lateral (una llanta patinando conserva un poco)
    const latMax = Math.max(Math.sqrt(Math.max(0, max * max - Fx * Fx)), minLat * max);
    const alpha = Math.atan2(vLat, Math.max(Math.abs(vLong), 1.5));
    const Fy = -latMax * Math.sin(1.25 * Math.atan(B * alpha)); // curva tipo Pacejka simplificada, cae poco después del pico
    return { Fx, Fy, alpha, spin };
  }

  class Car {
    constructor(spec, x, y, h) {
      this.x = x; this.y = y; this.h = h;
      this.vx = 0; this.vy = 0; this.w = 0;
      this.steer = 0; this.ax = 0; this.thr = 0; this.assist = 0;
      this.setSpec(spec);
      this.tel = { u: 0, v: 0, speed: 0, beta: 0, slipF: 0, slipR: 0, spinR: 0, spinF: 0, handbrake: false, surfF: null, surfR: null };
    }

    setSpec(s) {
      this.s = s;
      const wb = s.wheelbase;
      this.b = s.frontWeight * wb;     // centro de gravedad -> eje trasero
      this.a = wb - this.b;            // centro de gravedad -> eje delantero
      this.m = s.mass;
      this.I = s.mass * (s.length * s.length + s.width * s.width) / 12;
      this.P = s.powerKW * 1000;
      const vmax = s.topKmh / 3.6;
      this.cd = this.P / (vmax * vmax * vmax); // arrastre que limita la velocidad máxima
      this.Fmax = s.mass * 4.2;                // tope de empuje a baja velocidad
    }

    // input: { throttle 0..1, brake 0..1, steer -1..1, handbrake bool }
    // world: { surface(x, y) -> {grip, drag} }
    step(dt, inp, world) {
      const s = this.s, c = Math.cos(this.h), sn = Math.sin(this.h);
      const u = this.vx * c + this.vy * sn;      // velocidad hacia el frente
      const v = -this.vx * sn + this.vy * c;     // velocidad lateral (hacia la derecha del carro)
      const speed = Math.hypot(this.vx, this.vy);
      const beta = speed > 3 ? Math.atan2(v, Math.abs(u)) : 0;

      // dirección sensible a la velocidad: a fondo pide justo un poco más del agarre disponible
      // (con teclado el volante es todo o nada). De lado se libera todo el giro para contravolantear.
      const au = Math.abs(u);
      const limGrip = au < 3 ? s.steerMax : Math.min(s.steerMax, Math.max(0.05, 1.3 * s.wheelbase * s.grip * G / (au * au)));
      let lim = limGrip + (s.steerMax - limGrip) * clamp((Math.abs(beta) - 0.08) / 0.15, 0, 1);
      if (inp.handbrake) lim = Math.max(lim, s.steerMax * 0.6); // con freno de mano quieres meter el carro de lado
      const target = clamp(inp.steer, -1, 1) * lim;
      // girar es más lento que regresar al centro, como una mano real
      const away = Math.abs(target) > Math.abs(this.steer) && Math.sign(target) === Math.sign(this.steer || target);
      const rate = (away ? (s.steerSpeed || 3.2) : 7) * dt;
      this.steer += clamp(target - this.steer, -rate, rate);

      // superficie bajo cada eje
      const sf = world.surface(this.x + c * this.a, this.y + sn * this.a);
      const sr = world.surface(this.x - c * this.b, this.y - sn * this.b);

      // cargas con transferencia de peso (acelerar carga atrás, frenar carga adelante)
      const wb = s.wheelbase, mg = this.m * G;
      const dN = this.m * this.ax * s.cgHeight / wb;
      const Nf = Math.max(0.15 * mg, mg * this.b / wb - dN);
      const Nr = Math.max(0.15 * mg, mg * this.a / wb + dN);
      const muF = s.grip * sf.grip;
      const muR = s.grip * (s.rearGrip || 1.05) * sr.grip * (inp.handbrake ? s.handbrakeGrip : 1);

      // motor, freno y reversa
      let drive = 0, brakeF = 0;
      // el pie entra progresivo (0 a fondo en ~0.25 s) y sale rápido
      const thrIn = clamp(inp.throttle, 0, 1) * (inp.powerScale == null ? 1 : inp.powerScale);
      this.thr += clamp(thrIn - this.thr, -dt * 10, dt * 4);
      const thr = this.thr, brk = clamp(inp.brake, 0, 1);
      if (thr > 0.001) {
        if (u < -0.8) brakeF = thr * s.brake * this.m;                 // acelerar yendo en reversa = frenar
        else drive = thr * Math.min(this.Fmax, this.P / Math.max(Math.abs(u), 3));
      }
      if (brk > 0) {
        if (u > 0.8) brakeF = Math.max(brakeF, brk * s.brake * this.m);
        else if (u > -9) drive -= brk * this.Fmax * 0.45;             // reversa
      }
      let Fxf = 0, Fxr = 0;
      if (s.drive === 'FWD') Fxf = drive;
      else if (s.drive === 'AWD') { Fxf = drive * 0.3; Fxr = drive * 0.7; } // integral cargada atrás, como las deportivas
      else Fxr = drive;
      const dirU = Math.sign(u) || 0;
      // ABS: reparto 70/30 y cada eje frena hasta el 90% de su agarre, así no se bloquea
      Fxf -= dirU * Math.min(brakeF * 0.7, 0.9 * muF * Nf);
      Fxr -= dirU * Math.min(brakeF * 0.3, 0.6 * muR * Nr);
      if (inp.handbrake && Math.abs(u) > 0.3) Fxr = -dirU * muR * Nr * 0.9; // rueda trasera bloqueada

      // eje delantero en el marco de la llanta girada
      const cs = Math.cos(this.steer), ss = Math.sin(this.steer);
      const vfL = u, vfT = v + this.w * this.a;
      const wl = vfL * cs + vfT * ss, wt = -vfL * ss + vfT * cs;
      const F = axle(Nf, muF, Fxf, wl, wt, s.tireB);
      const Ffx = F.Fx * cs - F.Fy * ss, Ffy = F.Fx * ss + F.Fy * cs;
      // eje trasero
      const vrT = v - this.w * this.b;
      // llanta trasera bloqueada por el freno de mano: casi sin agarre lateral
      const R = axle(Nr, muR, Fxr, u, vrT, s.tireB, inp.handbrake ? 0.12 : (s.slideGrip || 0.35));

      // resistencias: aire, rodamiento y superficie (pasto, tierra, agua frenan)
      const surfDrag = (sf.drag + sr.drag) * 0.5;
      const resX = -this.cd * u * Math.abs(u) - this.m * 0.012 * G * clamp(u, -1, 1) - surfDrag * this.m * u * 0.3;
      const resY = -surfDrag * this.m * v * 0.3;

      const FX = Ffx + R.Fx + resX;
      const FY = Ffy + R.Fy + resY;
      let torque = this.a * Ffy - this.b * R.Fy - this.w * this.I * 0.6;
      // asistencia contra trompos: deja derrapar hasta ~50°, y al frenar sin freno de mano mantiene recto el carro.
      // Solo actúa si el carro sigue girando hacia el lado que lo cruza más.
      this.assist = 0;
      if (speed > 4 && !inp.handbrake) {
        const limit = brk > 0 && thr < 0.05 ? 0.3 : (s.maxDrift || 0.9);
        const over = Math.abs(beta) - limit;
        // beta crece cuando el giro (w) tiene el signo contrario a beta
        if (over > 0 && this.w * beta < 0) {
          this.assist = Math.min(1, over / 0.35);
          torque += Math.sign(beta) * this.I * (6 + 18 * this.assist) * Math.min(Math.abs(this.w), 2.5);
        }
      }

      // integra en el mundo
      const fwx = FX * c - FY * sn, fwy = FX * sn + FY * c;
      this.vx += fwx / this.m * dt;
      this.vy += fwy / this.m * dt;
      this.w += torque / this.I * dt;
      this.ax += (FX / this.m - this.ax) * Math.min(1, dt * 8);

      // parado y sin pedales: que no se arrastre
      if (thr === 0 && brk === 0 && speed < 0.4) { this.vx *= 0.9; this.vy *= 0.9; this.w *= 0.9; }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.h += this.w * dt;

      const t = this.tel;
      t.u = u; t.v = v; t.speed = speed; t.beta = beta;
      t.slipF = Math.abs(wt); t.slipR = Math.abs(vrT);
      t.spinR = R.spin; t.spinF = F.spin;
      t.handbrake = !!inp.handbrake;
      t.surfF = sf; t.surfR = sr;
      return this.collide(world);
    }

    // choques contra tiles sólidos: se revisan puntos del contorno, se saca el carro y se aplica un impulso
    collide(world) {
      const s = this.s, hl = s.length / 2, hw = s.width / 2, T = world.tileM;
      const pts = [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw],
        [hl / 2, hw], [hl / 2, -hw], [-hl / 2, hw], [-hl / 2, -hw]];
      let impact = 0;
      for (let it = 0; it < 3; it++) {
        let any = false;
        const c = Math.cos(this.h), sn = Math.sin(this.h);
        for (const [lx, ly] of pts) {
          const rx = lx * c - ly * sn, ry = lx * sn + ly * c;
          const px = this.x + rx, py = this.y + ry;
          const tx = Math.floor(px / T), ty = Math.floor(py / T);
          if (!world.solidAt(tx, ty)) continue;
          any = true;
          const faces = [
            [px - tx * T, -1, 0, tx - 1, ty], [(tx + 1) * T - px, 1, 0, tx + 1, ty],
            [py - ty * T, 0, -1, tx, ty - 1], [(ty + 1) * T - py, 0, 1, tx, ty + 1],
          ];
          let best = null;
          for (const f of faces) if (!world.solidAt(f[3], f[4]) && (!best || f[0] < best[0])) best = f;
          if (!best) for (const f of faces) if (!best || f[0] < best[0]) best = f;
          const [d, nx, ny] = best;
          this.x += nx * (d + 0.002);
          this.y += ny * (d + 0.002);
          // impulso en el punto de contacto
          const vpx = this.vx - this.w * ry, vpy = this.vy + this.w * rx;
          const vn = vpx * nx + vpy * ny;
          if (vn < 0) {
            const rn = rx * ny - ry * nx;
            const j = -(1 + 0.25) * vn / (1 / this.m + rn * rn / this.I);
            this.vx += j * nx / this.m; this.vy += j * ny / this.m; this.w += rn * j / this.I;
            const tx_ = -ny, ty_ = nx;
            const vt = (this.vx - this.w * ry) * tx_ + (this.vy + this.w * rx) * ty_;
            const rt = rx * ty_ - ry * tx_;
            let jt = -vt / (1 / this.m + rt * rt / this.I);
            jt = clamp(jt, -0.35 * j, 0.35 * j);
            this.vx += jt * tx_ / this.m; this.vy += jt * ty_ / this.m; this.w += rt * jt / this.I;
            impact = Math.max(impact, -vn);
          }
        }
        if (!any) break;
      }
      return impact;
    }

    // posiciones de las 4 llantas en el mundo (para marcas y humo)
    wheels() {
      const c = Math.cos(this.h), sn = Math.sin(this.h), hw = this.s.width / 2 - 0.18;
      const at = (lx, ly) => [this.x + lx * c - ly * sn, this.y + lx * sn + ly * c];
      return { fl: at(this.a, -hw), fr: at(this.a, hw), rl: at(-this.b, -hw), rr: at(-this.b, hw) };
    }
  }

  window.HmoPhysics = { Car };
})();
