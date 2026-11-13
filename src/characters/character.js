// Personajes de cubitos: el tuyo (lo armas en el editor) y la gente de los meets (al azar).
// Se arman con cajas en coordenadas enteras: x a lo ancho, y hacia arriba, z hacia el frente (la cara ve a +z).
(function () {
  'use strict';

  const VOX = 0.06; // mismo tamaño de cubito que los carros: una persona mide ~1.75 m (29 cubitos)

  const OPTIONS = {
    skin: ['#f3d5b5', '#e0ac69', '#c68642', '#a0662f', '#7a4a24', '#4a2c17'],
    build: [['delgado', 'Delgado'], ['normal', 'Normal'], ['grueso', 'Grueso']],
    facial: [['nada', 'Nada'], ['bigote', 'Bigote'], ['candado', 'Candado'], ['barba', 'Barba']],
    hair: [['rapado', 'Rapado'], ['corto', 'Corto'], ['largo', 'Largo'], ['chongo', 'Chongo'], ['rizado', 'Rizado']],
    hairColors: ['#1b1410', '#3b2416', '#6b4423', '#a8723c', '#d9b36c', '#e9e4da', '#c0392b', '#2d5bd2', '#e6336f'],
    top: [['playera', 'Playera'], ['sudadera', 'Sudadera'], ['tirantes', 'Tirantes']],
    bottom: [['pantalon', 'Pantalón'], ['short', 'Short']],
    clothes: ['#ffffff', '#1e2230', '#6f7680', '#e6336f', '#18a999', '#f2a900', '#2d5bd2', '#f0652a', '#3fae4f', '#c0392b', '#8e44ad', '#d4b48c'],
    shoes: ['#ffffff', '#1e2230', '#e6336f', '#f2a900', '#2d5bd2', '#c0392b'],
    cap: [['nada', 'Sin gorra'], ['frente', 'Al frente'], ['volteada', 'Volteada']],
  };

  const defaultLook = () => ({
    name: '', skin: '#c68642', build: 'normal', facial: 'nada',
    hair: 'corto', hairColor: '#1b1410',
    top: 'playera', topColor: '#e6336f', bottom: 'pantalon', bottomColor: '#1e2230', shoes: '#ffffff',
    cap: 'nada', capColor: '#1e2230', glasses: false, chain: false,
  });
  // completa lo que falte (partidas viejas o datos a medias)
  const lookOf = (l) => Object.assign(defaultLook(), l || {});

  // al azar, para la gente de los meets (seed fija = misma persona)
  function randomLook(r) {
    const pick = (a) => a[Math.floor(r() * a.length)];
    const id = (a) => pick(a)[0];
    return {
      name: '', skin: pick(OPTIONS.skin), build: id(OPTIONS.build), facial: r() < 0.55 ? 'nada' : id(OPTIONS.facial),
      hair: id(OPTIONS.hair), hairColor: r() < 0.8 ? pick(OPTIONS.hairColors.slice(0, 5)) : pick(OPTIONS.hairColors),
      top: id(OPTIONS.top), topColor: pick(OPTIONS.clothes), bottom: id(OPTIONS.bottom), bottomColor: pick(OPTIONS.clothes.slice(0, 3).concat(['#2d5bd2', '#d4b48c'])),
      shoes: pick(OPTIONS.shoes), cap: r() < 0.45 ? id(OPTIONS.cap.slice(1)) : 'nada', capColor: pick(OPTIONS.clothes),
      glasses: r() < 0.25, chain: r() < 0.25,
    };
  }

  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
    return '#' + c((n >> 16) & 255) + c((n >> 8) & 255) + c(n & 255);
  };

  // pose: 'parado' (brazos abajo), 'cruzado' (brazos cruzados), 'telefono' (hablando por teléfono)
  function boxes(lookIn, pose) {
    const L = lookOf(lookIn);
    const out = [];
    // los rangos se ordenan solos: el lado izquierdo se arma con x negativos (ej. de -5 a -6)
    const r2 = (a, b) => [Math.min(a, b), Math.max(a, b)];
    const B = (x0, x1, y0, y1, z0, z1, c, sp) => out.push({ x: r2(x0, x1), y: r2(y0, y1), z: r2(z0, z1), c, sp });
    const skin = L.skin, H = L.hairColor, T = L.topColor, P = L.bottomColor;
    const w = { delgado: 3, normal: 4, grueso: 5 }[L.build] || 4;   // medio ancho del torso
    const lw = { delgado: 2, normal: 3, grueso: 3 }[L.build] || 3;  // ancho de cada pierna (de x = 1 a lw)
    const zb = L.build === 'grueso' ? -2 : -1, zf = L.build === 'grueso' ? 2 : 1; // fondo y frente del torso

    // tenis y piernas
    const sole = L.shoes === '#ffffff' ? '#c9ccd1' : '#eceae4';
    for (const s of [-1, 1]) {
      const a = s < 0 ? -lw : 1, b = s < 0 ? -1 : lw;
      B(a, b, 0, 0, -1, 2, sole);
      B(a, b, 1, 1, -1, 2, L.shoes);
      B(a, b, 2, 13, -1, 1, L.bottom === 'short' ? skin : P);
      if (L.bottom === 'short') B(a, b, 8, 13, -1, 1, P);
    }
    B(-lw, lw, 12, 13, -1, 1, P); // cadera

    // torso
    B(-w, w, 14, 23, zb, zf, T);
    if (L.build === 'grueso') B(-w + 1, w - 1, 14, 19, zf + 1, zf + 1, T); // panza
    if (L.top === 'tirantes') { B(-w, -w + 1, 21, 23, zb, zf, skin); B(w - 1, w, 21, 23, zb, zf, skin); B(-w, w, 23, 23, zb, zf, skin); B(-w + 2, -w + 2, 21, 23, zb, zf, T); B(w - 2, w - 2, 21, 23, zb, zf, T); }
    if (L.top === 'sudadera') {
      B(-2, 2, 15, 17, zf + 1, zf + 1, shade(T, 0.82));                 // bolsa
      B(-1, -1, 20, 22, zf + 1, zf + 1, '#eceae4'); B(1, 1, 20, 22, zf + 1, zf + 1, '#eceae4'); // cordones
      B(-3, 3, 23, 25, zb - 1, zb, shade(T, 0.85));                     // gorro de la sudadera
    }
    B(-1, 1, 24, 24, -1, 1, skin); // cuello

    // brazos
    const sleeve = L.top === 'sudadera' ? 14 : L.top === 'playera' ? 20 : 24; // desde qué altura va la manga
    const armColor = (y) => (y >= sleeve && y <= 23 ? T : skin);
    const arm = (s, y0, y1) => { for (let y = y0; y <= y1; y++) B(s * (w + 1), s * (w + 2), y, y, -1, 0, armColor(y)); };
    if (pose === 'cruzado') {
      for (const s of [-1, 1]) arm(s, 17, 23);
      const fore = L.top === 'sudadera' ? T : skin;
      B(-w - 2, w + 2, 17, 18, zf + 1, zf + 2, fore);
      B(-w - 2, -w - 1, 17, 18, zf + 1, zf + 2, skin); B(w + 1, w + 2, 17, 18, zf + 1, zf + 2, skin); // manos
    } else if (pose === 'telefono') {
      arm(-1, 12, 23);
      arm(1, 20, 23);                                                   // brazo de arriba, pegado al cuerpo
      const fore = L.top === 'sudadera' ? T : skin;
      B(w + 1, w + 2, 19, 20, 0, 1, fore);                              // codo
      B(w, w + 1, 21, 24, 1, 2, fore);                                  // antebrazo subiendo por delante del hombro
      B(4, 5, 25, 27, 1, 2, skin);                                      // mano junto a la oreja
      B(4, 4, 26, 29, -1, 0, '#15171c');                                // teléfono
    } else {
      for (const s of [-1, 1]) arm(s, 12, 23);
    }

    // cabeza
    B(-3, 3, 25, 31, -2, 3, skin);
    B(-4, -4, 27, 28, 0, 1, skin); B(4, 4, 27, 28, 0, 1, skin); // orejas
    B(0, 0, 28, 28, 4, 4, skin);                                 // nariz
    // ojos (blanco afuera, pupila adentro) con un renglón de piel entre ellos y las cejas
    B(-2, -2, 28, 28, 3, 3, '#eeece6'); B(-1, -1, 28, 28, 3, 3, '#1b1b22');
    B(2, 2, 28, 28, 3, 3, '#eeece6'); B(1, 1, 28, 28, 3, 3, '#1b1b22');
    B(-2, -1, 30, 30, 3, 3, H); B(1, 2, 30, 30, 3, 3, H); // cejas

    // vello facial
    if (L.facial === 'barba') { B(-3, 3, 25, 27, 3, 3, H); B(-3, -3, 25, 29, 0, 3, H); B(3, 3, 25, 29, 0, 3, H); B(-2, 2, 24, 24, 1, 3, H); }
    if (L.facial === 'candado') B(-1, 1, 24, 26, 3, 3, H);
    if (L.facial === 'bigote' || L.facial === 'candado') B(-2, 2, 27, 27, 3, 3, H);
    B(-1, 1, 26, 26, 3, 3, L.facial === 'barba' ? shade(H, 0.6) : shade(skin, 0.72)); // boca

    // pelo
    const top = (y) => B(-3, 3, y, y, -2, 3, H);
    const sides = (y0) => { B(-3, -3, y0, 31, -2, 1, H); B(3, 3, y0, 31, -2, 1, H); B(-3, 3, y0 - 1, 31, -2, -2, H); };
    if (L.hair === 'rapado') { top(31); sides(29); }
    if (L.hair === 'corto' || L.hair === 'largo') {
      top(31); top(32); sides(28);
      B(-3, 3, 31, 31, 3, 3, H);                           // fleco
      B(-4, -4, 29, 32, -2, 1, H); B(4, 4, 29, 32, -2, 1, H); B(-3, 3, 26, 32, -3, -3, H);
    }
    if (L.hair === 'largo') { B(-3, 3, 19, 32, -4, -3, H); B(-4, -4, 23, 29, -2, 0, H); B(4, 4, 23, 29, -2, 0, H); }
    if (L.hair === 'chongo') { top(31); top(32); sides(28); B(-3, 3, 27, 32, -3, -3, H); B(-1, 1, 31, 34, -5, -3, H); }
    if (L.hair === 'rizado') {
      for (let x = -4; x <= 4; x++) for (let y = 27; y <= 34; y++) for (let z = -3; z <= 3; z++) {
        const inFace = z >= 2 && y <= 31 && Math.abs(x) <= 3;
        const shell = y >= 31 || Math.abs(x) === 4 || z === -3;
        if (inFace || !shell) continue;
        if (y === 34 && (Math.abs(x) === 4 || Math.abs(z) === 3)) continue; // redondeado arriba
        B(x, x, y, y, z, z, (x + y + z) % 2 ? H : shade(H, 0.78));
      }
    }

    // gorra
    if (L.cap !== 'nada') {
      B(-5, 5, 33, 37, -6, 6, null); // lo que sobresale del pelo arriba se quita
      B(-4, 4, 31, 32, -3, 3, L.capColor);
      B(-3, 3, 33, 33, -2, 2, L.capColor);
      B(0, 0, 34, 34, 0, 0, shade(L.capColor, 0.8));
      if (L.cap === 'frente') B(-3, 3, 31, 31, 4, 6, shade(L.capColor, 0.85));
      else B(-3, 3, 31, 31, -6, -4, shade(L.capColor, 0.85));
    }
    if (L.glasses) { B(-3, 3, 28, 28, 4, 4, '#101216', 0.9); B(-4, -4, 28, 28, 0, 3, '#101216'); B(4, 4, 28, 28, 0, 3, '#101216'); }
    if (L.chain) { B(-2, 2, 22, 22, zf + 1, zf + 1, '#f2c14e', 0.9); B(-1, 1, 21, 21, zf + 1, zf + 1, '#f2c14e', 0.9); B(0, 0, 20, 20, zf + 1, zf + 1, '#ffd96a', 0.9); }
    return out;
  }

  // malla lista para HmoGL (stat/dyn); y = 0 es el piso
  function build(look, pose) { return HmoVoxels.fromBoxes(boxes(look, pose), VOX, true); }

  window.HmoCharacter = { OPTIONS, VOX, defaultLook, lookOf, randomLook, boxes, build };
})();
