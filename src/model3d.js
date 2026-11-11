// Modelos 3D de los carros hechos de vóxeles (cubitos), para las vitrinas del taller.
// Cada carro se describe con su silueta lateral real (tipo Tsuru, Sentra y Civic) y se "rellena"
// con cubitos de VOX metros. Las caras visibles se vuelven triángulos con oclusión ambiental por vértice.
(function () {
  'use strict';

  const VOX = 0.06; // tamaño del cubito en metros

  const MAT_NAMES = ['paint', 'roof', 'pillar', 'blackout', 'glass', 'head', 'tail', 'garnish', 'signal', 'grille',
    'grilleBar', 'chrome', 'bumper', 'under', 'tire', 'rim', 'rimDark', 'hub', 'plate', 'seam', 'handle', 'mirror', 'skirt', 'wing',
    'tread', 'reverse', 'reflector', 'plateText'];
  const M = {};
  MAT_NAMES.forEach((n, i) => { M[n] = i; });

  // u = metros desde la defensa trasera hacia el frente, y = altura, z = a lo ancho (|z| desde el centro).
  // body: silueta lateral de la carrocería baja (defensas, cajuela, cofre), de atrás para adelante por arriba
  //       y de regreso por abajo. gh: la cabina (medallón, techo, parabrisas).
  // front/rear: detalles pintados en la cara de enfrente o de atrás, en orden (el último gana).
  const MODELS = {
    // Ba-tsuru: sedán de tres volúmenes muy cuadrado, cofre plano, cajuela alta y recta, defensas grises
    pitic: {
      body: [[0.06, 0.24], [0.0, 0.32], [0.0, 0.6], [0.03, 0.64], [0.04, 0.92], [0.1, 0.96], [0.86, 0.97], [3.18, 0.92],
        [4.16, 0.81], [4.24, 0.77], [4.25, 0.36], [4.21, 0.26], [3.95, 0.22], [0.3, 0.22]],
      gh: { rear: [0.86, 0.97], roofR: [1.3, 1.36], roofF: [2.6, 1.38], front: [3.18, 0.92], crown: 0.012, roofRound: 0.03,
        hwBelt: 0.76, hwRoof: 0.63, bPillar: 1.98, bW: 0.09, bBlack: true, aThick: 0.07, cThick: 0.2 },
      corner: 0.1, shoulder: 0.04, bottomR: 0.05,
      wheelR: 0.29, tireW: 0.18, spokes: 4,
      bumper: { mat: 'trim', front: 0.55, rear: [0.3, 0.63] },
      front: [
        { m: 'head', y: [0.6, 0.74], z: [0.34, 0.79] },
        { m: 'grille', y: [0.59, 0.74], z: [0, 0.31], bars: true },
        { m: 'signal', y: [0.48, 0.54], z: [0.5, 0.76] },
        { m: 'plate', y: [0.33, 0.46], z: [0, 0.25] },
      ],
      rear: [
        { m: 'garnish', y: [0.67, 0.86], z: [0, 0.42] },
        { m: 'tail', y: [0.67, 0.86], z: [0.42, 0.8] },
        { m: 'garnish', y: [0.755, 0.785], z: [0.42, 0.8] },
        { m: 'plate', y: [0.69, 0.83], z: [0, 0.25] },
      ],
      molding: [0.5, 0.56], seams: [2.98, 1.98, 1.25], handles: [2.08, 1.36], handleY: 0.84,
      mirror: { u: [3.0, 3.12], y: [0.93, 1.03] },
    },
    // Mezquite SR: sedán mediano redondeado, cajuela alta, faros que dan vuelta a la esquina
    mezquite: {
      body: [[0.08, 0.26], [0.0, 0.36], [0.0, 0.64], [0.03, 0.72], [0.05, 0.96], [0.14, 1.01], [0.94, 1.02], [3.45, 0.95],
        [4.25, 0.83], [4.48, 0.76], [4.58, 0.66], [4.6, 0.4], [4.54, 0.28], [4.2, 0.22], [0.4, 0.22]],
      gh: { rear: [0.94, 1.02], roofR: [1.52, 1.4], roofF: [2.7, 1.43], front: [3.45, 0.95], crown: 0.03, roofRound: 0.07,
        hwBelt: 0.76, hwRoof: 0.62, bPillar: 2.22, bW: 0.09, bBlack: true, aThick: 0.07, cThick: 0.16 },
      corner: 0.3, shoulder: 0.1, bottomR: 0.08,
      wheelR: 0.31, tireW: 0.19, spokes: 5,
      bumper: { mat: 'paint', front: 0.57, rear: [0.3, 0.66] },
      front: [
        { m: 'head', y: [0.62, 0.78], z: [0.38, 0.9] },
        { m: 'grille', y: [0.6, 0.75], z: [0, 0.34], bars: true, bar: 'chrome' },
        { m: 'chrome', y: [0.73, 0.76], z: [0, 0.36] },
        { m: 'grille', y: [0.3, 0.42], z: [0, 0.46] },
        { m: 'plate', y: [0.43, 0.55], z: [0, 0.25] },
      ],
      rear: [
        { m: 'tail', y: [0.72, 0.92], z: [0.44, 0.9] },
        { m: 'chrome', y: [0.86, 0.9], z: [0, 0.44] },
        { m: 'plate', y: [0.7, 0.84], z: [0, 0.25] },
      ],
      molding: [0.48, 0.53], seams: [3.28, 2.22, 1.38], handles: [2.34, 1.5], handleY: 0.88,
      mirror: { u: [3.28, 3.42], y: [0.97, 1.09] },
    },
    // Hondiablo Si: sedán deportivo bajo, parabrisas muy inclinado, cajuela corta, alerón, faldones oscuros
    choya: {
      body: [[0.08, 0.24], [0.0, 0.34], [0.0, 0.64], [0.03, 0.74], [0.04, 0.97], [0.1, 1.01], [0.74, 1.02], [3.2, 0.92],
        [4.1, 0.79], [4.38, 0.68], [4.49, 0.56], [4.5, 0.34], [4.42, 0.22], [4.0, 0.18], [0.4, 0.18]],
      gh: { rear: [0.74, 1.02], roofR: [1.56, 1.39], roofF: [2.42, 1.41], front: [3.2, 0.92], crown: 0.03, roofRound: 0.06,
        hwBelt: 0.79, hwRoof: 0.62, bPillar: 2.12, bW: 0.09, bBlack: true, aThick: 0.08, cThick: 0.12 },
      corner: 0.26, shoulder: 0.09, bottomR: 0.07,
      wheelR: 0.32, tireW: 0.21, spokes: 5,
      bumper: { mat: 'paint', front: 0.62, rear: [0.3, 0.66] },
      front: [
        { m: 'head', y: [0.6, 0.71], z: [0.42, 0.9] },
        { m: 'grille', y: [0.5, 0.6], z: [0, 0.4], mesh: true },
        { m: 'grille', y: [0.25, 0.41], z: [0, 0.62], mesh: true },
        { m: 'plate', y: [0.42, 0.5], z: [0, 0.25] },
      ],
      rear: [
        { m: 'tail', y: [0.74, 0.9], z: [0.42, 0.9] },
        { m: 'chrome', y: [0.85, 0.88], z: [0, 0.36] },
        { m: 'plate', y: [0.68, 0.83], z: [0, 0.25] },
        { m: 'skirt', y: [0, 0.34], z: [0, 0.75] },
      ],
      skirt: 0.27, seams: [3.04, 2.12, 1.3], handles: [2.22, 1.42], handleY: 0.86,
      mirror: { u: [3.05, 3.18], y: [0.93, 1.04] },
      spoiler: { u: [0.04, 0.3], y: [1.1, 1.15], zMax: 0.8, postU: [0.12, 0.2], postZ: 0.55 },
    },
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  // cuánto se mete la orilla redondeada de radio r a una distancia d del borde
  const round = (d, r) => (d >= r || r <= 0 ? 0 : r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))));
  function pip(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ---------- de cubitos a triángulos (lo usan carros, personajes y escenario) ----------
  // occ: Uint8Array nx·ny·nz (índice (ix·ny + iy)·nz + iz). origin: esquina (0,0,0) de la rejilla en metros.
  // Devuelve solo las caras visibles, 6 vértices cada una, con oclusión ambiental por vértice.
  const AO = [0.5, 0.68, 0.84, 1];
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const TAN = [[1, 2], [1, 2], [0, 2], [0, 2], [0, 1], [0, 1]];
  // noBottom: sin las caras de abajo de la capa más baja (pisos: nunca se ven)
  function voxelFaces(nx, ny, nz, occ, vox, origin, noBottom) {
    const idx = (ix, iy, iz) => (ix * ny + iy) * nz + iz;
    const solid = (ix, iy, iz) => ix >= 0 && iy >= 0 && iz >= 0 && ix < nx && iy < ny && iz < nz && occ[idx(ix, iy, iz)] !== 0;
    const pos = [], nor = [], ao = [], fv = [], fd = [];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const i = idx(ix, iy, iz);
      if (!occ[i]) continue;
      const c = [ix, iy, iz];
      for (let d = 0; d < 6; d++) {
        const n = DIRS[d];
        const nb = [ix + n[0], iy + n[1], iz + n[2]];
        if (solid(nb[0], nb[1], nb[2])) continue;
        if (noBottom && d === 3 && iy === 0) continue;
        const [ta, tb] = TAN[d];
        const corners = [];
        for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const p1 = nb.slice(), p2 = nb.slice(), p3 = nb.slice();
          p1[ta] += sa; p2[tb] += sb; p3[ta] += sa; p3[tb] += sb;
          const s1 = solid(p1[0], p1[1], p1[2]) ? 1 : 0, s2 = solid(p2[0], p2[1], p2[2]) ? 1 : 0, s3 = solid(p3[0], p3[1], p3[2]) ? 1 : 0;
          const o = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
          const off = [0, 0, 0];
          off[d >> 1] = n[d >> 1] * 0.5; off[ta] = sa * 0.5; off[tb] = sb * 0.5;
          corners.push([origin[0] + (c[0] + 0.5 + off[0]) * vox, origin[1] + (c[1] + 0.5 + off[1]) * vox, origin[2] + (c[2] + 0.5 + off[2]) * vox, AO[o], o]);
        }
        // voltea la diagonal para que la sombra se interpole parejo
        const order = corners[0][4] + corners[2][4] > corners[1][4] + corners[3][4] ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
        for (const k of order) {
          const q = corners[k];
          pos.push(q[0], q[1], q[2]); nor.push(n[0], n[1], n[2]); ao.push(q[3]);
        }
        fv.push(i); fd.push(d);
      }
    }
    return { count: fv.length, pos: new Float32Array(pos), nor: new Float32Array(nor), ao: new Float32Array(ao), vox: Int32Array.from(fv), dir: Uint8Array.from(fd) };
  }

  // arma un modelo con cajas de cubitos (coordenadas enteras, inclusivas): { x: [a, b], y: [a, b], z: [a, b], c: '#rrggbb', em, sp }
  // Las cajas de después tapan a las de antes; c: null borra. El modelo queda centrado en x/z y con el piso en y = 0
  // (con keepY se respetan las coordenadas: el cubito (0, 0, 0) queda en el origen, sobre el piso). Devuelve { verts, stat (pos+normal+ao), dyn (color+emisivo+brillo), size }.
  function fromBoxes(boxes, vox, keepY, noBottom) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of boxes) {
      x0 = Math.min(x0, b.x[0]); x1 = Math.max(x1, b.x[1]); y0 = Math.min(y0, b.y[0]); y1 = Math.max(y1, b.y[1]);
      z0 = Math.min(z0, b.z[0]); z1 = Math.max(z1, b.z[1]);
    }
    const nx = x1 - x0 + 1, ny = y1 - y0 + 1, nz = z1 - z0 + 1;
    const occ = new Uint8Array(nx * ny * nz), colI = new Int32Array(nx * ny * nz).fill(-1);
    const pal = [];
    boxes.forEach((b) => {
      let k = -1;
      if (b.c) { k = pal.length; pal.push([rgb(b.c), b.em || 0, b.sp == null ? 0.1 : b.sp]); }
      for (let x = b.x[0]; x <= b.x[1]; x++) for (let y = b.y[0]; y <= b.y[1]; y++) for (let z = b.z[0]; z <= b.z[1]; z++) {
        const i = ((x - x0) * ny + (y - y0)) * nz + (z - z0);
        occ[i] = k >= 0 ? 1 : 0; colI[i] = k;
      }
    });
    // con keepY el cubito (0, 0, 0) queda centrado en x/z sobre el origen y apoyado en el piso
    const origin = keepY ? [(x0 - 0.5) * vox, y0 * vox, (z0 - 0.5) * vox] : [(-nx / 2) * vox, 0, (-nz / 2) * vox];
    const F = voxelFaces(nx, ny, nz, occ, vox, origin, noBottom);
    return pack(F, (f) => pal[colI[F.vox[f]]], { x: nx * vox, y: ny * vox, z: nz * vox });
  }
  // arreglos listos para la GPU: stat = [x y z nx ny nz ao], dyn = [r g b emisivo brillo]
  function pack(F, faceColor, size) {
    const verts = F.count * 6;
    const stat = new Float32Array(verts * 7), dyn = new Float32Array(verts * 5);
    for (let v = 0; v < verts; v++) {
      stat[v * 7] = F.pos[v * 3]; stat[v * 7 + 1] = F.pos[v * 3 + 1]; stat[v * 7 + 2] = F.pos[v * 3 + 2];
      stat[v * 7 + 3] = F.nor[v * 3]; stat[v * 7 + 4] = F.nor[v * 3 + 1]; stat[v * 7 + 5] = F.nor[v * 3 + 2];
      stat[v * 7 + 6] = F.ao[v];
    }
    for (let f = 0; f < F.count; f++) {
      const [c, em, sp] = faceColor(f);
      for (let k = 0; k < 6; k++) dyn.set([c[0], c[1], c[2], em, sp], (f * 6 + k) * 5);
    }
    return { verts, stat, dyn, size };
  }

  const cache = new Map();

  // carro hecho a mano cubito por cubito (src/batsuru3d.js): misma malla y mismos datos por cara que build()
  function buildHand(spec, G) {
    const occ = new Uint8Array(G.cell.length);
    for (let i = 0; i < occ.length; i++) occ[i] = G.cell[i] ? 1 : 0;
    const F = voxelFaces(G.nx, G.ny, G.nz, occ, G.vox, G.origin);
    const fMat = new Uint8Array(F.count), fInfo = new Float32Array(F.count * 6);
    for (let f = 0; f < F.count; f++) {
      const i = F.vox[f], ix = Math.floor(i / (G.ny * G.nz)), iy = Math.floor(i / G.nz) % G.ny, iz = i % G.nz;
      fMat[f] = M[G.names[G.cell[i]]];
      fInfo.set([G.u(ix), G.y(iy), G.z(iz), G.dTop[i], G.zone[i], F.dir[f]], f * 6);
    }
    return {
      id: spec.id, faces: F.count, verts: F.count * 6,
      pos: F.pos, nor: F.nor, ao: F.ao, fMat, fInfo,
      length: G.length, width: G.width, height: G.height, hoodU: G.hoodU,
    };
  }

  function build(spec) {
    if (cache.has(spec.id)) return cache.get(spec.id);
    const hand = window.HmoBatsuru3D;
    if (hand && hand.ids.includes(spec.id)) {
      const mesh = buildHand(spec, hand.grid());
      cache.set(spec.id, mesh);
      return mesh;
    }
    const md = MODELS[spec.id];
    const L = spec.length, W = spec.width, g = md.gh, R = md.wheelR;
    const axF = L / 2 + spec.wheelbase / 2 + 0.05, axR = L / 2 - spec.wheelbase / 2 + 0.05;
    const H = Math.max(g.roofR[1], g.roofF[1]) + g.crown + 0.2;
    const padU = 0.1;
    const nx = Math.ceil((L + 2 * padU) / VOX), ny = Math.ceil(H / VOX), nz = 2 * Math.ceil((W / 2 + 0.16) / VOX);
    const U = (ix) => (ix + 0.5) * VOX - padU, Y = (iy) => (iy + 0.5) * VOX, Z = (iz) => (iz + 0.5 - nz / 2) * VOX;
    const N = nx * ny * nz;
    const idx = (ix, iy, iz) => (ix * ny + iy) * nz + iz;
    const occ = new Uint8Array(N), mat = new Uint8Array(N), zone = new Uint8Array(N);
    const dTop = new Float32Array(N), hwA = new Float32Array(N);

    // silueta lateral en 2D
    const side = new Uint8Array(nx * ny);
    const top = new Float32Array(nx).fill(-1), bot = new Float32Array(nx).fill(-1);
    const fU = new Float32Array(ny).fill(-1e9), rU = new Float32Array(ny).fill(1e9);
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
      if (!pip(md.body, U(ix), Y(iy))) continue;
      side[ix * ny + iy] = 1;
      if (bot[ix] < 0) bot[ix] = Y(iy) - VOX / 2;
      top[ix] = Y(iy) + VOX / 2;
      fU[iy] = Math.max(fU[iy], U(ix) + VOX / 2);
      rU[iy] = Math.min(rU[iy], U(ix) - VOX / 2);
    }
    const belt = (u) => lerp(g.rear[1], g.front[1], (u - g.rear[0]) / (g.front[0] - g.rear[0]));
    const roofY = (u) => {
      if (u < g.roofR[0]) return lerp(g.rear[1], g.roofR[1], (u - g.rear[0]) / (g.roofR[0] - g.rear[0]));
      if (u > g.roofF[0]) return lerp(g.roofF[1], g.front[1], (u - g.roofF[0]) / (g.front[0] - g.roofF[0]));
      const t = (u - g.roofR[0]) / (g.roofF[0] - g.roofR[0]);
      return lerp(g.roofR[1], g.roofF[1], t) + g.crown * 4 * t * (1 - t);
    };

    // 1) relleno
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
      const u = U(ix), y = Y(iy);
      const inBody = side[ix * ny + iy] === 1;
      let hw, inGh = false;
      if (inBody) {
        hw = W / 2 - round(fU[iy] - u, md.corner) - round(u - rU[iy], md.corner) - round(top[ix] - y, md.shoulder) - round(y - bot[ix], md.bottomR);
      } else if (u > g.rear[0] && u < g.front[0] && y > belt(u) - VOX && y < roofY(u)) {
        inGh = true;
        const ry = roofY(u), b = belt(u);
        hw = lerp(g.hwBelt, g.hwRoof, clamp01((y - b) / (ry - b))) - round(ry - y, g.roofRound);
      } else continue;
      for (let iz = 0; iz < nz; iz++) {
        if (Math.abs(Z(iz)) > hw) continue;
        const i = idx(ix, iy, iz);
        occ[i] = 1; zone[i] = inGh ? 1 : 0; hwA[i] = hw;
        dTop[i] = inBody ? top[ix] - y : -1;
      }
    }

    // ancho real del costado (antes de cortar las salpicaderas) para saber qué cubitos son la piel de afuera
    const sideZ = new Float32Array(nx * ny);
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
      let m = 0;
      for (let iz = nz / 2; iz < nz; iz++) if (occ[idx(ix, iy, iz)]) m = Math.abs(Z(iz));
      sideZ[ix * ny + iy] = m;
    }

    // 2) salpicaderas: hueco para las llantas
    const zo = W / 2 - 0.035, zi = zo - md.tireW;
    const axles = [axF, axR];
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const i = idx(ix, iy, iz);
      if (!occ[i]) continue;
      const u = U(ix), y = Y(iy), az = Math.abs(Z(iz));
      for (const a of axles) if (Math.hypot(u - a, y - R) < R + 0.07 && az > zi - 0.08) occ[i] = 0;
    }

    // superficie de enfrente y de atrás por renglón (para faros, parrilla, calaveras)
    const fIx = new Int16Array(ny * nz).fill(-1), rIx = new Int16Array(ny * nz).fill(32767);
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      if (!occ[idx(ix, iy, iz)] || zone[idx(ix, iy, iz)]) continue;
      const k = iy * nz + iz;
      if (ix > fIx[k]) fIx[k] = ix;
      if (ix < rIx[k]) rIx[k] = ix;
    }
    const feature = (list, y, az, iy, iz, cur) => {
      for (const f of list) {
        if (y < f.y[0] || y > f.y[1] || az < f.z[0] || az > f.z[1]) continue;
        cur = M[f.m];
        if (f.bars && iy % 2 === 0) cur = M[f.bar || 'grilleBar'];
        if (f.mesh && (iy + iz) % 2 === 0) cur = M.grilleBar;
      }
      return cur;
    };
    const bumperMat = md.bumper.mat === 'trim' ? M.bumper : M.paint;

    // 3) materiales
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      const i = idx(ix, iy, iz);
      if (!occ[i]) continue;
      const u = U(ix), y = Y(iy), z = Z(iz), az = Math.abs(z);
      let m = M.paint;
      if (zone[i]) {
        const ry = roofY(u), b = belt(u);
        const uA = g.front[0] + (g.roofF[0] - g.front[0]) * clamp01((y - g.front[1]) / (g.roofF[1] - g.front[1]));
        const uC = g.rear[0] + (g.roofR[0] - g.rear[0]) * clamp01((y - g.rear[1]) / (g.roofR[1] - g.rear[1]));
        const edge = az > hwA[i] - VOX * 1.5;
        if (y > ry - VOX * 1.3 && u >= g.roofR[0] - 0.03 && u <= g.roofF[0] + 0.03) m = M.roof;
        else if (edge) {
          if (Math.abs(u - g.bPillar) < g.bW / 2) m = g.bBlack ? M.blackout : M.pillar;
          else if (u < uA - g.aThick && u > uC + g.cThick && y < ry - VOX * 1.3 && y > b + VOX * 0.4) m = M.glass;
          else m = M.pillar;
        } else m = M.glass;
      } else {
        const outer = az > sideZ[ix * ny + iy] - VOX * 0.6;
        if (u > axF + R + 0.04 && y < md.bumper.front) m = bumperMat;
        if (u < axR - R - 0.04 && y > md.bumper.rear[0] && y < md.bumper.rear[1]) m = bumperMat;
        if (md.skirt && y < md.skirt) m = M.skirt;
        if (outer) {
          if (md.molding && y > md.molding[0] && y < md.molding[1] && u > axR - R - 0.1 && u < axF + R + 0.1) m = M.garnish;
          if (y > bot[ix] + 0.1 && y < top[ix] - 0.02 && md.seams.some((s) => Math.abs(u - s) < VOX * 0.5)) m = M.seam;
          if (Math.abs(y - md.handleY) < 0.035 && md.handles.some((hh) => Math.abs(u - hh) < 0.065)) m = M.handle;
        }
        const k = iy * nz + iz;
        if (ix >= fIx[k] - 1) m = feature(md.front, y, az, iy, iz, m);
        if (ix <= rIx[k] + 1) m = feature(md.rear, y, az, iy, iz, m);
        if (y < bot[ix] + VOX) m = M.under;
        // por dentro de la salpicadera, oscuro
        if (!outer) for (const a of axles) if (Math.hypot(u - a, y - R) < R + 0.07 + VOX * 2.6) m = M.under;
      }
      mat[i] = m;
    }

    const put = (ix, iy, iz, m) => {
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return;
      const i = idx(ix, iy, iz);
      occ[i] = 1; mat[i] = m; zone[i] = 0; dTop[i] = 0;
    };
    const IX = (u) => Math.floor((u + padU) / VOX), IY = (y) => Math.floor(y / VOX), IZ = (z) => Math.floor(z / VOX + nz / 2);

    // 4) espejos
    if (md.mirror) {
      for (let ix = IX(md.mirror.u[0]); ix <= IX(md.mirror.u[1]); ix++) for (let iy = IY(md.mirror.y[0]); iy <= IY(md.mirror.y[1]); iy++) {
        for (let iz = 0; iz < nz; iz++) {
          const az = Math.abs(Z(iz));
          if (az < g.hwBelt - 0.04 || az > W / 2 + 0.11) continue;
          if (!occ[idx(ix, iy, iz)]) put(ix, iy, iz, ix === IX(md.mirror.u[0]) && az > W / 2 ? M.blackout : M.mirror);
        }
      }
    }
    // 5) alerón
    const sp = md.spoiler;
    if (sp) {
      for (let ix = IX(sp.u[0]); ix <= IX(sp.u[1]); ix++) for (let iy = IY(sp.y[0]); iy <= IY(sp.y[1]); iy++) {
        for (let iz = 0; iz < nz; iz++) if (Math.abs(Z(iz)) <= sp.zMax) put(ix, iy, iz, M.wing);
      }
      for (let ix = IX(sp.postU[0]); ix <= IX(sp.postU[1]); ix++) for (let iy = 0; iy < IY(sp.y[0]); iy++) {
        if (Y(iy) < top[ix] - 0.01) continue;
        for (let iz = 0; iz < nz; iz++) if (Math.abs(Math.abs(Z(iz)) - sp.postZ) < 0.045) put(ix, iy, iz, M.skirt);
      }
    }
    // 6) llantas y rines
    for (const a of axles) {
      for (let ix = IX(a - R - VOX); ix <= IX(a + R + VOX); ix++) for (let iy = 0; iy <= IY(2 * R + VOX); iy++) for (let iz = 0; iz < nz; iz++) {
        const du = U(ix) - a, dy = Y(iy) - R, az = Math.abs(Z(iz));
        const d = Math.hypot(du, dy);
        if (d > R || az > zo || az < zi) continue;
        const r = d / R, layer = (zo - az) / VOX;
        let m;
        if (r > 0.68) m = M.tire;
        else if (layer < 1) {
          const th = Math.atan2(dy, du);
          if (r < 0.26) m = M.hub;
          else if (r > 0.56 || Math.cos(md.spokes * th) > 0.25) m = M.rim;
          else continue; // hueco entre rayos
        } else m = M.rimDark;
        put(ix, iy, iz, m);
      }
    }

    // 7) caras visibles con oclusión ambiental
    const F = voxelFaces(nx, ny, nz, occ, VOX, [-padU - L / 2, 0, (-nz / 2) * VOX]);
    const fMat = new Uint8Array(F.count), fInfo = [];
    for (let f = 0; f < F.count; f++) {
      const i = F.vox[f], ix = Math.floor(i / (ny * nz)), iy = Math.floor(i / nz) % ny, iz = i % nz;
      fMat[f] = mat[i];
      fInfo.push(U(ix), Y(iy), Z(iz), dTop[i], zone[i], F.dir[f]);
    }
    const pos = F.pos, nor = F.nor, ao = F.ao;
    const mesh = {
      id: spec.id, faces: F.count, verts: F.count * 6,
      pos, nor, ao, fMat, fInfo: new Float32Array(fInfo),
      length: L, width: W, height: H, hoodU: g.front[0],
    };
    cache.set(spec.id, mesh);
    return mesh;
  }

  // ---------- color ----------
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function hash3(x, y, z) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const s = (t) => t * t * (3 - 2 * t);
    const fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
    const v = (a, b, c) => hash3(xi + a, yi + b, zi + c);
    const x00 = lerp(v(0, 0, 0), v(1, 0, 0), fx), x10 = lerp(v(0, 1, 0), v(1, 1, 0), fx);
    const x01 = lerp(v(0, 0, 1), v(1, 0, 1), fx), x11 = lerp(v(0, 1, 1), v(1, 1, 1), fx);
    return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
  }
  const CAMO = ['#c8a46e', '#a07a4c', '#6f5a3a', '#d9c39a'].map(rgb);
  const FIXED = {
    blackout: rgb('#15171c'), garnish: rgb('#1d2026'), handle: rgb('#24272e'), grille: rgb('#0e1014'), grilleBar: rgb('#3a3e46'),
    chrome: rgb('#c9ced6'), under: rgb('#0b0c10'), tire: rgb('#17181c'), plate: rgb('#e6e2d3'),
    head: rgb('#fff4c7'), tail: rgb('#d6332f'), signal: rgb('#f0a63a'),
    tread: rgb('#26272c'), reverse: rgb('#ebe8e0'), reflector: rgb('#6d1117'), plateText: rgb('#24356a'),
  };
  const PAINT_FAMILY = new Set([M.paint, M.roof, M.pillar, M.mirror, M.seam, M.wing]);

  // colores por vértice: [r, g, b, emisivo, brillo] × 6 por cara
  function colors(mesh, spec, paint, rimHex) {
    const md = MODELS[spec.id];
    const col = rgb((paint && paint.color) || spec.color);
    const finish = (paint && paint.finish) || 'solido', wrap = (paint && paint.wrap) || 'ninguno';
    const lum = col[0] * 0.299 + col[1] * 0.587 + col[2] * 0.114;
    const second = rgb(lum < 110 / 255 ? '#ecebe4' : '#22252c');
    const trim = rgb(spec.trim), glass = rgb(spec.body.glass), rim = rgb(rimHex || '#8a8f96');
    const paintSpec = finish === 'metalico' ? 0.75 : finish === 'perlado' ? 0.6 : 0.3;
    const L = mesh.length, W = mesh.width;
    const out = new Float32Array(mesh.verts * 5);
    for (let f = 0; f < mesh.faces; f++) {
      const m = mesh.fMat[f];
      const o = f * 6;
      const u = mesh.fInfo[o], y = mesh.fInfo[o + 1], z = mesh.fInfo[o + 2], dT = mesh.fInfo[o + 3], zn = mesh.fInfo[o + 4], dir = mesh.fInfo[o + 5];
      let c, em = 0, sp = 0.08;
      const painted = PAINT_FAMILY.has(m) || (m === M.paint) || (m === M.bumper && md.bumper.mat !== 'trim');
      if (painted) {
        c = col;
        const az = Math.abs(z);
        if (wrap === 'franjas' && az > 0.09 && az < 0.24) c = second;
        else if (wrap === 'dostonos' && ((zn && (m === M.roof || m === M.pillar)) || (!zn && u > mesh.hoodU - 0.02 && dT >= 0 && dT < 0.1))) c = second;
        else if (wrap === 'cuadros' && !zn && u > mesh.hoodU && dT >= 0 && dT < 0.22) {
          const q = 0.22;
          if ((Math.floor((L - u) / q) + Math.floor((z + W / 2) / q)) % 2 === 0) c = second;
        } else if (wrap === 'camuflaje') {
          const n = noise3(u * 2.4, y * 2.4, z * 2.4 + 7.3);
          c = CAMO[n < 0.36 ? 2 : n < 0.5 ? 1 : n < 0.66 ? 0 : 3];
        }
        if (m === M.seam) c = mul(c, 0.6);
        if (m === M.bumper) c = mul(c, 0.94);
        if (finish === 'metalico') c = mul(c, 0.95 + hash3(Math.round(u / VOX), Math.round(y / VOX), Math.round(z / VOX) + 99) * 0.12);
        if (finish === 'perlado') c = mix(c, dir === 2 ? [1, 0.82, 0.95] : dir >= 4 ? [0.72, 0.95, 1] : [0.95, 0.95, 1], 0.16);
        sp = paintSpec;
      } else if (m === M.bumper || m === M.skirt) { c = trim; sp = 0.15; }
      else if (m === M.glass) { c = glass; sp = 1; }
      else if (m === M.rim) { c = rim; sp = 0.7; }
      else if (m === M.hub) { c = mul(rim, 0.7); sp = 0.5; }
      else if (m === M.rimDark) { c = mul(rim, 0.35); }
      else {
        const name = MAT_NAMES[m];
        c = FIXED[name] || [1, 0, 1];
        if (m === M.head) { em = 0.8; sp = 0.6; }
        else if (m === M.tail) { em = 0.55; sp = 0.5; }
        else if (m === M.signal) { em = 0.4; sp = 0.5; }
        else if (m === M.reverse) { em = 0.25; sp = 0.6; }
        else if (m === M.reflector) { em = 0.15; sp = 0.5; }
        else if (m === M.chrome) sp = 1;
        else if (m === M.plate) sp = 0.15;
      }
      for (let v = 0; v < 6; v++) {
        const k = (o + v) * 5;
        out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = em; out[k + 4] = sp;
      }
    }
    return out;
  }

  window.HmoModel3D = { build, colors, voxelFaces, fromBoxes, pack, VOX, MODELS };
})();
