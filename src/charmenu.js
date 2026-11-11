// Editor de personaje: así te ven en los meets. Gratis y se puede cambiar cuando quieras desde tu taller.
(function () {
  'use strict';

  const C = HmoCharacter, O = C.OPTIONS;
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  class Editor {
    // api: { get() → look | null, save(look), done(first) }
    constructor(api) {
      this.api = api;
      this.root = $('personaje');
      this.look = null;
      this.first = false;
      this.cv = document.createElement('canvas');
      $('p-vista').replaceChildren(this.cv);
      this.r = new HmoGL.Renderer(this.cv);
      this.mesh = null; this.meshKey = '';
      this.yaw = 0.5; this.spin = 0.35;
      HmoGL.dragRotate(this.cv, (dx) => { this.yaw += dx * 0.01; this.spin = 0; });
      this.loop = (t) => this.frame(t);
      $('p-azar').onclick = (e) => {
        e.currentTarget.blur();
        const name = this.look.name;
        this.look = Object.assign(C.randomLook(Math.random), { name });
        this.render();
      };
      $('p-listo').onclick = (e) => { e.currentTarget.blur(); this.finish(); };
    }
    get isOpen() { return !this.root.hidden; }

    open(first) {
      this.first = !!first;
      this.look = C.lookOf(this.api.get());
      this.root.hidden = false;
      $('p-titulo').textContent = this.first ? 'Crea tu personaje' : 'Tu personaje';
      $('p-listo').textContent = this.first ? 'Listo, vamos al taller' : 'Guardar';
      this.render();
      this.running = true;
      requestAnimationFrame(this.loop);
    }
    finish() {
      this.look.name = ($('p-nombre').value || '').trim().slice(0, 16);
      this.api.save(Object.assign({}, this.look));
      this.root.hidden = true;
      this.running = false;
      this.api.done(this.first);
    }

    // ---------- opciones ----------
    render() {
      const L = this.look, box = $('p-opciones');
      const group = (label, ...kids) => { const g = h('div', 'p-grupo'); g.append(h('p', 'pint-label', label), ...kids); return g; };
      const choices = (list, key) => {
        const row = h('div', 'row');
        for (const [id, name] of list) {
          const b = h('button', null, name);
          b.type = 'button';
          b.setAttribute('aria-pressed', String(L[key] === id));
          b.onclick = () => { L[key] = id; this.render(); };
          row.append(b);
        }
        return row;
      };
      const colors = (list, key) => {
        const row = h('div', 'swatches');
        for (const c of list) {
          const b = h('button', 'swatch');
          b.type = 'button';
          b.style.background = c;
          b.setAttribute('aria-label', 'Color ' + c);
          b.setAttribute('aria-pressed', String(L[key] === c));
          b.onclick = () => { L[key] = c; this.render(); };
          row.append(b);
        }
        return row;
      };
      const toggle = (key, label) => {
        const b = h('button', null, label);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(!!L[key]));
        b.onclick = () => { L[key] = !L[key]; this.render(); };
        return b;
      };
      // el apodo se escribe en un campo que no se rehace (para no perder el cursor)
      const name = $('p-nombre');
      if (document.activeElement !== name) name.value = L.name || '';
      name.oninput = () => { L.name = name.value.slice(0, 16); };

      const acc = h('div', 'row'); acc.append(toggle('glasses', 'Lentes oscuros'), toggle('chain', 'Cadena'));
      box.replaceChildren(
        group('Piel', colors(O.skin, 'skin')),
        group('Complexión', choices(O.build, 'build')),
        group('Vello facial', choices(O.facial, 'facial')),
        group('Pelo', choices(O.hair, 'hair'), colors(O.hairColors, 'hairColor')),
        group('Arriba', choices(O.top, 'top'), colors(O.clothes, 'topColor')),
        group('Abajo', choices(O.bottom, 'bottom'), colors(O.clothes, 'bottomColor')),
        group('Tenis', colors(O.shoes, 'shoes')),
        group('Gorra', choices(O.cap, 'cap'), L.cap !== 'nada' ? colors(O.clothes, 'capColor') : h('span')),
        group('Accesorios', acc),
      );
    }

    // ---------- vista 3D ----------
    frame(t) {
      if (!this.running) return;
      requestAnimationFrame(this.loop);
      const r = this.r;
      if (!r.ok) return;
      const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
      this.last = t;
      this.yaw += dt * this.spin;
      const key = JSON.stringify(this.look);
      if (key !== this.meshKey) {
        r.free(this.mesh);
        this.mesh = r.upload(C.build(this.look, 'parado'));
        this.meshKey = key;
      }
      const narrow = (this.cv.clientWidth || 1) < (this.cv.clientHeight || 1);
      r.begin([0, 1.25, narrow ? 4.4 : 3.4], [0, 0.98, 0], 0.62, 40);
      const M = HmoGL.model(0, 0, 0, this.yaw);
      r.shadows([{ M, sx: 0.42, sz: 0.36, a: 0.55 }]);
      r.meshes([{ h: this.mesh, M }], 1);
    }
  }

  window.HmoCharMenu = { Editor };
})();
