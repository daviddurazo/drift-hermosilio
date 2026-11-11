// Meets: un punto que cambia cada rato. Estacionado ahí juntas Street XP por minuto, más un bono por llegar.
// También puedes dejar el carro y sigue juntando XP aunque cierres el juego.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, save, ECON, map, TM } = G;

  const MEET_R = 14, MEET_STAY = 10;
  let meetTimer = 0, meetEpochShown = -1, farmAcc = 0;

  function meetEpoch() { return Math.floor(save.playTime / (ECON.meetMinutes * 60)); }
  function activeMeet() {
    const spots = map.pois.meetSpots || [];
    if (!spots.length) return null;
    const ep = meetEpoch();
    const r = HmoTuning.rng(555 + ep * 104729);
    const sp = spots[Math.floor(r() * spots.length)];
    return { x: (sp[0] + 0.5) * TM, y: (sp[1] + 0.5) * TM, ep };
  }
  const inMeet = (m) => m && Math.hypot(m.x - car.x, m.y - car.y) < MEET_R && car.tel.speed < 1.5;
  const farmRate = () => HmoProgress.farmRate(save.current, save.tuning[save.current]);

  function meetStep(dt) {
    const m = activeMeet();
    if (m && m.ep !== meetEpochShown) {
      if (meetEpochShown >= 0 && Math.hypot(m.x - car.x, m.y - car.y) > MEET_R) G.showToast('El meet se movió de lugar');
      meetEpochShown = m.ep;
      const st = G.streets.nameAt(m.x, m.y, 120);
      G.showToast(`Hay un meet${st ? ' por ' + st : ''} (M morada en el mapa)`);
    }
    if (!inMeet(m)) { meetTimer = Math.max(0, meetTimer - dt * 2); return; }
    // estacionado en el meet: XP por minuto según el carro y su tuneo
    farmAcc += farmRate() / 60 * dt;
    if (farmAcc >= 1) {
      const n = Math.floor(farmAcc);
      farmAcc -= n;
      const up = G.addXP(n);
      if (up) G.popup(`¡Nivel ${up} de Street XP!`, 'xp');
    }
    // bono por llegar, una vez por meet
    if (save.meetDone !== m.ep) {
      meetTimer += dt;
      if (meetTimer >= MEET_STAY) {
        meetTimer = 0;
        save.meetDone = m.ep;
        save.stats.meets += 1;
        const up = G.addXP(ECON.meetXP);
        G.popup(`+${ECON.meetXP} Street XP por llegar al meet${up ? ` · ¡Nivel ${up}!` : ''}`, 'xp');
        if (G.route && G.dest && G.dest.label === 'meet') G.clearRoute();
        G.persist();
      }
    }
  }

  // dejar el carro en el meet
  function parkAtMeet() {
    const m = activeMeet();
    if (!inMeet(m)) return;
    const rate = farmRate();
    save.parked = { carId: save.current, x: car.x, y: car.y, h: car.h, since: Date.now(), rate, street: G.streets.nameAt(m.x, m.y, 120) };
    G.clearRoute();
    G.driftScore.reset();
    G.persist();
    G.showToast(`Dejaste tu ${car.s.name} en el meet (${rate.toFixed(1)} XP/min)`);
    G.garage.open();
  }

  // texto de abajo cuando estás en el meet (o '' si no)
  function meetPrompt() {
    const m = activeMeet();
    if (inMeet(m)) {
      const bonus = save.meetDone !== m.ep ? ` · bono en ${Math.max(0, Math.ceil(MEET_STAY - meetTimer))} s` : '';
      return `Meet: +${farmRate().toFixed(1)} XP/min${bonus} · E: bajarte al meet`;
    }
    if (m && Math.hypot(m.x - car.x, m.y - car.y) < MEET_R) return 'Meet: detente para juntar Street XP';
    return '';
  }

  // ---------- escena del meet (E estando parado en el meet) ----------
  function openMeetScene() {
    const m = activeMeet();
    if (!inMeet(m)) return;
    G.keys.clear();
    car.vx = car.vy = car.w = 0;
    const id = save.current, tun = save.tuning[id];
    G.meetScene.open({
      seed: m.ep,
      street: G.streets.nameAt(m.x, m.y, 120) || 'Meet',
      player: {
        look: HmoCharacter.lookOf(save.character), spec: G.baseOf(id), paint: tun.paint,
        rim: HmoTuning.RIM_COLORS[tun.rines || 0], neon: HmoTuning.neonOf(tun),
      },
    });
  }
  function closeMeetScene() { G.meetScene.close(); G.keys.clear(); }
  // texto del panel de la escena
  function meetHud() {
    const m = activeMeet();
    const lv = HmoProgress.levelFromXP(save.xp);
    const bonus = m && save.meetDone !== m.ep ? ` · bono de ${ECON.meetXP} XP en ${Math.max(0, Math.ceil(MEET_STAY - meetTimer))} s` : '';
    return {
      xp: `+${farmRate().toFixed(1)} Street XP por minuto${bonus}`,
      level: `Nivel ${lv.level} · ${lv.into} / ${lv.need} XP`,
      frac: lv.frac,
    };
  }

  function drawMeet(ctx) {
    const m = activeMeet();
    if (!m) return;
    const k = 1 + Math.sin(performance.now() / 400) * 0.04;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = 'rgba(139,92,246,0.14)';
    ctx.beginPath(); ctx.arc(0, 0, MEET_R * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(181,131,255,0.9)'; ctx.lineWidth = 0.3; ctx.setLineDash([1.2, 0.8]);
    ctx.beginPath(); ctx.arc(0, 0, MEET_R * k, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (meetTimer > 0 && save.meetDone !== m.ep) { // cuánto falta para el bono de llegada
      ctx.strokeStyle = '#b583ff'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(0, 0, MEET_R + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * meetTimer / MEET_STAY); ctx.stroke();
    }
    ctx.restore();
  }

  Object.assign(G, { activeMeet, inMeet, meetStep, parkAtMeet, meetPrompt, drawMeet, openMeetScene, closeMeetScene, meetHud });
})();
