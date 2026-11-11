// Puntos de drift: se cobran en dinero y dan algo de Street XP.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { save, ECON } = G;
  const { levelFromXP } = HmoProgress;

  const driftScore = new HmoDrift.DriftScore();

  // suma Street XP; devuelve el nivel nuevo si subiste, o 0
  function addXP(n) {
    const before = levelFromXP(save.xp).level;
    save.xp += n;
    const after = levelFromXP(save.xp).level;
    return after > before ? after : 0;
  }

  function onDriftEvent(ev) {
    if (ev.type === 'bank') {
      const cash = Math.round(ev.points * ECON.moneyPerPoint);
      const xp = Math.floor(ev.points / ECON.driftPointsPerXP);
      save.money += cash;
      const up = xp > 0 ? addXP(xp) : 0;
      save.stats.totalPoints += ev.points;
      const record = ev.points > save.stats.bestCombo;
      if (record) save.stats.bestCombo = ev.points;
      G.popup(`+${G.fmtMoney(cash)}${xp > 0 ? ` · +${xp} XP` : ''}${ev.chain > 1 ? ` · ${ev.chain} encadenados` : ''}${record ? ' · ¡récord!' : ''}${up ? ` · ¡Nivel ${up}!` : ''}`, 'bank');
      G.persist();
    } else if (ev.type === 'fail') {
      G.popup(`Chocaste: perdiste ${Math.round(ev.points).toLocaleString('es-MX')} pts`, 'fail');
    }
  }

  Object.assign(G, { driftScore, addXP, onDriftEvent });
})();
