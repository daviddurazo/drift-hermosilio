# Drift Hermosillo

Juego de drift 2D en vista aérea sobre el mapa real del centro de Hermosillo y el Cerro de la Campana. Estilo cuadriculado (tiles planos, sin texturas pesadas), siempre de noche. Todo en español (México): interfaz, comentarios y mensajes.

## Cómo correrlo

- Abrir `index.html` en el navegador (`open index.html`). No hay build ni servidor: funciona con `file://`.
- `mapa.html` es un visor del mapa (sin juego), útil para revisar la conversión.
- Scripts clásicos (`<script src>`), **no módulos ES** (con `file://` se bloquean). Cada archivo es una IIFE que publica un global `window.Hmo*`. El orden de los `<script>` en `index.html` importa: `src/game/core.js` va primero de los de `src/game/` y `src/game.js` al final. Dentro de `src/game/` el orden solo importa para lo que corre al cargar (lo que se llama después pasa por G).
- Git: rama `main`, remoto `origin` en GitHub. El usuario hace los commits y los push; solo darle los comandos, salvo que pida lo contrario.

## Regenerar el mapa

```
python3 -I tools/build_map.py data/raw/centro_campana.json src/map.js [preview.png]
```

- Lee `data/raw/centro_campana.json` (Overpass) y, en la misma carpeta, `gasolineras.json` y `talleres.json`.
- Escribe `src/map.js` (`window.HMO_MAP`): tiles en RLE base64 más `pois`.
- Requiere numpy y PIL. Tarda ~3 s.
- Regenerar puede mover gasolineras y talleres generados; la casa guardada del jugador se queda donde estaba.
- Ancho de calles: `ROAD_WIDTH_M` (metros reales por tipo) × `ROAD_SCALE` (1.35; las de servicio no se escalan). Se redondea a tiles de 3 m: una residencial queda de 4 tiles (12 m).
- Datos © colaboradores de OpenStreetMap (ODbL). El crédito ya está en las páginas.

## Archivos

