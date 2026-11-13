// Carros del juego: la lista de fichas (HmoCars.CARS) y su dibujo visto desde arriba (makeSprite).
// Nombres y siluetas propias; no usan marcas ni diseños de modelos reales.
(function () {
  'use strict';

  // Las fichas viven en la carpeta de cada carro (src/cars/<nombre>/car.js) y llegan por el registro.
  const CARS = HmoCarRegistry.list.map((d) => d.spec);

  const PPM = 24; // px por metro del sprite
  const MARGIN = 0.18; // espejos y alerón sobresalen

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, p = Math.abs(f);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }

  // Dibuja el carro mirando hacia +x (derecha). Devuelve un canvas.
  // paint: { color, finish: 'solido'|'metalico'|'perlado', wrap: 'ninguno'|'franjas'|'dostonos'|'cuadros'|'camuflaje' }
  function makeSprite(spec, paint) {
    const col = (paint && paint.color) || spec.color;
    const finish = (paint && paint.finish) || 'solido';
    const wrap = (paint && paint.wrap) || 'ninguno';
    const dark = (() => { const n = parseInt(col.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 110; })();
    const second = dark ? '#ecebe4' : '#22252c';
    const L = spec.length, W = spec.width, B = spec.body;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((L + MARGIN * 2) * PPM);
    cv.height = Math.ceil((W + MARGIN * 2) * PPM);
    const g = cv.getContext('2d');
    g.scale(PPM, PPM);
    g.translate(L / 2 + MARGIN, W / 2 + MARGIN);

    const x0 = -L / 2, y0 = -W / 2;
    // espejos
    g.fillStyle = shade(col, -0.25);
    const mx = L / 2 - B.hood - 0.15;
    g.fillRect(mx, y0 - 0.14, 0.2, 0.16);
    g.fillRect(mx, -y0 - 0.02, 0.2, 0.16);
    // carrocería
    g.fillStyle = col;
    g.beginPath(); g.roundRect(x0, y0, L, W, B.r); g.fill();

    // wrap y acabado, recortados a la carrocería
    g.save();
    g.beginPath(); g.roundRect(x0, y0, L, W, B.r); g.clip();
    if (wrap === 'camuflaje') {
      const camo = ['#c8a46e', '#a07a4c', '#6f5a3a', '#d9c39a'];
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      g.fillStyle = camo[0]; g.fillRect(x0, y0, L, W);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = camo[1 + (i % 3)];
        g.beginPath(); g.ellipse(x0 + rnd() * L, y0 + rnd() * W, 0.25 + rnd() * 0.35, 0.15 + rnd() * 0.25, rnd() * 3, 0, Math.PI * 2); g.fill();
      }
    } else if (wrap === 'franjas') {
      g.fillStyle = second;
      g.fillRect(x0, -0.24, L, 0.15);
      g.fillRect(x0, 0.09, L, 0.15);
    } else if (wrap === 'dostonos') {
      g.fillStyle = second;
      g.fillRect(L / 2 - B.hood - 0.05, y0, B.hood + 0.05, W); // cofre del segundo color
    } else if (wrap === 'cuadros') {
      const q = 0.22;
      for (let i = 0; i * q < B.hood; i++) for (let j = 0; j * q < W; j++) {
        if ((i + j) % 2) continue;
        g.fillStyle = second;
        g.fillRect(L / 2 - B.hood + i * q, y0 + j * q, q, q);
      }
    }
    if (finish === 'metalico') {
      const gr = g.createLinearGradient(x0, y0, x0 + L * 0.6, -y0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x0, y0, L, W);
    } else if (finish === 'perlado') {
      const gr = g.createLinearGradient(x0, y0, -x0, -y0);
      gr.addColorStop(0, 'rgba(255,190,240,0.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(170,240,255,0.25)');
      g.fillStyle = gr; g.fillRect(x0, y0, L, W);
    }
    g.restore();
    // costado en sombra (abajo) y luz (arriba)
    g.fillStyle = shade(col, -0.14);
    g.beginPath(); g.roundRect(x0 + 0.05, -y0 - 0.16, L - 0.1, 0.14, 0.07); g.fill();
    g.fillStyle = shade(col, 0.22);
    g.beginPath(); g.roundRect(x0 + 0.08, y0 + 0.03, L - 0.16, 0.08, 0.04); g.fill();

    // cabina: parabrisas, techo, medallón, ventanas laterales
    const cf = L / 2 - B.hood;          // frente de la cabina
    const cb = -L / 2 + B.trunk;        // atrás de la cabina
    const ci = B.cabinInset;
    g.fillStyle = B.glass;
    g.beginPath(); g.roundRect(cb, y0 + ci - 0.06, cf - cb, W - 2 * ci + 0.12, 0.18); g.fill();
    // techo
    const wsDepth = B.style === 'boxy' ? 0.42 : 0.55;
    const rwDepth = B.style === 'boxy' ? 0.36 : B.style === 'sport' ? 0.5 : 0.45;
    g.fillStyle = wrap === 'dostonos' ? second : wrap === 'camuflaje' ? '#a07a4c' : shade(col, 0.08);
    g.beginPath(); g.roundRect(cb + rwDepth, y0 + ci + 0.04, cf - cb - wsDepth - rwDepth, W - 2 * ci - 0.08, B.style === 'boxy' ? 0.06 : 0.16); g.fill();
    // brillo del parabrisas
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(cf - wsDepth + 0.08, y0 + ci + 0.05, 0.1, (W - 2 * ci) * 0.45);

    // línea de cofre y cajuela
    g.fillStyle = 'rgba(0,0,0,0.10)';
    g.fillRect(cf + 0.06, y0 + 0.2, 0.025, W - 0.4);
    g.fillRect(cb - 0.08, y0 + 0.2, 0.025, W - 0.4);
    if (B.style === 'sport') {
      // toma de aire en el cofre y franja
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(L / 2 - 0.75, -0.18, 0.32, 0.36);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x0 + 0.1, -0.08, L - 0.2, 0.05);
      g.fillRect(x0 + 0.1, 0.03, L - 0.2, 0.05);
    }

    // defensas
    g.fillStyle = spec.trim;
    g.fillRect(L / 2 - 0.09, y0 + 0.16, 0.09, W - 0.32);
    g.fillRect(x0, y0 + 0.16, 0.09, W - 0.32);
    // faros y calaveras
    g.fillStyle = '#fff4c7';
    const hlW = B.style === 'boxy' ? 0.42 : 0.34;
    g.fillRect(L / 2 - 0.13, y0 + 0.1, 0.1, hlW);
    g.fillRect(L / 2 - 0.13, -y0 - 0.1 - hlW, 0.1, hlW);
    g.fillStyle = '#d6332f';
    g.fillRect(x0 + 0.03, y0 + 0.1, 0.09, 0.36);
    g.fillRect(x0 + 0.03, -y0 - 0.46, 0.09, 0.36);
    // alerón
    if (B.style === 'sport') {
      g.fillStyle = spec.trim;
      g.fillRect(x0 - 0.1, y0 - 0.02, 0.16, W + 0.04);
    }
    return cv;
  }

  window.HmoCars = { CARS, makeSprite, PPM, MARGIN };
})();
