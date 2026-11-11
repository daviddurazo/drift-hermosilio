// Talleres de tuneo en la ciudad: 9 normales y 3 escondidos que cambian de lugar cada rato
// y solo aparecen después de pasar cerca.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, save, ECON, map, TM } = G;

  const NORMAL_SHOPS = HmoTuning.normalShops(map.pois, TM);
  let hiddenEpoch = -1, HIDDEN_SHOPS = [];
  function refreshHidden() {
    const ep = Math.floor(save.playTime / (ECON.hiddenMinutes * 60));
    if (ep === hiddenEpoch) return;
    hiddenEpoch = ep;
    HIDDEN_SHOPS = HmoTuning.hiddenShops(map.pois, TM, ep);
    if (save.hiddenFound.epoch !== ep) save.hiddenFound = { epoch: ep, ids: [] };
  }
  refreshHidden();

  // los escondidos solo se ven después de encontrarlos
  const visibleShops = () => NORMAL_SHOPS.concat(HIDDEN_SHOPS.filter((h) => save.hiddenFound.ids.includes(h.id)));
  function checkHiddenFound() {
    for (const h of HIDDEN_SHOPS) {
      if (save.hiddenFound.ids.includes(h.id)) continue;
      if (Math.hypot(h.x - car.x, h.y - car.y) < 45) {
        save.hiddenFound.ids.push(h.id);
        G.showToast(`Encontraste un taller escondido: ${h.name}`);
        G.persist();
      }
    }
  }
  function shopsStep() { refreshHidden(); checkHiddenFound(); }
  function shopHere() {
    for (const sh of visibleShops()) if (Math.hypot(sh.x - car.x, sh.y - car.y) < 8) return sh;
    return null;
  }

  // letrero del taller: llave inglesa sobre un círculo
  function drawShops(ctx, R) {
    const cam = G.cam;
    for (const sh of visibleShops()) {
      if (Math.abs(sh.x - cam.x) > R || Math.abs(sh.y - cam.y) > R) continue;
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.fillStyle = sh.hidden ? 'rgba(201,154,60,0.18)' : 'rgba(228,87,46,0.14)';
      ctx.strokeStyle = sh.hidden ? 'rgba(201,154,60,0.9)' : 'rgba(228,87,46,0.85)';
      ctx.lineWidth = 0.22; ctx.setLineDash([0.9, 0.6]);
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(-cam.rot);
      ctx.fillStyle = sh.hidden ? '#c99a3c' : '#e4572e';
      ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.28; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.55, 0.55); ctx.lineTo(0.3, -0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(0.42, -0.42, 0.32, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  Object.assign(G, { visibleShops, shopsStep, shopHere, drawShops });
})();
