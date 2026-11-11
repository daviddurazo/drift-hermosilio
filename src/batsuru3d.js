// Ba-tsuru en 3D hecho a mano, cubito por cubito (5 cm), con más detalle que la silueta genérica de model3d.js:
// juntas de puertas, cofre y cajuela, moldura, manijas, espejos, antena, tapón de gasolina, faros con divisor,
// cuartos que dan vuelta a la esquina, calaveras con reversa, placas y rines tipo tapón.
// HmoModel3D.build lo usa para el carro 'pitic' (si este archivo está cargado antes que model3d.js).
(function () {
  'use strict';

  const VOX = 0.05;
  // Rejilla de trabajo: x = largo (frente en x = 0, atrás en x = 86), y = alto, z = ancho (0..33; z = 0 es el lado derecho).
  const LEN = 87, WID = 34;
  const AXF = 17, AXR = 66, WY = 6, WR = 6.3, ARCH = 7.6; // ejes y llantas (distancia entre ejes 2.45 m)
  const GH0 = 26, GH1 = 70; // tramo de la cabina
  const X0 = -1, X1 = 88, Y0 = 0, Y1 = 30, Z0 = -2, Z1 = 36;
  const SX = X1 - X0, SY = Y1 - Y0, SZ = Z1 - Z0;

  // materiales: nombres de HmoModel3D (más tread, reverse, reflector y plateText)
  const NAMES = [null, 'paint', 'roof', 'pillar', 'blackout', 'glass', 'mirror', 'seam', 'garnish', 'handle', 'bumper',
    'under', 'tire', 'tread', 'rim', 'rimDark', 'hub', 'chrome', 'head', 'signal', 'tail', 'reverse', 'reflector',
    'plate', 'plateText', 'grille', 'grilleBar'];
  const K = {};
  NAMES.forEach((n, i) => { if (n) K[n] = i; });

  // silueta lateral: altura de la carrocería en cada x
  function topY(x) {
    if (x === 0) return 9;
    if (x === 1) return 14;
    if (x <= 25) return 15 + Math.round(((x - 2) * 2) / 23); // cofre
    if (x <= 40) return 18 + Math.round(((x - 25) * 9) / 15); // parabrisas
    if (x <= 59) return 27; // techo
    if (x <= 70) return 27 - Math.round(((x - 59) * 8) / 11); // medallón
    if (x <= 84) return 18; // cajuela
    if (x === 85) return 17;
    return 10; // defensa trasera
  }
  const botY = (x) => (x === 0 || x === 86 ? 4 : 3);
  const planInset = (x) => (x === 0 ? 3 : x === 1 ? 2 : x === 2 ? 1 : x === 86 ? 3 : x === 85 ? 1 : 0);
  function bodyInset(x, y, t) {
    let s = 0;
    if (y <= 3) s = 1;
    if (y >= 18) s = 1;
    if (y === t && (x < GH0 || x > GH1)) s = Math.max(s, y >= 18 ? 2 : 1);
    return Math.max(s, planInset(x));
  }
  const ghInset = (y) => (y <= 20 ? 2 : y <= 23 ? 3 : 4);
  const mz = (z) => WID - 1 - z;

  function ghMat(x, y, z, ins, t) {
    const side = z === ins || z === mz(ins);
    if (y >= 27 && x >= 41 && x <= 59) return K.roof;
    if (side) {
      if (y === t) return K.pillar; // poste A y riel del techo
      if (x <= 27 || x >= 61) return K.pillar; // base del poste A, poste C ancho
      if (x === 45 || x === 46) return K.blackout; // poste B negro
      if (x === 28 || x === 29) return K.blackout; // esquinero del espejo
      if (y === 19) return K.blackout; // hule de abajo
      if (y === 26 && x >= 41) return K.blackout; // hule de arriba
      return K.glass;
    }
    if (x === 26 && y === 19 && ((z >= 7 && z <= 15) || (z >= 18 && z <= 26))) return K.blackout; // limpiadores
    return K.glass;
  }

  function grid() {
    const cell = new Uint8Array(SX * SY * SZ), zone = new Uint8Array(SX * SY * SZ);
    const inb = (x, y, z) => x >= X0 && x < X1 && y >= Y0 && y < Y1 && z >= Z0 && z < Z1;
    const id = (x, y, z) => ((x - X0) * SY + (y - Y0)) * SZ + (z - Z0);
    const set = (x, y, z, m, zn) => { if (inb(x, y, z)) { cell[id(x, y, z)] = m; zone[id(x, y, z)] = zn ? 1 : 0; } };
    const recolor = (x, y, z, m) => { if (inb(x, y, z) && cell[id(x, y, z)]) cell[id(x, y, z)] = m; };
    const get = (x, y, z) => (inb(x, y, z) ? cell[id(x, y, z)] : 0);
    const sym = (x, y, z, m) => { set(x, y, z, m); set(x, y, mz(z), m); };

    // carrocería y cabina
    for (let x = 0; x < LEN; x++) {
      const t = topY(x), gh = x >= GH0 && x <= GH1;
      for (let y = botY(x); y <= t; y++) {
        if (gh && y >= 19) {
          const ins = ghInset(y);
          for (let z = ins; z <= mz(ins); z++) set(x, y, z, ghMat(x, y, z, ins, t), 1);
        } else {
          const ins = bodyInset(x, y, t);
          const bumper = (x <= 3 || x >= 83) && y >= 4 && y <= 9;
          for (let z = ins; z <= mz(ins); z++) set(x, y, z, bumper ? K.bumper : K.paint);
        }
      }
    }
    // salpicaderas con fondo oscuro
    for (const ax of [AXF, AXR]) {
      for (let x = ax - 10; x <= ax + 10; x++) for (let y = 0; y <= 17; y++) {
        const d = Math.hypot(x - ax, y - WY);
        if (d > ARCH + 1.2) continue;
        const ins = bodyInset(x, y, topY(x));
        for (let z = 0; z < WID; z++) {
          if (!get(x, y, z)) continue;
          const outer = z <= 7 || z >= WID - 8;
          if (d <= ARCH) { if (outer) set(x, y, z, 0); else recolor(x, y, z, K.under); }
          else if (outer && z !== ins && z !== mz(ins)) recolor(x, y, z, K.under);
        }
      }
    }
    const outerZ = (x, y) => bodyInset(x, y, topY(x));
    const paintSide = (x, y, m, only) => {
      const oz = outerZ(x, y);
      for (const z of [oz, mz(oz)]) { const v = get(x, y, z); if (v && (!only || only.includes(v))) set(x, y, z, m); }
    };
    // juntas de puertas, cofre y cajuela
    for (const sx of [26, 45, 61]) for (let y = 4; y <= 18; y++) paintSide(sx, y, K.seam, [K.paint]);
    for (let x = 26; x <= 61; x++) paintSide(x, 4, K.seam, [K.paint]);
    for (let x = 3; x <= 24; x++) { const y = topY(x); recolor(x, y, 2, K.seam); recolor(x, y, mz(2), K.seam); }
    for (let x = 72; x <= 84; x++) { recolor(x, 18, 3, K.seam); recolor(x, 18, mz(3), K.seam); }
    for (let z = 3; z <= mz(3); z++) recolor(71, 18, z, K.seam);
    // moldura lateral, manijas, tapón de gasolina (lado derecho) y antena (salpicadera izquierda)
    for (let x = 2; x <= 85; x++) paintSide(x, 10, K.garnish, [K.paint, K.seam, K.bumper]);
    for (const x of [41, 42, 57, 58]) paintSide(x, 15, K.handle);
    for (let x = 74; x <= 76; x++) for (let y = 14; y <= 16; y++) if (!(x === 75 && y === 15)) recolor(x, y, 0, K.seam);
    for (let y = topY(22) + 1; y <= topY(22) + 7; y++) set(22, y, mz(1), K.blackout);
    // espejos
    for (let x = 28; x <= 30; x++) for (let y = 19; y <= 21; y++) for (let z = -2; z <= 0; z++) sym(x, y, z, x === 30 && z <= -1 ? K.glass : K.mirror);
    sym(28, 19, 1, K.blackout); sym(29, 19, 1, K.blackout);

    // frente: faros con divisor, cuartos en la esquina, parrilla con emblema, defensa con toma y placa
    for (let z = 2; z <= mz(2); z++) set(1, 10, z, K.garnish);
    for (let y = 11; y <= 13; y++) for (let z = 2; z <= mz(2); z++) {
      const zz = Math.min(z, mz(z));
      let m;
      if (zz === 2) m = K.signal;
      else if (zz <= 10) m = zz === 7 ? K.chrome : K.head;
      else if (zz === 11) m = K.chrome;
      else m = y === 12 ? K.grilleBar : K.grille;
      set(1, y, z, m);
    }
    for (let z = 15; z <= 18; z++) set(1, 12, z, K.chrome);
    for (const y of [11, 13]) { set(1, y, 16, K.chrome); set(1, y, 17, K.chrome); }
    for (let y = 11; y <= 13; y++) sym(2, y, 1, K.signal);
    for (let y = 11; y <= 12; y++) sym(3, y, 0, K.signal);
    for (let z = 3; z <= mz(3); z++) {
      set(0, 4, z, K.garnish);
      if (z >= 8 && z <= mz(8)) for (const y of [5, 6]) set(0, y, z, z % 2 ? K.grilleBar : K.grille);
    }
    for (let y = 6; y <= 8; y++) for (let z = 13; z <= 20; z++) set(-1, y, z, K.plate);
    for (const z of [14, 15, 16, 18, 19]) set(-1, 7, z, K.plateText);

    // atrás: calaveras con direccional y reversa, franja reflejante, emblema, placa, defensa y escape
    for (let y = 13; y <= 16; y++) for (let z = 1; z <= mz(1); z++) {
      const zz = Math.min(z, mz(z));
      if (zz <= 2) set(85, y, z, K.signal);
      else if (zz <= 8) set(85, y, z, K.tail);
      else if (zz <= 10) set(85, y, z, K.reverse);
      else if (y === 16) set(85, y, z, K.reflector);
    }
    for (let y = 13; y <= 16; y++) sym(84, y, 0, K.tail);
    for (let z = 14; z <= 19; z++) set(85, 15, z, K.chrome);
    for (let y = 12; y <= 14; y++) for (let z = 13; z <= 20; z++) set(86, y, z, K.plate);
    for (const z of [14, 15, 17, 18, 19]) set(86, 13, z, K.plateText);
    for (let z = 3; z <= mz(3); z++) { set(86, 10, z, K.garnish); set(86, 4, z, K.garnish); }
    for (const z of [4, 5]) sym(86, 7, z, K.reflector);
    for (const x of [86, 87]) for (const z of [6, 7]) set(x, 3, z, K.grilleBar);

    // llantas con rin tipo tapón (el color del rin lo pone el tuneo)
    for (const ax of [AXF, AXR]) {
      for (const [zIn, zOut] of [[5, 1], [mz(5), mz(1)]]) {
        const step = zOut < zIn ? 1 : -1;
        for (let dx = -7; dx <= 7; dx++) for (let dy = -7; dy <= 7; dy++) {
          const r = Math.hypot(dx, dy);
          if (r > WR) continue;
          const x = ax + dx, y = WY + dy;
          if (y < 0) continue;
          const ang = Math.atan2(dy, dx);
          for (let z = zOut; z !== zIn + step; z += step) {
            let m;
            if (z === zOut) {
              if (r > 4.3) m = K.tire;
              else if (r < 0.5) m = K.rimDark;
              else if (r <= 1.5) m = K.hub;
              else if (r <= 3.7) {
                const sec = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 8 + 0.5) % 8;
                m = sec % 2 === 1 && r >= 2.2 ? K.rimDark : K.rim;
              } else m = K.rim;
            } else m = r > 5.3 && (Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 24) + z) % 2 ? K.tread : K.tire;
            set(x, y, z, m);
          }
        }
      }
    }

    // a la rejilla de HmoModel3D: ix crece hacia el frente, +z es el lado derecho, el cubito (ix, iy, iz) va de ix·VOX a (ix+1)·VOX
    const nx = SX, ny = SY, nz = SZ;
    const out = new Uint8Array(nx * ny * nz), outZone = new Uint8Array(nx * ny * nz), dTop = new Float32Array(nx * ny * nz);
    const IX = (x) => X1 - 1 - x, IZ = (z) => Z1 - 1 - z;
    for (let x = X0; x < X1; x++) for (let y = Y0; y < Y1; y++) for (let z = Z0; z < Z1; z++) {
      const v = cell[id(x, y, z)];
      if (!v) continue;
      const o = (IX(x) * ny + (y - Y0)) * nz + IZ(z);
      out[o] = v; outZone[o] = zone[id(x, y, z)];
      dTop[o] = outZone[o] ? -1 : x >= 0 && x < LEN ? Math.max(0, topY(x) - y) * VOX : 0;
    }
    // la carrocería (x de 0 a 86) queda centrada en el origen; z del 0 al 33 también
    const bodyIx0 = IX(LEN - 1), bodyIz0 = IZ(WID - 1);
    return {
      nx, ny, nz, vox: VOX, cell: out, zone: outZone, dTop, names: NAMES,
      origin: [-(bodyIx0 + LEN / 2) * VOX, 0, -(bodyIz0 + WID / 2) * VOX],
      // u: metros desde la defensa trasera; y: altura; z: desde el centro (+z = derecha)
      u: (ix) => (ix - bodyIx0 + 0.5) * VOX,
      y: (iy) => (iy + 0.5) * VOX,
      z: (iz) => (iz - bodyIz0 + 0.5 - WID / 2) * VOX,
      length: LEN * VOX, width: WID * VOX, height: 28 * VOX,
      hoodU: (LEN - GH0) * VOX, // donde el cofre se junta con el parabrisas
    };
  }

  window.HmoBatsuru3D = { ids: ['pitic'], grid, VOX };
})();
