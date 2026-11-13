// Ba-tsuru (id 'pitic'): sedán compacto de los 90, tipo Tsuru. Es el carro con el que empiezas.
// Todo lo de este carro vive en esta carpeta. El id no se cambia: con él se guarda el progreso del jugador.
(function () {
  'use strict';

  HmoCarRegistry.add({
    // Ficha: la física y el tuneo leen estos números (metros, kg, kW, km/h; grip = fricción de la llanta).
    // body: cómo se dibuja visto desde arriba (src/cars/sprites.js).
    spec: {
      id: 'pitic', name: 'Ba-tsuru', tag: 'Sedán compacto · 90s',
      color: '#ecebe4', trim: '#b8b5ab',
      length: 4.25, width: 1.66, wheelbase: 2.43, frontWeight: 0.56, cgHeight: 0.52,
      mass: 980, powerKW: 85, topKmh: 165, tankL: 50,
      grip: 0.92, tireB: 10, steerMax: 0.64, brake: 8.5, handbrakeGrip: 0.7,
      drive: 'RWD',
      body: { r: 0.12, hood: 1.05, trunk: 0.85, cabinInset: 0.2, glass: '#27303d', style: 'boxy' },
    },
    // Ba-tsuru: sedán de tres volúmenes muy cuadrado, cofre plano, cajuela alta y recta, defensas grises
    // Silueta lateral para el modelo 3D de cubitos; el formato está explicado en src/cars/model3d.js.
    // Respaldo: el modelo que se ve es el hecho a mano en voxels.js. Esta silueta se usa si ese archivo no está
    // cargado, y colors() lee de aquí el material de las defensas.
    model: {
      body: [[0.06, 0.24], [0.0, 0.32], [0.0, 0.6], [0.03, 0.64], [0.04, 0.92], [0.1, 0.96], [0.86, 0.97], [3.18, 0.92],
        [4.16, 0.81], [4.24, 0.77], [4.25, 0.36], [4.21, 0.26], [3.95, 0.22], [0.3, 0.22]],
      gh: { rear: [0.86, 0.97], roofR: [1.3, 1.36], roofF: [2.6, 1.38], front: [3.18, 0.92], crown: 0.012, roofRound: 0.03,
        hwBelt: 0.76, hwRoof: 0.63, bPillar: 1.98, bW: 0.09, bBlack: true, aThick: 0.07, cThick: 0.2 },
      corner: 0.1, shoulder: 0.04, bottomR: 0.05,
      wheelR: 0.29, tireW: 0.18, spokes: 4,
      bumper: { mat: 'trim', front: 0.55, rear: [0.3, 0.63] },
      front: [
        { m: 'head', y: [0.6, 0.74], z: [0.34, 0.79] },
        { m: 'grille', y: [0.59, 0.74], z: [0, 0.31], bars: true },
        { m: 'signal', y: [0.48, 0.54], z: [0.5, 0.76] },
        { m: 'plate', y: [0.33, 0.46], z: [0, 0.25] },
      ],
      rear: [
        { m: 'garnish', y: [0.67, 0.86], z: [0, 0.42] },
        { m: 'tail', y: [0.67, 0.86], z: [0.42, 0.8] },
        { m: 'garnish', y: [0.755, 0.785], z: [0.42, 0.8] },
        { m: 'plate', y: [0.69, 0.83], z: [0, 0.25] },
      ],
      molding: [0.5, 0.56], seams: [2.98, 1.98, 1.25], handles: [2.08, 1.36], handleY: 0.84,
      mirror: { u: [3.0, 3.12], y: [0.93, 1.03] },
    },
  });
})();
