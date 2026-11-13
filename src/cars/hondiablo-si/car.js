// Hondiablo Si (id 'choya'): compacto deportivo, tipo Civic.
// Todo lo de este carro vive en esta carpeta. El id no se cambia: con él se guarda el progreso del jugador.
(function () {
  'use strict';

  HmoCarRegistry.add({
    // Ficha: la física y el tuneo leen estos números (metros, kg, kW, km/h; grip = fricción de la llanta).
    // body: cómo se dibuja visto desde arriba (src/cars/sprites.js).
    spec: {
      id: 'choya', name: 'Hondiablo Si', tag: 'Compacto deportivo',
      color: '#e4572e', trim: '#2a2d36',
      length: 4.5, width: 1.8, wheelbase: 2.67, frontWeight: 0.58, cgHeight: 0.48,
      mass: 1210, powerKW: 140, topKmh: 205, tankL: 47,
      grip: 1.04, tireB: 9.5, steerMax: 0.6, brake: 10.5, handbrakeGrip: 0.66,
      drive: 'RWD',
      body: { r: 0.26, hood: 1.25, trunk: 0.7, cabinInset: 0.2, glass: '#1b2029', style: 'sport' },
    },
    // Hondiablo Si: sedán deportivo bajo, parabrisas muy inclinado, cajuela corta, alerón, faldones oscuros
    // Silueta lateral para el modelo 3D de cubitos; el formato está explicado en src/cars/model3d.js.
    model: {
      body: [[0.08, 0.24], [0.0, 0.34], [0.0, 0.64], [0.03, 0.74], [0.04, 0.97], [0.1, 1.01], [0.74, 1.02], [3.2, 0.92],
        [4.1, 0.79], [4.38, 0.68], [4.49, 0.56], [4.5, 0.34], [4.42, 0.22], [4.0, 0.18], [0.4, 0.18]],
      gh: { rear: [0.74, 1.02], roofR: [1.56, 1.39], roofF: [2.42, 1.41], front: [3.2, 0.92], crown: 0.03, roofRound: 0.06,
        hwBelt: 0.79, hwRoof: 0.62, bPillar: 2.12, bW: 0.09, bBlack: true, aThick: 0.08, cThick: 0.12 },
      corner: 0.26, shoulder: 0.09, bottomR: 0.07,
      wheelR: 0.32, tireW: 0.21, spokes: 5,
      bumper: { mat: 'paint', front: 0.62, rear: [0.3, 0.66] },
      front: [
        { m: 'head', y: [0.6, 0.71], z: [0.42, 0.9] },
        { m: 'grille', y: [0.5, 0.6], z: [0, 0.4], mesh: true },
        { m: 'grille', y: [0.25, 0.41], z: [0, 0.62], mesh: true },
        { m: 'plate', y: [0.42, 0.5], z: [0, 0.25] },
      ],
      rear: [
        { m: 'tail', y: [0.74, 0.9], z: [0.42, 0.9] },
        { m: 'chrome', y: [0.85, 0.88], z: [0, 0.36] },
        { m: 'plate', y: [0.68, 0.83], z: [0, 0.25] },
        { m: 'skirt', y: [0, 0.34], z: [0, 0.75] },
      ],
      skirt: 0.27, seams: [3.04, 2.12, 1.3], handles: [2.22, 1.42], handleY: 0.86,
      mirror: { u: [3.05, 3.18], y: [0.93, 1.04] },
      spoiler: { u: [0.04, 0.3], y: [1.1, 1.15], zMax: 0.8, postU: [0.12, 0.2], postZ: 0.55 },
    },
  });
})();
