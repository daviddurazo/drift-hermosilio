// Mapa de tiles de Hermosillo: decodificación, propiedades y dibujo con estilo de cuadrícula.
// Lo usan el visor (mapa.html) y, después, el juego.
(function () {
  'use strict';

  const T = {
    BLOCK: 0, ROAD: 1, LINE: 2, SIDEWALK: 3, PARKING: 4, PLAZA: 5, PARK: 6, PITCH: 7,
    PATH: 8, WATER: 9, CAMPUS: 11, ROCK: 12, DESERT: 13, TREE: 14,
    SAGUARO: 15, DIRT: 16, TRACK: 17, CAR: 18, PAD: 19, CERRO0: 20, PUMP: 26, GARAGE: 27, BUILDING: 30,
  };

  const NAMES = {
    0: 'Manzana', 1: 'Calle', 2: 'Calle (raya central)', 3: 'Banqueta', 4: 'Estacionamiento',
    5: 'Plaza', 6: 'Parque', 7: 'Cancha', 8: 'Andador', 9: 'Agua',
    11: 'Escuela / hospital', 12: 'Roca', 13: 'Matorral', 14: 'Árbol', 15: 'Sahuaro', 16: 'Terracería',
    17: 'Pista de atletismo', 18: 'Carro estacionado', 19: 'Gasolinera', 26: 'Bomba de gasolina', 27: 'Taller',
  };

  const isCerro = (id) => id >= 20 && id <= 24;
  const isBuilding = (id) => id >= 30 && id <= 33;
  const SOLID = new Set([T.BLOCK, T.TREE, T.SAGUARO, T.ROCK, T.CAR, T.PUMP, 30, 31, 32, 33]);
  const TALL = new Set([T.BLOCK, 30, 31, 32, 33]); // proyectan sombra

  function decode(m) {
    const bin = atob(m.rle);
    const out = new Uint8Array(m.w * m.h);
    let i = 0, p = 0;
    while (i < bin.length) {
      const v = bin.charCodeAt(i++);
      let L = 0, sh = 0, b;
      do { b = bin.charCodeAt(i++); L |= (b & 0x7f) << sh; sh += 7; } while (b & 0x80);
      out.fill(v, p, p + L);
      p += L;
    }
    return out;
  }

  // hash entero determinístico -> [0,1)
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  class HmoMap {
    constructor(m) {
      this.w = m.w; this.h = m.h; this.tileM = m.tileM; this.pois = m.pois || {};
      this.t = decode(m);
    }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
      return this.t[y * this.w + x];
    }
    solid(id) { return id < 0 || SOLID.has(id); }
    name(id) {
      if (id < 0) return 'Fuera del mapa';
      if (isCerro(id)) return 'Cerro (nivel ' + (id - 20 + 1) + ')';
      if (isBuilding(id)) return 'Edificio';
      return NAMES[id] || '—';
    }
  }

  // ---------------- paleta ----------------
  // Casas, edificios y obstáculos con la paleta «Fachadas mexicanas»: colores saturados que aguantan la capa de noche.
  // Calles, banquetas, parques y cerro se quedan neutros para que lo llamativo sean las construcciones.
  const C = {
    asphalt: '#3d4151', asphaltLine: 'rgba(255,255,255,0.035)',
    yellow: '#f2c14e',
    sidewalk: '#ddd5c6', curb: '#b9b0a0',
    parking: '#4d5263', stall: 'rgba(255,255,255,0.55)',
    plazaA: '#e8d3ab', plazaB: '#ddc69b',
    parkA: '#87b968', parkB: '#80b262',
    pitchA: '#5f9f6d', pitchB: '#58976a',
    path: '#dcc79f', dirt: '#c99d6b',
    water: '#4aa3c4', waterHi: '#8fcbe0',
    roofsBig: ['#4a7fd8', '#e8ecf2', '#ff8a3d', '#2a3f78'], buildingEdge: 'rgba(40,25,30,0.4)',
    solar: '#3b63b8', solarLine: '#8fb0f0', skylight: '#a9d3e0', tinaco: '#23262e',
    track: '#c4624a', trackLine: 'rgba(255,255,255,0.55)',
    cars: ['#ff3b3b', '#ffffff', '#1e2230', '#2f7bff', '#ffcf33', '#18a999', '#8e44ad', '#f0652a'],
    campus: '#e3dac7',
    rock: '#a0663f', desert: '#d6b486',
    cerro: ['#bb8b5f', '#c5986b', '#cfa678', '#d9b487', '#e3c398'],
    cliff: 'rgba(92,58,32,0.55)',
    lot: '#c98a4b',
    // rosa mexicano, turquesa, mostaza, cobalto, naranja, verde, terracota, morado, amarillo
    roofs: ['#e6336f', '#18a999', '#f2a900', '#2d5bd2', '#f0652a', '#3fae4f', '#c0392b', '#8e44ad', '#ffcf33'],
    cooler: '#9aa3ab', coolerDark: '#6f7880',
    tree: '#1f9a4a', treeHi: '#4cc66a',
    saguaro: '#2f9e4f', saguaroHi: '#5fd27a',
    shadow: 'rgba(25,22,45,0.22)',
    out: '#1d1f29',
  };

  // color simple por tile para el mapa alejado (1 px por tile)
  const OVERVIEW = {
    0: '#d4604a', 1: C.asphalt, 2: C.asphalt, 3: C.sidewalk, 4: C.parking, 5: C.plazaA, 6: C.parkA, 7: C.pitchA,
    8: C.path, 9: C.water, 11: C.campus, 12: C.rock, 13: C.desert, 14: C.tree, 15: C.saguaro,
    16: C.dirt, 17: C.track, 18: C.parking, 19: '#cdd1d4', 26: '#f2c14e', 27: '#a9a49b', 30: C.roofsBig[0], 31: C.roofsBig[1], 32: C.roofsBig[2], 33: C.roofsBig[3], 20: C.cerro[0], 21: C.cerro[1], 22: C.cerro[2], 23: C.cerro[3], 24: C.cerro[4],
  };

  const TILE = 12; // px por tile a zoom 1 (3 m -> 12 px)
  const CH = 32;   // tiles por lado de cada bloque cacheado

  class Renderer {
    constructor(map) {
      this.map = map;
      this.cache = new Map();
      this.maxCache = 160;
      this.overview = this.buildOverview();
    }

    buildOverview() {
      const { w, h, t } = this.map;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      const img = g.createImageData(w, h);
      const rgb = {};
      for (const k in OVERVIEW) {
        const s = OVERVIEW[k];
        rgb[k] = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
      }
      for (let i = 0; i < t.length; i++) {
        const c = rgb[t[i]] || [255, 0, 255];
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return cv;
    }

    // ---------- dibujo de un tile ----------
    paintTile(g, x, y, px, py) {
      const m = this.map, S = TILE;
      const id = m.get(x, y);
      const n = m.get(x, y - 1), s = m.get(x, y + 1), w = m.get(x - 1, y), e = m.get(x + 1, y);
      const r = hash(x, y);

      const rect = (c, ox, oy, ww, hh) => { g.fillStyle = c; g.fillRect(px + ox, py + oy, ww, hh); };

      switch (id) {
        case T.ROAD: case T.LINE:
          rect(C.asphalt, 0, 0, S, S);
          if (r < 0.5) rect(r < 0.25 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)', 0, 0, S, S);
          rect(C.asphaltLine, 0, 0, S, 1); rect(C.asphaltLine, 0, 0, 1, S);
          if (id === T.LINE) rect(C.yellow, 4, 4, 4, 4);
          break;
        case T.SIDEWALK:
          rect(C.sidewalk, 0, 0, S, S);
          rect('rgba(0,0,0,0.06)', 0, 0, S, 1); rect('rgba(0,0,0,0.06)', 0, 0, 1, S);
          if (n === T.ROAD || n === T.LINE) rect(C.curb, 0, 0, S, 2);
          if (s === T.ROAD || s === T.LINE) rect(C.curb, 0, S - 2, S, 2);
          if (w === T.ROAD || w === T.LINE) rect(C.curb, 0, 0, 2, S);
          if (e === T.ROAD || e === T.LINE) rect(C.curb, S - 2, 0, 2, S);
          break;
        case T.PARKING: case T.CAR: {
          // pasillo (y%6 0-1), fila A (2-3), fila B (4-5): mismo patrón que tools/build_map.py
          rect(C.parking, 0, 0, S, S);
          rect('rgba(255,255,255,0.03)', 0, 0, S, 1); rect('rgba(255,255,255,0.03)', 0, 0, 1, S);
          const row = ((y % 6) + 6) % 6;
          const pk = (k) => k === T.PARKING || k === T.CAR;
          if (row >= 2) {
            if (pk(w)) rect(C.stall, 0, row === 2 ? 3 : 0, 1, row === 5 ? S - 3 : S - (row === 2 ? 3 : 0));
            if (row === 4 && pk(n)) rect(C.stall, 0, 0, S, 1); // línea entre filas espalda con espalda
          } else if (row === 0 && (x % 8) === 3 && pk(e) && pk(w)) {
            // flecha de sentido en el pasillo
            g.fillStyle = 'rgba(255,255,255,0.35)';
            g.fillRect(px + 1, py + 5, 7, 2);
            g.beginPath(); g.moveTo(px + 7, py + 2); g.lineTo(px + 11, py + 6); g.lineTo(px + 7, py + 10); g.fill();
          }
          break;
        }
        case T.PAD:
          rect('#cdd1d4', 0, 0, S, S);
          if (x % 2 === 0) rect('rgba(0,0,0,0.07)', 0, 0, 1, S);
          if (y % 2 === 0) rect('rgba(0,0,0,0.07)', 0, 0, S, 1);
          if (r < 0.08) { g.fillStyle = 'rgba(40,40,50,0.12)'; g.beginPath(); g.arc(px + 4 + r * 40, py + 6, 2.5, 0, Math.PI * 2); g.fill(); }
          break;
        case T.GARAGE: {
          // patio de taller: concreto gastado con manchas de aceite y franja de precaución en la orilla
          rect('#a9a49b', 0, 0, S, S);
          if (x % 2 === 0) rect('rgba(0,0,0,0.08)', 0, 0, 1, S);
          if (y % 2 === 0) rect('rgba(0,0,0,0.08)', 0, 0, S, 1);
          if (r < 0.25) { g.fillStyle = 'rgba(30,30,40,0.22)'; g.beginPath(); g.arc(px + 3 + r * 24, py + 4 + r * 16, 2 + r * 6, 0, Math.PI * 2); g.fill(); }
          const edgeOf = (k) => k !== T.GARAGE && k !== T.ROAD && k !== T.LINE && k !== T.SIDEWALK;
          const hz = (ox, oy, ww, hh) => { for (let i = 0; i < Math.max(ww, hh); i += 3) { g.fillStyle = ((i / 3) | 0) % 2 ? '#22252c' : '#f2c14e'; if (ww > hh) g.fillRect(px + ox + i, py + oy, 3, hh); else g.fillRect(px + ox, py + oy + i, ww, 3); } };
          if (edgeOf(n)) hz(0, 0, S, 2);
          if (edgeOf(s)) hz(0, S - 2, S, 2);
          if (edgeOf(w)) hz(0, 0, 2, S);
          if (edgeOf(e)) hz(S - 2, 0, 2, S);
          break;
        }
        case T.PUMP: {
          // isla de concreto alzada; la bomba va en el tile de en medio
          rect('#cdd1d4', 0, 0, S, S);
          const horiz = w === T.PUMP || e === T.PUMP;
          const a0 = horiz ? (w === T.PUMP ? 0 : 2) : (n === T.PUMP ? 0 : 2);
          const a1 = horiz ? (e === T.PUMP ? S : S - 2) : (s === T.PUMP ? S : S - 2);
          if (horiz) { rect('rgba(25,22,45,0.25)', a0 + 2, 4, a1 - a0, 7); rect('#efede6', a0, 2, a1 - a0, 7); rect('#ffffff', a0, 2, a1 - a0, 1); }
          else { rect('rgba(25,22,45,0.25)', 4, a0 + 2, 7, a1 - a0); rect('#efede6', 2, a0, 7, a1 - a0); rect('#ffffff', 2, a0, 1, a1 - a0); }
          const mid = horiz ? (w === T.PUMP && e === T.PUMP) : (n === T.PUMP && s === T.PUMP);
          if (mid) {
            rect('#2b2f3a', 3, 3, 6, 5); rect('#f2c14e', 3, 3, 6, 2); rect('#e4572e', 8, 6, 2, 3);
          }
          break;
        }
        case T.TRACK:
          rect(C.track, 0, 0, S, S);
          if ((x + y) % 2 === 0) rect('rgba(255,255,255,0.06)', 0, 0, S, S);
          if (n !== T.TRACK) rect(C.trackLine, 0, 0, S, 1);
          if (s !== T.TRACK) rect(C.trackLine, 0, S - 1, S, 1);
          if (w !== T.TRACK) rect(C.trackLine, 0, 0, 1, S);
          if (e !== T.TRACK) rect(C.trackLine, S - 1, 0, 1, S);
          break;
        case T.PLAZA:
          rect(((x + y) & 1) ? C.plazaA : C.plazaB, 0, 0, S, S);
          break;
        case T.PARK: case T.TREE:
          rect(((y >> 1) & 1) ? C.parkA : C.parkB, 0, 0, S, S);
          if (id === T.PARK && r > 0.965) { // arbusto
            rect('rgba(30,70,40,0.25)', 4, 5, 6, 5);
            rect('#5f9a55', 3, 3, 6, 5); rect('#79b064', 4, 3, 3, 2);
          } else if (id === T.PARK && r > 0.94) { // flores
            rect('#f2c14e', 3, 4, 2, 2); rect('#e7795f', 7, 7, 2, 2); rect('#f3efe6', 8, 3, 2, 2);
          }
          break;
        case T.PITCH: {
          rect(((x >> 1) & 1) ? C.pitchA : C.pitchB, 0, 0, S, S);
          const L = 'rgba(255,255,255,0.75)';
          if (n !== T.PITCH) rect(L, 0, 2, S, 1);
          if (s !== T.PITCH) rect(L, 0, S - 3, S, 1);
          if (w !== T.PITCH) rect(L, 2, 0, 1, S);
          if (e !== T.PITCH) rect(L, S - 3, 0, 1, S);
          break;
        }
        case T.PATH:
          rect(C.path, 0, 0, S, S);
          break;
        case T.DIRT:
          rect(C.dirt, 0, 0, S, S);
          if (r < 0.3) rect('rgba(0,0,0,0.08)', (r * 40 | 0) % 9, (r * 70 | 0) % 9, 2, 2);
          break;
        case T.WATER:
          rect(C.water, 0, 0, S, S);
          if (r < 0.18) rect(C.waterHi, 2 + (r * 30 | 0) % 5, 3 + (r * 50 | 0) % 6, 5, 1);
          break;
        case T.CAMPUS:
          rect(C.campus, 0, 0, S, S);
          rect('rgba(0,0,0,0.035)', 0, 0, S, 1); rect('rgba(0,0,0,0.035)', 0, 0, 1, S);
          break;
        case T.ROCK:
          rect(C.rock, 0, 0, S, S);
          break;
        case T.DESERT: case T.SAGUARO:
          rect(C.desert, 0, 0, S, S);
          if (r < 0.25) rect('rgba(90,60,30,0.15)', (r * 40 | 0) % 9, (r * 70 | 0) % 9, 2, 2);
          break;
        case 30: case 31: case 32: case 33:
          this.paintRoof(g, id, x, y, px, py, n, s, w, e, r);
          break;
        case T.BLOCK:
          this.paintHouse(g, x, y, px, py);
          break;
        default:
          if (isCerro(id)) {
            const lv = id - 20;
            rect(C.cerro[lv], 0, 0, S, S);
            if (r < 0.2) rect('rgba(90,55,25,0.18)', (r * 40 | 0) % 9, (r * 70 | 0) % 9, 2, 2);
            const lvOf = (k) => (isCerro(k) ? k - 20 : (k === T.SAGUARO || k === T.DIRT || k === T.PATH || k === T.PLAZA) ? lv : -1);
            if (lvOf(s) < lv) rect(C.cliff, 0, S - 3, S, 3);
            if (lvOf(e) < lv) rect('rgba(92,58,32,0.3)', S - 2, 0, 2, S);
            if (lvOf(n) < lv) rect('rgba(255,255,255,0.22)', 0, 0, S, 2);
          } else {
            rect(C.out, 0, 0, S, S);
          }
      }

      // sombra de lo alto (sol del noroeste)
      if (!TALL.has(id)) {
        if (TALL.has(n)) rect(C.shadow, 0, 0, S, 4);
        if (TALL.has(w)) rect(C.shadow, 0, n !== undefined && TALL.has(n) ? 4 : 0, 4, TALL.has(n) ? S - 4 : S);
        else if (!TALL.has(n) && TALL.has(m.get(x - 1, y - 1))) rect(C.shadow, 0, 0, 4, 4);
      }
    }

    // casas: celdas de 3x3 tiles (9 m) con azotea de color, a veces patio
    paintHouse(g, x, y, px, py) {
      const S = TILE;
      const cx = Math.floor(x / 3), cy = Math.floor(y / 3);
      const hr = hash(cx, cy, 7);
      const rect = (c, ox, oy, ww, hh) => { g.fillStyle = c; g.fillRect(px + ox, py + oy, ww, hh); };
      if (hr < 0.1) { // patio / lote baldío
        rect(C.lot, 0, 0, S, S);
        if (hash(x, y, 3) < 0.15) rect('rgba(90,60,30,0.15)', 4, 5, 2, 2);
        return;
      }
      const roof = C.roofs[Math.floor(hash(cx, cy, 11) * C.roofs.length)];
      rect(roof, 0, 0, S, S);
      const lx = x - cx * 3, ly = y - cy * 3;
      if (ly === 0) rect('rgba(255,255,255,0.3)', 0, 0, S, 2);
      if (lx === 0) rect('rgba(255,255,255,0.18)', 0, 0, 2, S);
      if (ly === 2) rect('rgba(0,0,0,0.16)', 0, S - 2, S, 2);
      if (lx === 2) rect('rgba(0,0,0,0.12)', S - 2, 0, 2, S);
      // el cooler en la azotea
      if (lx === 1 && ly === 1 && hash(cx, cy, 5) < 0.35) this.cooler(g, px, py);
      else if (lx === 0 && ly === 0 && hash(cx, cy, 9) < 0.4) this.tinaco(g, px + 2, py + 2);
    }

    // azotea de edificio: pretil en la orilla, juntas cada 4 tiles y equipo según el tipo
    paintRoof(g, id, x, y, px, py, n, s, w, e, r) {
      const S = TILE, v = id - 30;
      const rect = (c, ox, oy, ww, hh) => { g.fillStyle = c; g.fillRect(px + ox, py + oy, ww, hh); };
      rect(C.roofsBig[v], 0, 0, S, S);
      const edge = (k) => !isBuilding(k);
      const inner = !edge(n) && !edge(s) && !edge(w) && !edge(e);
      // juntas de losa
      if (x % 4 === 0) rect('rgba(0,0,0,0.05)', 0, 0, 1, S);
      if (y % 4 === 0) rect('rgba(0,0,0,0.05)', 0, 0, S, 1);
      // pretil: luz arriba/izquierda, sombra abajo/derecha, y un borde interior
      if (edge(n)) { rect('rgba(255,255,255,0.5)', 0, 0, S, 2); rect('rgba(0,0,0,0.08)', 0, 2, S, 1); }
      if (edge(w)) { rect('rgba(255,255,255,0.35)', 0, 0, 2, S); rect('rgba(0,0,0,0.06)', 2, 0, 1, S); }
      if (edge(s)) rect(C.buildingEdge, 0, S - 2, S, 2);
      if (edge(e)) rect(C.buildingEdge, S - 2, 0, 2, S);
      if (!inner) return;
      if (v === 0) {            // concreto: coolers y ductos
        if (r < 0.07) this.cooler(g, px, py);
        else if (r < 0.11) { rect('#8d9298', 3, 3, 6, 6); rect('#b3b8bd', 4, 4, 4, 4); }
      } else if (v === 1) {     // membrana blanca: tragaluces en retícula
        if (x % 4 === 1 && y % 3 === 1) { rect('rgba(0,0,0,0.12)', 3, 3, 7, 7); rect(C.skylight, 2, 2, 7, 7); rect('rgba(255,255,255,0.6)', 3, 3, 3, 1); }
        else if (r < 0.04) this.cooler(g, px, py);
      } else if (v === 2) {     // beige: tinacos y coolers
        if (r < 0.05) this.tinaco(g, px, py);
        else if (r < 0.1) this.cooler(g, px, py);
      } else {                  // paneles solares en hileras, con pasillo cada 3 filas
        if (y % 3 !== 0) {
          rect(C.solar, 1, 1, S - 2, S - 2);
          rect(C.solarLine, 1, Math.floor(S / 2), S - 2, 1);
          rect(C.solarLine, Math.floor(S / 2), 1, 1, S - 2);
          rect('rgba(255,255,255,0.18)', 1, 1, S - 2, 1);
        } else if (r < 0.15) this.cooler(g, px, py);
      }
    }

    tinaco(g, px, py) {
      const cx = px + TILE / 2, cy = py + TILE / 2;
      g.fillStyle = 'rgba(25,22,45,0.25)';
      g.beginPath(); g.arc(cx + 1.5, cy + 1.5, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.tinaco;
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a4f5c';
      g.beginPath(); g.arc(cx - 1, cy - 1, 1.5, 0, Math.PI * 2); g.fill();
    }

    cooler(g, px, py) {
      g.fillStyle = C.coolerDark; g.fillRect(px + 3, py + 4, 7, 6);
      g.fillStyle = C.cooler; g.fillRect(px + 2, py + 3, 7, 6);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px + 3, py + 5, 5, 1); g.fillRect(px + 3, py + 7, 5, 1);
    }

    // lo que sobresale de su tile: árboles y sahuaros
    paintOverlay(g, x, y, px, py) {
      const id = this.map.get(x, y);
      const S = TILE, cx = px + S / 2, cy = py + S / 2;
      if (id === T.TREE) {
        g.fillStyle = 'rgba(25,22,45,0.25)';
        g.beginPath(); g.arc(cx + 3, cy + 3, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = C.tree;
        g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = C.treeHi;
        g.beginPath(); g.arc(cx - 2.5, cy - 2.5, 4, 0, Math.PI * 2); g.fill();
      } else if (id === T.CAR) {
        const row = ((y % 6) + 6) % 6;
        if (row !== 2 && row !== 4) return; // solo la mitad de arriba dibuja el carro completo
        const col = C.cars[Math.floor(hash(x, y, 13) * C.cars.length)];
        const bx = px + 2, by = py + 3, bw = S - 4, bh = 2 * S - 6;
        const front = row === 4; // fila B mira hacia abajo
        g.fillStyle = 'rgba(25,22,45,0.28)'; g.fillRect(bx + 2, by + 2, bw, bh);
        g.fillStyle = col; g.fillRect(bx, by, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx, by, bw, 1);
        g.fillStyle = 'rgba(20,28,40,0.75)';
        const wy = front ? by + bh - 8 : by + 4; // parabrisas hacia el pasillo
        g.fillRect(bx + 1, wy, bw - 2, 4);
        g.fillRect(bx + 1, front ? by + 4 : by + bh - 7, bw - 2, 3);
      } else if (id === T.SAGUARO) {
        // sahuaro visto de frente, estilo pixel
        const bx = Math.round(cx) - 1, by = py - 6;
        g.fillStyle = 'rgba(25,22,45,0.22)'; g.fillRect(bx + 1, py + S - 2, 7, 3);
        g.fillStyle = C.saguaro;
        g.fillRect(bx, by, 3, S + 6);           // tronco
        g.fillRect(bx - 4, by + 7, 4, 2);       // brazo izq
        g.fillRect(bx - 4, by + 3, 2, 5);
        g.fillRect(bx + 3, by + 9, 4, 2);       // brazo der
        g.fillRect(bx + 5, by + 4, 2, 6);
        g.fillStyle = C.saguaroHi; g.fillRect(bx, by, 1, S + 6);
      }
    }

    chunk(kx, ky) {
      const key = kx + ',' + ky;
      let c = this.cache.get(key);
      if (c) { this.cache.delete(key); this.cache.set(key, c); return c; }
      return null;
    }

    buildChunk(kx, ky) {
      const key = kx + ',' + ky;
      const cv = document.createElement('canvas');
      cv.width = cv.height = CH * TILE;
      const g = cv.getContext('2d');
      const x0 = kx * CH, y0 = ky * CH;
      for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) this.paintTile(g, x0 + i, y0 + j, i * TILE, j * TILE);
      for (let j = -1; j <= CH; j++) for (let i = -1; i <= CH; i++) this.paintOverlay(g, x0 + i, y0 + j, i * TILE, j * TILE);
      this.cache.set(key, cv);
      while (this.cache.size > this.maxCache) this.cache.delete(this.cache.keys().next().value);
      return cv;
    }

    // cam: centro en tiles; zoom: 1 = TILE px por tile (en px de dispositivo, ya multiplicado por dpr)
    // detailMin: debajo de TILE*detailMin px por tile solo se dibuja la imagen de 1 px por tile
    draw(ctx, camX, camY, scale, vw, vh, budget = 8, detailMin = 0.4) {
      const m = this.map;
      ctx.fillStyle = C.out;
      ctx.fillRect(0, 0, vw, vh);
      ctx.imageSmoothingEnabled = false;
      const ox = vw / 2 - camX * scale, oy = vh / 2 - camY * scale;
      // fondo siempre: el mapa a 1 px por tile
      ctx.drawImage(this.overview, Math.round(ox), Math.round(oy), Math.round(m.w * scale), Math.round(m.h * scale));
      if (scale < TILE * detailMin) return true;
      const tx0 = Math.max(0, Math.floor((0 - ox) / scale)), ty0 = Math.max(0, Math.floor((0 - oy) / scale));
      const tx1 = Math.min(m.w - 1, Math.floor((vw - ox) / scale)), ty1 = Math.min(m.h - 1, Math.floor((vh - oy) / scale));
      const k0x = Math.floor(tx0 / CH), k0y = Math.floor(ty0 / CH), k1x = Math.floor(tx1 / CH), k1y = Math.floor(ty1 / CH);
      let done = true;
      const pending = [];
      for (let ky = k0y; ky <= k1y; ky++) {
        for (let kx = k0x; kx <= k1x; kx++) {
          const c = this.chunk(kx, ky);
          if (c) this.blit(ctx, c, kx, ky, ox, oy, scale);
          else pending.push([kx, ky]);
        }
      }
      // construye primero los más cercanos al centro
      const ccx = camX / CH, ccy = camY / CH;
      pending.sort((a, b) => Math.hypot(a[0] + 0.5 - ccx, a[1] + 0.5 - ccy) - Math.hypot(b[0] + 0.5 - ccx, b[1] + 0.5 - ccy));
      for (let i = 0; i < pending.length; i++) {
        if (i < budget) this.blit(ctx, this.buildChunk(pending[i][0], pending[i][1]), pending[i][0], pending[i][1], ox, oy, scale);
        else done = false;
      }
      return done;
    }

    blit(ctx, c, kx, ky, ox, oy, scale) {
      const x0 = Math.round(ox + kx * CH * scale), y0 = Math.round(oy + ky * CH * scale);
      const x1 = Math.round(ox + (kx + 1) * CH * scale), y1 = Math.round(oy + (ky + 1) * CH * scale);
      ctx.drawImage(c, x0, y0, x1 - x0, y1 - y0);
    }
  }

  window.Hmo = { T, HmoMap, Renderer, TILE, CH, hash, isCerro };
})();
