// Pantallas: tu taller (casa) y los talleres de tuneo. Solo DOM; el juego les pasa estado y acciones.
(function () {
  'use strict';

  const { CARS } = HmoCars;
  const T = HmoTuning;
  const P = HmoProgress;
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const carById = (id) => CARS.find((c) => c.id === id);
  const DRIVE_NAME = { RWD: 'trasera', FWD: 'delantera', AWD: 'integral' };

  // barras de desempeño (0..1) a partir de la especificación con tuneo
  function perf(spec) {
    const clamp = (v) => Math.max(0.04, Math.min(1, v));
    return [
      ['Potencia', clamp((spec.powerKW - 60) / 150), Math.round(spec.powerKW) + ' kW'],
      ['Agarre', clamp((spec.grip - 0.85) / 0.4), spec.grip.toFixed(2)],
      ['Frenado', clamp((spec.brake - 7.5) / 7), spec.brake.toFixed(1) + ' m/s²'],
      ['Ligereza', clamp((1350 - spec.mass) / 450), Math.round(spec.mass) + ' kg'],
    ];
  }
  function perfList(spec, prev) {
    const box = h('div', 'perf');
    const before = prev ? perf(prev) : null;
    perf(spec).forEach(([label, v, txt], i) => {
      const row = h('div', 'perf-row');
      const top = h('div', 'perf-top');
      top.append(h('span', null, label), h('b', null, txt));
      const bar = h('div', 'barra');
      const fill = h('i');
      fill.style.width = (v * 100).toFixed(0) + '%';
      bar.append(fill);
      if (before && Math.abs(before[i][1] - v) > 0.001) {
        const ghost = h('i', 'ghost');
        ghost.style.width = (Math.min(v, before[i][1]) * 100).toFixed(0) + '%';
        fill.dataset.change = v > before[i][1] ? 'up' : 'down';
        bar.append(ghost);
      }
      row.append(top, bar);
      box.append(row);
    });
    return box;
  }

  // carros para la vitrina 3D; preview = { id, paint, neon } para probar pintura o neones sin comprarlos
  function showItems(st, preview) {
    return CARS.map((c) => {
      const own = st.owned.includes(c.id);
      const tun = st.tuning[c.id];
      const parked = st.parked && st.parked.carId === c.id;
      const price = P.ECON.carPrice[c.id] || 0;
      return {
        id: c.id, spec: c, owned: own,
        paint: preview && preview.id === c.id && preview.paint ? preview.paint : tun.paint,
        neon: preview && preview.id === c.id && preview.neon ? preview.neon : T.neonOf(tun),
        rim: T.RIM_COLORS[tun.rines || 0],
        badge: !own ? `No lo tienes · ${P.money(price)}` : parked ? 'En el meet' : c.id === st.current ? 'En uso' : 'Tuyo',
        badgeType: !own ? 'bloqueado' : c.id === st.current ? 'uso' : 'tuyo',
      };
    });
  }
  // flechas del teclado para pasar de carro
  function arrowStep(e) {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return 0;
    return e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
  }

  // =================== tu taller (casa) ===================
  class Garage {
    constructor(api) {
      this.api = api;
      this.root = $('taller');
      this.sel = null;
      $('t-manejar').onclick = () => api.drive(this.sel);
      $('t-casa').onclick = () => api.chooseHome();
      $('t-bidon').onclick = () => { api.emergencyFuel(); this.render(); };
      $('t-borrar').onclick = () => { $('t-confirmar').hidden = false; };
      $('t-borrar-no').onclick = () => { $('t-confirmar').hidden = true; };
      $('t-borrar-si').onclick = () => { $('t-confirmar').hidden = true; api.wipe(); };
      $('t-recoger').onclick = () => api.collect();
      this.show = new HmoShowroom.Showroom($('t-carro'), {
        onSelect: (id) => {
          this.sel = id;
          if (this.api.state().owned.includes(id)) this.api.setCurrent(id);
          this.render();
        },
      });
      addEventListener('keydown', (e) => { const d = this.isOpen && arrowStep(e); if (d) this.show.step(d); });
    }
    get isOpen() { return !this.root.hidden; }
    open() {
      const st = this.api.state();
      this.sel = st.current;
      this.root.hidden = false;
      $('t-confirmar').hidden = true;
      this.render();
      this.show.select(this.sel, true);
      this.show.start();
    }
    close() { this.root.hidden = true; this.show.stop(); }

    // texto del carro en el meet; se actualiza solo mientras la pantalla está abierta
    renderParked(st) {
      const p = st.parked;
      if (!p) return;
      const xp = P.parkedXP(p);
      const min = Math.floor((Date.now() - p.since) / 60000);
      const capped = min >= P.ECON.farmCapHours * 60;
      $('t-meet-txt').textContent = `Tu ${carById(p.carId).name} lleva +${xp.toLocaleString('es-MX')} Street XP`;
      $('t-meet-sub').textContent = `${Math.floor(min / 60)} h ${min % 60} min estacionado · ${p.rate.toFixed(1)} XP/min` +
        (p.street ? ` · ${p.street}` : '') + (capped ? ` · llegó al tope de ${P.ECON.farmCapHours} h` : '') +
        '. Mientras esté ahí no puedes usar otro carro.';
    }

    render() {
      const st = this.api.state();
      const lv = P.levelFromXP(st.xp);
      $('t-dir').textContent = st.home ? (st.home.street || 'Tu casa') : 'Todavía no tienes casa';
      $('t-dinero').textContent = P.money(st.money);
      $('t-nivel').textContent = 'Nivel ' + lv.level;
      $('t-xpbar').style.width = (lv.frac * 100).toFixed(1) + '%';
      $('t-xp').textContent = `${lv.into} / ${lv.need} XP para el nivel ${lv.level + 1}`;
      $('t-combo').textContent = Math.round(st.stats.bestCombo).toLocaleString('es-MX') + ' pts';
      $('t-sincasa').hidden = !!st.home;
      // con un carro dejado en el meet no puedes manejar otro: primero lo recoges
      const parked = st.parked;
      $('t-meet').hidden = !parked;
      $('t-manejar').disabled = !st.home || !st.owned.includes(this.sel) || !!parked;
      $('t-manejar').textContent = parked ? 'Tu carro está en el meet' : 'Salir a manejar';
      if (parked) this.renderParked(st);
      $('t-casa').textContent = st.home ? 'Cambiar casa' : 'Elegir mi casa en el mapa';
      $('t-casa').classList.toggle('primary', !st.home);
      const needBidon = st.fuel[st.current] < 1 && st.money < P.ECON.fuelPrice * 5;
      $('t-bidon').hidden = !needBidon;

      const spec = carById(this.sel);
      const tun = st.tuning[this.sel];
      const eff = T.apply(spec, tun);
      $('t-nombre').textContent = spec.name;
      $('t-tag').textContent = `${spec.tag} · tracción ${DRIVE_NAME[eff.drive]} · tanque ${Math.round(st.fuel[this.sel])}/${spec.tankL} L`;
      this.show.setItems(showItems(st));
      this.show.select(this.sel);
      $('t-perf').replaceChildren(perfList(eff));
      const parts = $('t-piezas');
      parts.replaceChildren(...T.PART_KEYS.map((k) => {
        const li = h('li');
        li.append(h('span', null, T.PARTS[k].label), h('b', null, tun[k] ? T.PARTS[k].opts[tun[k] - 1].name : 'De fábrica'));
        return li;
      }), (() => {
        const n = T.neonOf(tun), li = h('li');
        const txt = n.mode === 'ninguno' ? 'No tiene' : n.mode === 'estatico' ? 'Estáticas'
          : `Dinámicas · ${T.NEON.patterns[n.pattern].name}`;
        li.append(h('span', null, 'Neón'), h('b', null, txt));
        return li;
      })());

      // comprar el carro elegido si no es tuyo
      const buy = $('t-comprar');
      const owned = st.owned.includes(this.sel);
      buy.hidden = owned;
      if (!owned) {
        const price = P.ECON.carPrice[this.sel];
        buy.textContent = `Comprar ${spec.name} · ${P.money(price)}`;
        buy.disabled = st.money < price;
        buy.onclick = () => { this.api.buyCar(this.sel); buy.blur(); this.render(); };
      }
    }
  }

  // =================== taller de tuneo ===================
  const TABS = [['motor', 'Motor'], ['llantas', 'Llantas'], ['suspension', 'Suspensión'], ['frenos', 'Frenos'], ['rines', 'Rines'], ['traccion', 'Tracción'], ['pintura', 'Pintura'], ['neon', 'Neón']];

  class Shop {
    constructor(api) {
      this.api = api;
      this.root = $('tienda');
      this.shop = null;
      this.tab = 'motor';
      this.paint = null; // pintura en prueba
      this.neon = null;  // neones en prueba
      $('s-salir').onclick = () => this.close();
      this.sel = null; // carro que estás tuneando (puede ser cualquiera de los tuyos)
      this.show = new HmoShowroom.Showroom($('s-vista'), {
        onSelect: (id) => { this.sel = id; this.paint = null; this.neon = null; this.render(); },
      });
      addEventListener('keydown', (e) => { const d = this.isOpen && arrowStep(e); if (d) this.show.step(d); });
    }
    get isOpen() { return !this.root.hidden; }
    open(shop) {
      this.shop = shop; this.tab = 'motor'; this.paint = null; this.neon = null;
      this.sel = this.api.state().current;
      this.root.hidden = false;
      this.render();
      this.show.select(this.sel, true);
      this.show.start();
    }
    close() { this.root.hidden = true; this.show.stop(); this.api.closed(); }

    render() {
      const st = this.api.state(), shop = this.shop, carId = this.sel;
      const spec = carById(carId), tun = st.tuning[carId];
      const owned = st.owned.includes(carId), parked = !!st.parked && st.parked.carId === carId;
      const off = T.shopOffers(shop);
      const priceTag = shop.mult < 0.92 ? 'precios bajos' : shop.mult > 1.12 ? 'precios altos' : 'precios normales';
      $('s-tipo').textContent = (shop.hidden ? 'Taller escondido · ' : '') + `Nivel ${shop.level} · ${priceTag}`;
      $('s-nombre').textContent = shop.name;
      $('s-dinero').textContent = P.money(st.money);
      $('s-carro').textContent = spec.name + (carId === st.current ? ' (el que traes)' : owned ? ' (te lo llevan a tu casa)' : '');

      this.show.setItems(showItems(st, { id: carId, paint: this.paint, neon: this.neon }));
      this.show.select(carId);

      const tabs = $('s-tabs');
      tabs.replaceChildren(...TABS.map(([k, label]) => {
        const b = h('button', null, label);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(this.tab === k));
        b.onclick = () => { this.tab = k; this.paint = null; this.neon = null; this.render(); };
        return b;
      }));

      const box = $('s-opciones');
      const eff = T.apply(spec, tun);
      tabs.hidden = !owned || parked;
      if (!owned || parked) {
        const msg = h('div', 'opcion');
        const info = h('div', 'opcion-info');
        info.append(
          h('b', null, parked ? `Tu ${spec.name} está en el meet` : `Todavía no tienes el ${spec.name}`),
          h('span', null, parked ? 'Recógelo para poder tunearlo.' : `Cuesta ${P.money(P.ECON.carPrice[carId])}. Se compra en tu taller (casa). Desliza para elegir uno de tus carros.`));
        msg.append(info);
        box.replaceChildren(msg);
        $('s-perf').replaceChildren(perfList(eff));
        $('s-nota').textContent = '';
        return;
      }
      if (T.PARTS[this.tab]) {
        const cat = T.PARTS[this.tab];
        let preview = null;
        box.replaceChildren(...cat.opts.map((o, i) => {
          const tier = i + 1;
          const price = T.price(o.price, shop, carId);
          const installed = tun[this.tab] === tier;
          const avail = tier <= off.maxTier;
          const row = h('div', 'opcion');
          const info = h('div', 'opcion-info');
          info.append(h('b', null, o.name), h('span', null, o.desc));
          const btn = h('button', installed ? null : 'primary', installed ? 'Instalado' : !avail ? `Nivel ${tier} o más` : P.money(price));
          btn.type = 'button';
          btn.disabled = installed || !avail || st.money < price;
          if (avail && !installed && st.money < price) btn.title = 'Te falta dinero';
          btn.onclick = () => { this.api.buyPart(carId, this.tab, tier, price); this.render(); };
          row.onmouseenter = () => { if (avail && !installed) { preview = T.apply(spec, Object.assign({}, tun, { [this.tab]: tier })); $('s-perf').replaceChildren(perfList(preview, eff)); } };
          row.onmouseleave = () => { $('s-perf').replaceChildren(perfList(eff)); };
          row.append(info, btn);
          return row;
        }));
      } else if (this.tab === 'traccion') {
        const cur = eff.drive;
        box.replaceChildren(...Object.entries(T.DRIVES).map(([k, d]) => {
          const price = T.price(d.price, shop, carId);
          const row = h('div', 'opcion');
          const info = h('div', 'opcion-info');
          info.append(h('b', null, 'Tracción ' + d.name.toLowerCase()), h('span', null, d.desc));
          const btn = h('button', cur === k ? null : 'primary', cur === k ? 'Instalada' : !off.drive ? 'Nivel 2 o más' : P.money(price));
          btn.type = 'button';
          btn.disabled = cur === k || !off.drive || st.money < price;
          btn.onclick = () => { this.api.buyDrive(carId, k, price); this.render(); };
          row.append(info, btn);
          return row;
        }));
      } else if (this.tab === 'neon') {
        this.renderNeon(box, st, tun, carId);
      } else {
        this.renderPaint(box, st, spec, tun, shop, off, carId);
      }
      $('s-perf').replaceChildren(perfList(eff));
      $('s-nota').textContent = shop.hidden
        ? 'Taller de calidad a buen precio. Se va a cambiar de lugar dentro de un rato.'
        : off.maxTier < 3 ? `Este taller llega hasta nivel ${off.maxTier}. Para lo mejor busca un taller de nivel 3 o uno escondido.` : '';
    }

    renderPaint(box, st, spec, tun, shop, off, carId) {
      const p = this.paint || Object.assign({}, tun.paint);
      this.paint = p;
      const wrap = h('div', 'pintura');
      // colores
      wrap.append(h('p', 'pint-label', 'Color'));
      const sw = h('div', 'swatches');
      for (const c of T.PAINT_COLORS) {
        const b = h('button', 'swatch');
        b.type = 'button';
        b.style.background = c;
        b.setAttribute('aria-label', 'Color ' + c);
        b.setAttribute('aria-pressed', String(p.color === c));
        b.onclick = () => { p.color = c; this.render(); };
        sw.append(b);
      }
      wrap.append(sw);
      // acabado
      wrap.append(h('p', 'pint-label', 'Acabado'));
      const fin = h('div', 'row');
      for (const [k, f] of Object.entries(T.FINISHES)) {
        const ok = off.finishes.includes(k);
        const b = h('button', null, f.name + (ok ? '' : ' · nivel ' + (k === 'perlado' ? 3 : 2)));
        b.type = 'button';
        b.disabled = !ok;
        b.setAttribute('aria-pressed', String(p.finish === k));
        b.onclick = () => { p.finish = k; this.render(); };
        fin.append(b);
      }
      wrap.append(fin);
      // wrap
      wrap.append(h('p', 'pint-label', 'Wrap'));
      const wr = h('div', 'row');
      for (const [k, w] of Object.entries(T.WRAPS)) {
        const ok = off.wraps.includes(k);
        const b = h('button', null, w.name + (ok ? '' : ' · nivel ' + (['franjas', 'dostonos'].includes(k) ? 2 : 3)));
        b.type = 'button';
        b.disabled = !ok;
        b.setAttribute('aria-pressed', String(p.wrap === k));
        b.onclick = () => { p.wrap = k; this.render(); };
        wr.append(b);
      }
      wrap.append(wr);
      // precio y botón
      const same = p.color === tun.paint.color && p.finish === tun.paint.finish && p.wrap === tun.paint.wrap;
      const price = T.price(T.FINISHES[p.finish].price + T.WRAPS[p.wrap].price, shop, carId);
      const act = h('div', 'row pint-act');
      const buy = h('button', 'primary', same ? 'Es tu pintura actual' : `Pintar · ${P.money(price)}`);
      buy.type = 'button';
      buy.disabled = same || st.money < price;
      buy.onclick = () => { this.api.buyPaint(carId, Object.assign({}, p), price); this.paint = null; this.render(); };
      const reset = h('button', null, 'Deshacer cambios');
      reset.type = 'button';
      reset.disabled = same;
      reset.onclick = () => { this.paint = null; this.render(); };
      act.append(buy, reset);
      wrap.append(act);
      box.replaceChildren(wrap);
    }
  }

  // ---------- neones ----------
  // precio de pasar de lo instalado (cur) a lo elegido (n): el kit si cambia de tipo, y el patrón si no lo tenías
  function neonPrice(cur, n) {
    let p = 0;
    if (n.mode !== 'ninguno' && n.mode !== cur.mode) p += T.NEON.kits[n.mode].price;
    if (n.mode === 'dinamico' && !cur.patterns.includes(n.pattern)) p += T.NEON.patternPrice;
    return p;
  }
  const sameNeon = (a, b) => a.mode === b.mode && (a.mode === 'ninguno' ||
    (a.colors.join() === b.colors.join() && (a.mode !== 'dinamico' || a.pattern === b.pattern)));

  Shop.prototype.renderNeon = function (box, st, tun, carId) {
    const cur = T.neonOf(tun);
    const n = this.neon || JSON.parse(JSON.stringify(cur));
    this.neon = n;
    const N = T.NEON;
    const wrap = h('div', 'pintura');

    // tipo
    wrap.append(h('p', 'pint-label', 'Luces debajo del carro'));
    const modes = h('div', 'row');
    for (const [k, label] of [['ninguno', 'Sin luces'], ['estatico', 'Estáticas'], ['dinamico', 'Dinámicas']]) {
      const kit = N.kits[k];
      const b = h('button', null, label + (kit && cur.mode !== k ? ` · ${P.money(kit.price)}` : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(n.mode === k));
      b.onclick = () => {
        n.mode = k;
        if (k === 'estatico') n.colors = n.colors.slice(0, 1);
        this.render();
      };
      modes.append(b);
    }
    wrap.append(modes);
    if (n.mode !== 'ninguno') wrap.append(h('p', 'pant-sub', N.kits[n.mode].desc + '. Cambiar de color después es gratis.'));

    if (n.mode !== 'ninguno') {
      // colores: estáticas 1; dinámicas de 1 a 3, en orden
      const dyn = n.mode === 'dinamico';
      wrap.append(h('p', 'pint-label', dyn ? `Colores (de 1 a ${N.maxColors}, en orden)` : 'Color'));
      const sw = h('div', 'swatches');
      for (const c of N.colors) {
        const idx = n.colors.indexOf(c);
        const b = h('button', 'swatch neon', dyn && idx >= 0 ? String(idx + 1) : '');
        b.type = 'button';
        b.style.background = c;
        b.style.setProperty('--glow', c);
        b.setAttribute('aria-label', 'Color ' + c);
        b.setAttribute('aria-pressed', String(idx >= 0));
        b.onclick = () => {
          if (!dyn) n.colors = [c];
          else if (idx >= 0) { if (n.colors.length > 1) n.colors.splice(idx, 1); }
          else if (n.colors.length < N.maxColors) n.colors.push(c);
          else n.colors[n.colors.length - 1] = c; // ya hay 3: cambia el último
          this.render();
        };
        sw.append(b);
      }
      wrap.append(sw);

      // patrones (solo dinámicas): se compran una vez por carro
      if (dyn) {
        wrap.append(h('p', 'pint-label', `Patrón (${P.money(N.patternPrice)} cada uno, se quedan en tu carro)`));
        const list = h('div', 'opciones-lista');
        for (const [k, pat] of Object.entries(N.patterns)) {
          const own = cur.patterns.includes(k);
          const row = h('div', 'opcion');
          const info = h('div', 'opcion-info');
          info.append(h('b', null, pat.name), h('span', null, pat.desc));
          const b = h('button', null, n.pattern === k ? 'Elegido' : own ? 'Tuyo · elegir' : `Probar · ${P.money(N.patternPrice)}`);
          b.type = 'button';
          b.setAttribute('aria-pressed', String(n.pattern === k));
          b.onclick = () => { n.pattern = k; this.render(); };
          row.append(info, b);
          list.append(row);
        }
        wrap.append(list);
      }
    }

    // precio y botones
    const same = sameNeon(n, cur);
    const price = neonPrice(cur, n);
    const act = h('div', 'row pint-act');
    const label = same ? (cur.mode === 'ninguno' ? 'Elige un tipo de luces' : 'Así las tienes')
      : n.mode === 'ninguno' ? 'Quitar luces' : price ? `Instalar · ${P.money(price)}` : 'Guardar cambios (gratis)';
    const buy = h('button', 'primary', label);
    buy.type = 'button';
    buy.disabled = same || st.money < price;
    if (!same && st.money < price) buy.title = 'Te falta dinero';
    buy.onclick = () => {
      const out = { mode: n.mode, colors: n.colors.slice(), pattern: n.pattern, patterns: cur.patterns.slice() };
      if (n.mode === 'dinamico' && !out.patterns.includes(n.pattern)) out.patterns.push(n.pattern);
      this.api.buyNeon(carId, out, price);
      this.neon = null;
      this.render();
    };
    const reset = h('button', null, 'Deshacer cambios');
    reset.type = 'button';
    reset.disabled = same;
    reset.onclick = () => { this.neon = null; this.render(); };
    act.append(buy, reset);
    wrap.append(act);
    box.replaceChildren(wrap);
  };

  window.HmoMenus = { Garage, Shop };
})();
