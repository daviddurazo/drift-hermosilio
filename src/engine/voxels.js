// Mallador de cubitos (vóxeles) → triángulos. Lo usan los carros, los personajes y el escenario del meet.
// No dibuja nada: solo arma los arreglos que sube src/engine/gl3d.js a la GPU.
(function () {
  'use strict';

  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

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

  window.HmoVoxels = { faces: voxelFaces, fromBoxes, pack, rgb };
})();
