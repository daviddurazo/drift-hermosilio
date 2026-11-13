// Mezquite SR (id 'mezquite'): sedán mediano, tipo Sentra.
// Todo lo de este carro vive en esta carpeta. El id no se cambia: con él se guarda el progreso del jugador.
(function () {
  'use strict';

  HmoCarRegistry.add({
    // Ficha: la física y el tuneo leen estos números (metros, kg, kW, km/h; grip = fricción de la llanta).
    // body: cómo se dibuja visto desde arriba (src/cars/sprites.js).
    spec: {
      id: 'mezquite', name: 'Mezquite SR', tag: 'Sedán mediano',
      color: '#8fa9c2', trim: '#6f879f',
      length: 4.6, width: 1.76, wheelbase: 2.7, frontWeight: 0.6, cgHeight: 0.55,
      mass: 1250, powerKW: 110, topKmh: 185, tankL: 52,
      grip: 1.0, tireB: 8.5, steerMax: 0.56, brake: 9.5, handbrakeGrip: 0.75,
      drive: 'RWD',
      body: { r: 0.32, hood: 1.15, trunk: 0.95, cabinInset: 0.22, glass: '#1f2733', style: 'round' },
    },
    // Mezquite SR: sedán mediano redondeado, cajuela alta, faros que dan vuelta a la esquina
    // Silueta lateral para el modelo 3D de cubitos; el formato está explicado en src/cars/model3d.js.
    model: {
      body: [[0.08, 0.26], [0.0, 0.36], [0.0, 0.64], [0.03, 0.72], [0.05, 0.96], [0.14, 1.01], [0.94, 1.02], [3.45, 0.95],
        [4.25, 0.83], [4.48, 0.76], [4.58, 0.66], [4.6, 0.4], [4.54, 0.28], [4.2, 0.22], [0.4, 0.22]],
      gh: { rear: [0.94, 1.02], roofR: [1.52, 1.4], roofF: [2.7, 1.43], front: [3.45, 0.95], crown: 0.03, roofRound: 0.07,
        hwBelt: 0.76, hwRoof: 0.62, bPillar: 2.22, bW: 0.09, bBlack: true, aThick: 0.07, cThick: 0.16 },
      corner: 0.3, shoulder: 0.1, bottomR: 0.08,
      wheelR: 0.31, tireW: 0.19, spokes: 5,
      bumper: { mat: 'paint', front: 0.57, rear: [0.3, 0.66] },
      front: [
        { m: 'head', y: [0.62, 0.78], z: [0.38, 0.9] },
        { m: 'grille', y: [0.6, 0.75], z: [0, 0.34], bars: true, bar: 'chrome' },
        { m: 'chrome', y: [0.73, 0.76], z: [0, 0.36] },
        { m: 'grille', y: [0.3, 0.42], z: [0, 0.46] },
        { m: 'plate', y: [0.43, 0.55], z: [0, 0.25] },
      ],
      rear: [
        { m: 'tail', y: [0.72, 0.92], z: [0.44, 0.9] },
        { m: 'chrome', y: [0.86, 0.9], z: [0, 0.44] },
        { m: 'plate', y: [0.7, 0.84], z: [0, 0.25] },
      ],
      molding: [0.48, 0.53], seams: [3.28, 2.22, 1.38], handles: [2.34, 1.5], handleY: 0.88,
      mirror: { u: [3.28, 3.42], y: [0.97, 1.09] },
    },
  });
})();
