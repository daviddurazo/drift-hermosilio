// Marcas de llanta y humo/polvo en cuadritos.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car } = G;

  // ---------- marcas de llanta ----------
  const MAXM = 7000;
  const mk = new Float32Array(MAXM * 5);
  let mHead = 0, mCount = 0;
  const lastW = { fl: null, fr: null, rl: null, rr: null };
  function addMark(a, b, kind) {
    const o = mHead * 5;
    mk[o] = a[0]; mk[o + 1] = a[1]; mk[o + 2] = b[0]; mk[o + 3] = b[1]; mk[o + 4] = kind;
    mHead = (mHead + 1) % MAXM;
    mCount = Math.min(MAXM, mCount + 1);
  }
  // al mover el carro de golpe, que la marca no una el lugar viejo con el nuevo
  function resetMarks() { for (const k in lastW) lastW[k] = null; }

  // ---------- humo y polvo ----------
  const parts = [];
  const SMOKE = { paved: '#efede7', dirt: '#d8b98c', grass: '#a9c98c', water: '#cfe6ef' };
  function emit(pos, kind, sp) {
    if (parts.length > 450) return;
    const a = Math.random() * Math.PI * 2;
    parts.push({ x: pos[0], y: pos[1], vx: Math.cos(a) * 0.8 + car.vx * 0.15, vy: Math.sin(a) * 0.8 + car.vy * 0.15, life: 1.1 + Math.random() * 0.8, max: 1.9, size: 0.5 + Math.min(1, sp / 30) * 0.4, col: SMOKE[kind] || SMOKE.paved });
  }

  // después de cada paso de física: marcas y humo según cuánto patina cada llanta
  function skidStep() {
    const t = car.tel;
    const W = car.wheels();
    const sp = t.speed;
    const rearMark = sp > 2 && (t.slipR > 2.2 || t.spinR > 0.05 || (t.handbrake && Math.abs(t.u) > 2));
    const frontMark = sp > 2 && t.slipF > 3.2;
    const kindR = t.surfR.kind, kindF = t.surfF.kind;
    for (const [w, on, kind] of [['rl', rearMark, kindR], ['rr', rearMark, kindR], ['fl', frontMark, kindF], ['fr', frontMark, kindF]]) {
      if (on && kind !== 'water') {
        const p = W[w];
        if (lastW[w]) {
          if (Math.hypot(p[0] - lastW[w][0], p[1] - lastW[w][1]) > 0.3) { addMark(lastW[w], p, kind === 'paved' ? 1 : 2); lastW[w] = p; }
        } else lastW[w] = p;
        if (w[0] === 'r' && Math.random() < (kind === 'paved' ? 0.32 : 0.45)) emit(p, kind, sp);
      } else lastW[w] = null;
    }
  }

  function updateSmoke(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.size += dt * 1.6;
    }
  }

  // en coordenadas de metros; R = radio visible
  function drawMarks(ctx, R) {
    const cam = G.cam;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.24;
    for (const [kind, col] of [[1, 'rgba(22,22,28,0.38)'], [2, 'rgba(110,72,40,0.35)']]) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      for (let i = 0; i < mCount; i++) {
        const o = i * 5;
        if (mk[o + 4] !== kind) continue;
        if (Math.abs(mk[o] - cam.x) > R || Math.abs(mk[o + 1] - cam.y) > R) continue;
        ctx.moveTo(mk[o], mk[o + 1]);
        ctx.lineTo(mk[o + 2], mk[o + 3]);
      }
      ctx.stroke();
    }
  }

  // humo en cuadritos, como el mapa
  function drawSmoke(ctx) {
    for (const p of parts) {
      const a = Math.max(0, p.life / p.max) * 0.55;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      const q = 0.25, s = Math.round(p.size / q) * q;
      ctx.fillRect(Math.round((p.x - s / 2) / q) * q, Math.round((p.y - s / 2) / q) * q, s, s);
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(G, { resetMarks, skidStep, updateSmoke, drawMarks, drawSmoke });
})();
