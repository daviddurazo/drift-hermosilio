// Entrada: teclado y control. Las teclas de acción llaman a funciones de otros archivos a través de G.
(function () {
  'use strict';

  const G = window.HmoGame;

  const keys = new Set();
  const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyR', 'KeyE', 'KeyT', 'KeyH', 'KeyM', 'KeyG', 'KeyX', 'KeyK', 'Escape']);
  // escribiendo en un campo (el apodo) las teclas no son del juego
  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  addEventListener('keydown', (e) => {
    if (typing(e) || !GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (G.fullMap.isOpen) {
      // con el mapa abierto solo se cierra
      if (e.code === 'Escape' || e.code === 'KeyM') G.fullMap.close();
      return;
    }
    if (G.meetScene.isOpen) { if (e.code === 'Escape' || e.code === 'KeyE') G.closeMeetScene(); return; }
    if (G.charEditor.isOpen) return;
    if (G.shopUI.isOpen) { if (e.code === 'Escape') G.shopUI.close(); return; }
    if (G.garage.isOpen) return;
    keys.add(e.code);
    if (e.code === 'KeyC') G.toggleCamera();
    if (e.code === 'KeyR') G.resetCar();
    if (e.code === 'KeyH') G.toggleHelp();
    if (e.code === 'KeyM') G.toggleMini();
    if (e.code === 'KeyG') G.routeToNearestStation();
    if (e.code === 'KeyK') G.routeHome();
    if (e.code === 'KeyX') { if (G.route) G.showToast('Ruta quitada'); G.clearRoute(); }
    if (e.code === 'KeyE') G.enter();
    if (e.code === 'KeyT') G.callTow();
  });
  addEventListener('keyup', (e) => { if (!typing(e) && GAME_KEYS.has(e.code)) { e.preventDefault(); keys.delete(e.code); } });
  addEventListener('blur', () => keys.clear());

  let padPrev = {};
  function readInput() {
    const k = (...c) => c.some((x) => keys.has(x));
    const inp = {
      throttle: k('KeyW', 'ArrowUp') ? 1 : 0,
      brake: k('KeyS', 'ArrowDown') ? 1 : 0,
      steer: (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0),
      handbrake: k('Space'),
    };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((x) => x && x.connected);
    if (p) {
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.12) inp.steer = Math.sign(ax) * (Math.abs(ax) - 0.12) / 0.88;
      const b = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
      inp.throttle = Math.max(inp.throttle, b(7));
      inp.brake = Math.max(inp.brake, b(6));
      inp.handbrake = inp.handbrake || b(0) > 0.5 || b(2) > 0.5;
      const edge = (i) => { const v = b(i) > 0.5, was = padPrev[i]; padPrev[i] = v; return v && !was; };
      if (edge(3)) G.toggleCamera();
      if (edge(9)) G.resetCar();
      if (edge(1)) G.enter();
    }
    return inp;
  }

  Object.assign(G, { keys, readInput, lastInput: { throttle: 0, brake: 0, steer: 0, handbrake: false } });
})();
