# Drift Hermosillo

Juego de drift 2D en vista aérea sobre el mapa real del centro de Hermosillo y el Cerro de la Campana. Siempre es de noche. Ganas dinero derrapando, tuneas tu carro y juntas Street XP en los meets.

## Jugar

Abre `index.html` en el navegador. No necesita instalar nada, ni build, ni servidor.

| Tecla | Acción |
|---|---|
| Flechas / WASD | Acelerar, frenar y dar vuelta |
| Espacio | Freno de mano |
| E | Entrar a tu taller, a un taller de tuneo o a la escena del meet |
| M | Mapa completo (elegir destino) |
| K / G / X | Ruta a casa / a la gasolinera más cercana / quitar la ruta |
| C | Cambiar de cámara |
| R | Acomodar el carro |
| T | Llamar a la grúa |
| H | Ayuda |

También se puede jugar con control.

## Cómo está organizado

```
index.html          el juego
src/
  world/            el mapa (generado) y lo que vive en él: tiles, rutas, noche, calles
  engine/           motor 3D propio de cubitos (WebGL, sin librerías)
  cars/             los carros
    registry.js     aquí se dan de alta
    ba-tsuru/       un carro por carpeta: car.js (ficha y forma 3D) y, si tiene, su modelo hecho a mano
    mezquite-sr/
    hondiablo-si/
    sprites.js      dibujo visto desde arriba
    model3d.js      modelo 3D de cubitos a partir de la silueta
    physics.js      física de manejo
    tuning.js       piezas, pintura, neones y talleres
  characters/       personajes de cubitos
  gameplay/         partida guardada, economía y puntos de drift
  ui/               pantallas: tu taller, tuneo, mapa, editor de personaje y escena del meet
  game/             el juego en marcha; main.js es el bucle principal
tools/              build_map.py (OpenStreetMap → mapa) y mapa.html (visor del mapa)
data/raw/           datos de OpenStreetMap que usa build_map.py
docs/               ideas y notas
```

Todo son scripts normales (`<script src>`, sin módulos ES) para que funcione con `file://`. Cada archivo publica un global `window.Hmo*`, y el orden de los `<script>` en `index.html` importa.

### Agregar un carro

1. Copia la carpeta de un carro en `src/cars/` (por ejemplo `mezquite-sr/`) y cámbiale el `id`, el nombre y los números de `spec`. La forma 3D sale de `model` (la silueta lateral; el formato está explicado en `src/cars/model3d.js`).
2. Agrega su `car.js` en `index.html`, después de `src/cars/registry.js` y antes de `src/cars/sprites.js`.
3. Dale precio y factores en `ECON` (`src/gameplay/progress.js`: `carPrice`, `carXPFactor`) y en `CAR_FACTOR` (`src/cars/tuning.js`).

No uses nombres ni diseños de marcas reales.

### Regenerar el mapa

```
python3 -I tools/build_map.py data/raw/centro_campana.json src/world/map.js [preview.png]
```

Requiere Python 3 con numpy y Pillow.

## Créditos

Datos del mapa © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), bajo la licencia ODbL.