| Archivo | Qué hace |
|---|---|
| `tools/build_map.py` | OSM → tiles (3 m/tile, 1168×1180). Calles por tipo, banquetas, edificios (4 variantes de azotea 30–33), cerro en terrazas (20–24), estacionamientos conectados (camino de 2×2 tiles, se vale diagonal), gasolineras con patio de 4 lugares, talleres, postes de luz con grupos apagados, nombres de calles, lugares de meet y escondites |
| `src/map.js` | Generado. No editar a mano |
| `src/tiles.js` | `Hmo`: ids de tiles, `HmoMap` (decodifica, `get`, `solid`, `name`), `Renderer` (dibuja en bloques de 32×32 tiles cacheados; de lejos usa una imagen de 1 px por tile) |
| `src/cars.js` | `HmoCars`: especificación de los 3 carros y `makeSprite(spec, paint)` (pintura, acabado, wrap) |
| `src/model3d.js` | `HmoModel3D`: carros en 3D hechos de vóxeles (cubitos de 6 cm) a partir de su silueta lateral (`MODELS`, en metros desde la defensa trasera). `build(spec)` da la malla; `colors(mesh, spec, paint, rim)` aplica pintura, acabado, wrap y rines. También tiene el mallador genérico: `voxelFaces` (caras visibles con oclusión ambiental) y `fromBoxes(cajas, vox, keepY, noBottom)` para personajes y escenario |
| `src/batsuru3d.js` | `HmoBatsuru3D`: el Ba-tsuru hecho a mano cubito por cubito (5 cm; 4.35 × 1.70 × 1.40 m) con juntas, moldura, manijas, espejos, antena, faros con divisor, calaveras con reversa, placas y rines tipo tapón. Va antes de `model3d.js`; `HmoModel3D.build` lo usa para `pitic` en lugar de `MODELS.pitic` (que queda de respaldo). Pintura, wraps y rines siguen funcionando porque usa los mismos materiales |
| `src/gl3d.js` | `HmoGL`: motor WebGL propio (sin librerías) que comparten la vitrina, el editor de personaje y la escena del meet. `Renderer`: `begin(eye, target, fov)`, `meshes([{h, M}], expo)`, `shadows`, `glows` (luces de color en el piso, hasta 8 focos), `car(spec, paint, rim, slot)` (una forma por modelo, colores por lugar), `upload` / `free`. Matrices: `model(x, y, z, yaw)`, `tiltX`, `mul`. `floorDepth = true` cuando hay piso 3D |
| `src/character.js` | `HmoCharacter`: personajes de cubitos (`OPTIONS`, `defaultLook`, `lookOf`, `randomLook(rng)`, `build(look, pose)`; poses `parado`, `cruzado` y `telefono`). Mide ~1.75 m y la cara ve a +z |
| `src/showroom.js` | `HmoShowroom.Showroom`: vitrina con carrusel; se desliza con el dedo o el mouse, con flechas o con puntos. Los carros que no tienes salen en negro. Si no hay WebGL, usa el dibujo plano |
| `src/meetscene.js` | `HmoMeetScene.Scene`: escena 3D del meet. Estacionamiento de noche con calle y edificios, tu carro y tú recargado, carros y gente de NPCs (semilla = número de meet) y tráfico que pasa. Se arrastra para girar la cámara. Solo es escena: el XP lo lleva `src/game/meets.js` |
| `src/charmenu.js` | `HmoCharMenu.Editor`: editor de personaje (apodo, piel, complexión, vello facial, pelo, ropa, tenis, gorra, lentes, cadena) con vista 3D |
| `src/physics.js` | `HmoPhysics.Car`: modelo de bicicleta, llantas con curva tipo Pacejka, círculo de fricción, transferencia de peso, ABS, freno de mano, asistencia contra trompos, choques contra tiles sólidos |
| `src/route.js` | `HmoRoute`: A* en 8 direcciones con costo por tipo de tile (prefiere calles) |
| `src/night.js` | `HmoNight`: capa oscura a media resolución con huecos de luz (postes, faros, gasolineras, talleres, meet) |
| `src/streets.js` | `HmoStreets`: nombre de la calle más cercana |
| `src/fullmap.js` | `HmoFullMap`: mapa completo a pantalla entera (arrastrar, zoom, elegir destino o casa) |
| `src/progress.js` | `HmoProgress`: partida en localStorage (`hmo.partida.v1`), `ECON` (todos los números de economía), niveles de Street XP, `farmRate`, `parkedXP` |
| `src/tuning.js` | `HmoTuning`: catálogo de piezas, `apply(spec, tuning)`, pintura, neones (`NEON`, `neonOf`, `neonSpots`: color de 8 focos alrededor del carro en el tiempo t, lo usan el juego y la vitrina), talleres normales y escondidos, precios |
| `src/drift.js` | `HmoDrift.DriftScore`: puntos por ángulo, velocidad y duración, con cadenas |
| `src/menus.js` | `HmoMenus`: pantallas de tu taller (casa) y del taller de tuneo (solo DOM). Las dos usan la vitrina 3D; en el taller de tuneo puedes tunear cualquiera de tus carros, no solo el que traes |
| `src/game.js` | Bucle principal: física fija a 120 Hz y orden de cada cuadro (rutas, meets, talleres, cámara, dibujo, HUD). Corto a propósito |
| `src/game/` | El resto del juego, partido por tema. Cada archivo es una IIFE que le cuelga sus funciones y estado a `window.HmoGame` (**G**), y se llaman entre sí por `G.algo()` |
| ↳ `core.js` | Crea G: mapa, superficies, partida (`G.save`, `G.persist`, `G.home`), el carro (`G.car`, `placeCar`, `resetCar`), canvas (`G.ctx`, `G.view`), avisos (`showToast`, `popup`) |
| ↳ `input.js` | Teclado y control (`G.keys`, `readInput`, `G.lastInput`) |
| ↳ `camera.js` | `G.cam`, `updateCamera`, `toggleCamera` |
| ↳ `effects.js` | Marcas de llanta y humo (`skidStep`, `resetMarks`) |
| ↳ `fuel.js` | Gasolina, gasolineras (`G.STATIONS`, `G.fuelState`) y grúa |
| ↳ `nav.js` | Rutas (`G.route`, `G.dest`) y casa (`setHome`, `routeHome`) |
| ↳ `score.js` | Puntos de drift → dinero y XP (`G.driftScore`, `addXP`) |
| ↳ `shops.js` | Talleres normales y escondidos en la ciudad |
| ↳ `meets.js` | Meets, XP por minuto, dejar el carro, abrir y cerrar la escena (`openMeetScene`, `meetHud`) |
| ↳ `screens.js` | Tu taller, talleres de tuneo, editor de personaje y escena del meet (`G.garage`, `G.shopUI`, `G.charEditor`, `G.meetScene`), entrar con E, `G.paused()` |
| ↳ `maps.js` | Mapa completo (`G.fullMap`) y minimapa |
| ↳ `draw.js` | Dibujo del mundo (`G.render`) |
| ↳ `hud.js` | HUD y botones |
| `ideas.md` | Lista de ideas del usuario. Revisarla antes de proponer qué sigue |

## Convenciones y datos clave

