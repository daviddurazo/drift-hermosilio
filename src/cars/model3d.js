// Modelos 3D de los carros hechos de vóxeles (cubitos), para las vitrinas del taller y la escena del meet.
// Cada carro trae en su carpeta (src/cars/<nombre>/car.js) su silueta lateral (model) y aquí se "rellena"
// con cubitos de VOX metros; o trae su rejilla hecha a mano (voxels) y aquí solo se convierte.
// Las caras visibles las saca src/engine/voxels.js, con oclusión ambiental por vértice.
(function () {
  'use strict';

  const { faces: voxelFaces, rgb } = HmoVoxels;

  const VOX = 0.06; // tamaño del cubito en metros

  const MAT_NAMES = ['paint', 'roof', 'pillar', 'blackout', 'glass', 'head', 'tail', 'garnish', 'signal', 'grille',
    'grilleBar', 'chrome', 'bumper', 'under', 'tire', 'rim', 'rimDark', 'hub', 'plate', 'seam', 'handle', 'mirror', 'skirt', 'wing',
    'tread', 'reverse', 'reflector', 'plateText'];
  const M = {};
  MAT_NAMES.forEach((n, i) => { M[n] = i; });

  // Formato de model (la silueta de cada carro):
  // u = metros desde la defensa trasera hacia el frente, y = altura, z = a lo ancho (|z| desde el centro).
  // body: silueta lateral de la carrocería baja (defensas, cajuela, cofre), de atrás para adelante por arriba
  //       y de regreso por abajo. gh: la cabina (medallón, techo, parabrisas).
  // front/rear: detalles pintados en la cara de enfrente o de atrás, en orden (el último gana).
  // Lo demás (corner, wheelR, bumper, molding, seams, handles, mirror, skirt, spoiler) se lee en build().

  const modelOf = (id) => {
    const def = HmoCarRegistry.get(id);
    if (!def) throw new Error(`HmoModel3D: no hay un carro registrado con id '${id}'`);
    return def;
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

  const cache = new Map();

  // carro hecho a mano cubito por cubito (p. ej. src/cars/ba-tsuru/voxels.js): misma malla y mismos datos por cara que build()
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
    const def = modelOf(spec.id);
    if (def.voxels) {
      const mesh = buildHand(spec, def.voxels());
      cache.set(spec.id, mesh);
      return mesh;
    }
    const md = def.model;
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
    const md = modelOf(spec.id).model;
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

  window.HmoModel3D = { build, colors, VOX };
})();
