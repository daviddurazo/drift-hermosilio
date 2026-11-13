// Puntos de drift: suman por ángulo, velocidad y duración. Si vuelves a derrapar antes de que se acabe
// la ventana de encadenar, el combo sigue y sube el multiplicador. Chocar en pleno combo lo pierde.
(function () {
  'use strict';

  const CFG = {
    minKmh: 25,        // más lento no cuenta (evita donas paradas)
    minAngle: 12,      // grados
    maxAngle: 75,      // más que esto ya es trompo
    grace: 1.8,        // segundos para encadenar el siguiente derrape
    crash: 2.5,        // impacto (m/s) que tira el combo
    maxChain: 10,
  };

  class DriftScore {
    constructor() { this.reset(); }

    reset() {
      this.state = 'idle';   // idle | drifting | grace
      this.combo = 0;        // puntos del combo actual
      this.chain = 0;        // derrapes encadenados en este combo
      this.time = 0;         // duración del derrape actual
      this.graceT = 0;
      this.rate = 0;         // puntos por segundo ahora mismo (para el HUD)
    }

    get chainMult() { return 1 + (Math.min(this.chain, CFG.maxChain) - 1) * 0.25; }
    get durMult() { return 1 + Math.min(this.time, 6) / 4; }

    // tel: telemetría del carro; impact: golpe de este paso. Devuelve un evento o null.
    update(dt, tel, impact) {
      const ang = Math.abs(tel.beta) * 180 / Math.PI;
      const kmh = tel.speed * 3.6;
      const active = kmh > CFG.minKmh && ang > CFG.minAngle && ang < CFG.maxAngle && tel.u > 0;

      if (impact > CFG.crash && this.state !== 'idle' && this.combo > 0) {
        const lost = this.combo;
        this.reset();
        return { type: 'fail', points: lost };
      }

      if (active) {
        if (this.state === 'idle') { this.chain = 1; this.combo = 0; }
        else if (this.state === 'grace') this.chain = Math.min(CFG.maxChain, this.chain + 1);
        if (this.state !== 'drifting') this.time = 0;
        this.state = 'drifting';
        this.time += dt;
        // ángulo y velocidad pesan igual; la duración y la cadena multiplican
        this.rate = (ang / 10) * (kmh / 30) * 12 * this.durMult * this.chainMult;
        this.combo += this.rate * dt;
        return null;
      }

      this.rate = 0;
      if (this.state === 'drifting') {
        this.state = 'grace';
        this.graceT = CFG.grace;
        return null;
      }
      if (this.state === 'grace') {
        this.graceT -= dt;
        if (this.graceT <= 0) {
          const ev = { type: 'bank', points: this.combo, chain: this.chain };
          this.reset();
          return ev.points >= 1 ? ev : null;
        }
      }
      return null;
    }
  }

  window.HmoDrift = { DriftScore, CFG };
})();