- **Unidades:** la física y el juego usan metros. El mapa usa tiles (`TM = 3` m). Los `pois` vienen en tiles; algunos vienen en décimas de tile (postes) o en medios tiles (calles).
- **Orientación:** `x` a la derecha, `y` hacia abajo. `heading h`: el frente apunta a `(cos h, sin h)`. La cámara gira con el carro por defecto (`cam.rot = h + π/2`).
- **Tiles sólidos:** manzana 0, árbol 14, sahuaro 15, roca 12, carro 18, bomba 26, edificios 30–33. Patio de gasolinera 19, patio de taller 27, cerro 20–24.
- **El tuneo modifica la especificación**; la física solo lee `spec`: `powerKW`, `grip`, `slideGrip`, `steerSpeed`, `brake`, `mass`, `cgHeight`, `handbrakeGrip`, `drive`.
- **CSS:** las páginas tienen `[hidden] { display: none !important; }`. Sin esa regla, un elemento con `display: flex` ignora `hidden`; ese error ya pasó con la pantalla de la grúa.
- **Botones:** después de un clic se llama `blur()`, para que Espacio (freno de mano) no los vuelva a activar.
- **Paleta «Fachadas mexicanas»** (`C` en `src/tiles.js`): casas, edificios, carros estacionados, árboles, sahuaros y rocas en colores saturados (rosa mexicano, turquesa, mostaza, cobalto, naranja, verde, terracota, morado, amarillo). Calles, banquetas, parques y cerro se quedan neutros. La capa de noche se queda al 84 %.
- **Marcas:** sin nombres de marcas reales en el juego (gasolineras dicen «Gasolinera», frenos «Kit de alto desempeño»). Carros: **Ba-tsuru** (`pitic`, tipo Tsuru), **Mezquite SR** (`mezquite`, tipo Sentra), **Hondiablo Si** (`choya`, tipo Civic). Los ids internos no cambian; ahí está guardado el progreso.

## Diseño del juego que pidió el usuario

- **Al entrar:** siempre empiezas en tu taller (casa). «Salir a manejar» te pone en la calle frente a tu casa. Para volver: llegas, te detienes y presionas E.
- **Dinero:** sale de los puntos de drift ($0.50/pt). Empiezas con $5,000 y el Ba-tsuru. Mezquite $45k, Hondiablo $85k. Gasolina $24/L. Grúa $300 (si no alcanza, te lleva a casa y ahí hay bidón gratis).
- **Street XP:** es el prestigio. Se gana sobre todo en **meets**: 120 XP al llegar y luego XP por minuto estacionado. Puedes **dejar el carro en el meet** y sigue juntando XP en tiempo real (tope 12 h); mientras esté ahí no puedes usar otro carro. Mejor carro y más tuneo farmean más. Por drift también se gana, menos: 1 XP por cada 40 pts.
- **Talleres:** 9 normales (3 por nivel; en cada nivel uno barato, uno normal y uno caro). 3 escondidos de calidad que cambian de lugar cada 20 min de juego y solo aparecen al pasar cerca. Cada pieza tiene 3 opciones. Hay cambio de tracción, y pintura con paleta, acabado y wrap.
- **Neones (luces debajo del carro):** estáticas $400 (1 color) o dinámicas $1,600 (1 a 3 colores + patrón). Cada patrón cuesta $10 y se compra una vez por carro; cambiar de color es gratis. Precio fijo, no cambia con el taller ni con el carro. En `save.tuning[id].neon = { mode, colors, pattern, patterns }`. Suben un poco el XP del meet (+5 % / +10 %).
- **Personaje y escena del meet:** la primera vez que entras creas tu personaje (luego se edita con «Tu personaje» en tu taller; es gratis). Parado en un meet, E te baja a la escena 3D: tu carro, tú recargado, carros y gente de NPCs y tráfico. El XP sigue sumando ahí. Botones: «Volver al carro» (E o Esc) y «Dejar el carro aquí». **En la calle no hay NPCs**: solo en las escenas de meet.
- **Noche siempre:** postes cada ~30 m; grupos apagados de 2 a 5 postes vecinos.
- **Mapa:** el usuario quiere elegir casa y destinos desde el mapa completo, no desde el minimapa.

## Cómo probar

- Sintaxis: `for f in src/*.js src/game/*.js; do node --check "$f"; done`
- Física, puntos, tuneo y guardado: en Node, con `global.window = {}` y `global.document = { createElement: () => ({}) }` (y un `localStorage` falso), se cargan con `require('./src/…')` y se simula con `car.step(1/120, input, world)`. Para pruebas sin choques sirve un mundo plano: `{ tileM: 3, solidAt: () => false, surface: () => ({ grip: 1, drag: 0 }) }`.
- No hay navegador headless instalado. Lo visual lo revisa el usuario y manda capturas.

## Pendiente (orden recomendado)

1. Carreras con checkpoints (subida al cerro por Cucurpe, circuito del centro, bulevares) que den dinero y Street XP.
2. Sonido: motor, llantas, choques.
3. Escenarios del meet según el lugar real: hoy todos usan el mismo (estacionamiento con edificios al fondo), y en varios lugares no hay edificios. El usuario va a hacer bocetos; esperar a tenerlos. Después, más vida en la escena (NPCs que llegan y se van, música). En la calle no van NPCs.
4. Carro eléctrico y electrolinera (ya está en `pois.charge`).
5. Intercambios de carros.
6. Arrancones, después.
