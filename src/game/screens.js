// Pantallas: tu taller (casa) y los talleres de tuneo, y entrar a ellos con E.
// Los menús (src/ui/menus.js) solo pintan; aquí está lo que pasa al comprar, salir a manejar, etc.
(function () {
  'use strict';

  const G = window.HmoGame;
  const { car, save, ECON } = G;

  // ---------- tu taller ----------
  let garageReturn = false; // al elegir casa desde el taller, regresa al taller
  const garage = new HmoMenus.Garage({
    state: () => Object.assign(save, { home: G.home }),
    drive: (id) => {
      save.current = id;
      G.applyCurrentCar();
      const p = G.nearestRoadM(G.home.x, G.home.y);
      G.placeCar(p[0], p[1], G.bestHeading(p[0], p[1]));
      G.driftScore.reset();
      garage.close();
      G.persist();
    },
    chooseHome: () => { garageReturn = true; garage.close(); G.openFullMap('casa'); },
    setCurrent: (id) => { save.current = id; G.applyCurrentCar(); G.persist(); },
    buyCar: (id) => {
      const price = ECON.carPrice[id];
      if (save.money < price || save.owned.includes(id)) return;
      save.money -= price; save.owned.push(id); save.current = id;
      G.applyCurrentCar(); G.persist();
      G.showToast(`¡Compraste el ${G.baseOf(id).name}!`);
    },
    collect: () => {
      const p = save.parked;
      if (!p) return;
      const xp = HmoProgress.parkedXP(p);
      const up = G.addXP(xp);
      save.current = p.carId;
      save.parked = null;
      G.applyCurrentCar();
      G.placeCar(p.x, p.y, p.h);
      G.driftScore.reset();
      G.persist();
      garage.close();
      G.popup(`+${xp.toLocaleString('es-MX')} Street XP del meet${up ? ` · ¡Nivel ${up}!` : ''}`, 'xp');
    },
    emergencyFuel: () => G.emergencyFuel(),
    editCharacter: () => { garage.close(); charEditor.open(false); },
    wipe: () => { HmoProgress.wipe(); try { localStorage.removeItem('hmo.casa'); } catch (e) { /* nada */ } location.reload(); },
  });
  function openGarage() { G.keys.clear(); car.vx = car.vy = car.w = 0; G.persist(); garage.open(); }
  // al cerrar el mapa completo: si viniste del taller a elegir casa, regresas al taller
  function afterFullMap() { if (garageReturn) { garageReturn = false; garage.open(); } }

  // ---------- talleres de tuneo ----------
  // puedes tunear cualquiera de tus carros; si no es el que traes, te lo llevan a tu casa
  const canTune = (id, price) => save.owned.includes(id) && !(save.parked && save.parked.carId === id) && save.money >= price;
  function installed(id) { if (id === save.current) G.applyCurrentCar(); G.persist(); }
  const shopUI = new HmoMenus.Shop({
    state: () => save,
    buyPart: (id, cat, tier, price) => {
      if (!canTune(id, price)) return;
      save.money -= price; save.tuning[id][cat] = tier;
      installed(id);
      G.showToast(`Instalado: ${HmoTuning.PARTS[cat].opts[tier - 1].name}`);
    },
    buyDrive: (id, k, price) => {
      if (!canTune(id, price)) return;
      save.money -= price; save.tuning[id].drive = k;
      installed(id);
      G.showToast(`Ahora tu ${G.baseOf(id).name} tiene tracción ${HmoTuning.DRIVES[k].name.toLowerCase()}`);
    },
    buyPaint: (id, paint, price) => {
      if (!canTune(id, price)) return;
      save.money -= price; save.tuning[id].paint = paint;
      installed(id);
      G.showToast('¡Quedó pintado!');
    },
    buyNeon: (id, neon, price) => {
      if (!canTune(id, price)) return;
      save.money -= price; save.tuning[id].neon = neon;
      installed(id);
      G.showToast(neon.mode === 'ninguno' ? 'Quitaste las luces de neón' : price ? '¡Neones instalados!' : 'Neones actualizados');
    },
    closed: () => { G.keys.clear(); },
  });
  function openShop(sh) { G.keys.clear(); car.vx = car.vy = car.w = 0; shopUI.open(sh); }

  // ---------- entrar con E ----------
  const atHome = () => G.home && Math.hypot(G.home.x - car.x, G.home.y - car.y) < 10 && car.tel.speed < 2;
  function enter() {
    if (car.tel.speed > 2) return;
    if (atHome()) { openGarage(); return; }
    const sh = G.shopHere();
    if (sh) { openShop(sh); return; }
    if (G.inMeet(G.activeMeet())) G.openMeetScene();
  }
  function promptText() {
    if (car.tel.speed > 2) return '';
    if (atHome()) return 'E: entrar a tu taller';
    const sh = G.shopHere();
    if (sh) return `E: entrar a ${sh.name}`;
    return G.meetPrompt();
  }
  // ---------- tu personaje ----------
  // la primera vez que entras se crea antes de ir al taller; después se edita desde el taller
  const charEditor = new HmoCharMenu.Editor({
    get: () => save.character,
    save: (look) => { save.character = look; G.persist(); },
    done: () => garage.open(),
  });

  // ---------- escena del meet ----------
  const meetScene = new HmoMeetScene.Scene({
    back: () => G.closeMeetScene(),
    leaveCar: () => { G.closeMeetScene(); G.parkAtMeet(); },
  });

  const paused = () => garage.isOpen || shopUI.isOpen || G.fullMap.isOpen || charEditor.isOpen || meetScene.isOpen;

  Object.assign(G, { garage, shopUI, charEditor, meetScene, openGarage, afterFullMap, openShop, enter, promptText, paused });
})();
