// Registro de carros. Cada carro vive en su carpeta (src/cars/<nombre>/car.js) y se da de alta aquí con
// HmoCarRegistry.add({ spec, model }). El orden de alta es el orden de la vitrina.
//   spec:   ficha del carro (física, tuneo y dibujo visto desde arriba). La lee todo el juego.
//   model:  silueta lateral para el modelo 3D genérico de cubitos (src/cars/model3d.js).
//   voxels: opcional. Función que regresa la rejilla de un modelo hecho a mano cubito por cubito
//           (ver src/cars/ba-tsuru/voxels.js). Si existe, se usa en lugar de model.
//
// Para agregar un carro: crea su carpeta con car.js, agrégalo en index.html después de este archivo y
// antes de sprites.js, y dale sus números de economía: carPrice y carXPFactor en ECON (src/gameplay/progress.js)
// y CAR_FACTOR (precio de piezas) en src/cars/tuning.js.
(function () {
  'use strict';

  const list = [];

  function add(def) {
    if (!def || !def.spec || !def.spec.id) throw new Error('HmoCarRegistry.add: falta spec.id');
    if (get(def.spec.id)) throw new Error(`HmoCarRegistry.add: el carro '${def.spec.id}' ya está registrado`);
    list.push(def);
    return def;
  }

  function get(id) { return list.find((d) => d.spec.id === id) || null; }

  window.HmoCarRegistry = { list, add, get };
})();
