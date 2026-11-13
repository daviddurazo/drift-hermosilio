"""Convierte un extracto de OpenStreetMap (JSON de Overpass) en un mapa de tiles.

Uso:
    python3 -I tools/build_map.py data/raw/centro_campana.json src/world/map.js [preview.png]

Cada tile mide TILE_M metros. El resultado es un JS con el mapa codificado en RLE
(window.HMO_MAP) para que el juego lo cargue aun abriendo el HTML con file://.
"""
import base64
from collections import deque
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw

TILE_M = 3.0  # metros por tile

# --- ids de tile (mismo orden en src/world/tiles.js) ---
T = dict(
    BLOCK=0,      # manzana (sólida, casas procedurales)
    ROAD=1,       # asfalto
    LINE=2,       # raya amarilla discontinua en avenidas (asfalto)
    SIDEWALK=3,   # banqueta
    PARKING=4,    # estacionamiento
    PLAZA=5,      # plaza peatonal
    PARK=6,       # pasto
    PITCH=7,      # cancha
    PATH=8,       # andador
    WATER=9,
    BUILDING=30,  # edificio real de OSM (sólido); variantes de azotea 30..33
    CAMPUS=11,    # escuela / hospital / universidad (suelo)
    ROCK=12,      # roca (sólida)
    DESERT=13,    # matorral / tierra
    TREE=14,      # árbol (sólido)
    SAGUARO=15,   # sahuaro (sólido)
    DIRT=16,      # camino de tierra
    TRACK=17,     # pista de atletismo
    CAR=18,       # carro estacionado (sólido, ocupa 2 tiles a lo alto)
    PAD=19,       # patio de gasolinera (concreto)
    PUMP=26,      # isla de bombas (sólida)
    GARAGE=27,    # patio de taller mecánico
    CERRO0=20,    # niveles del cerro, 20..24
)

ROAD_WIDTH_M = {
    'motorway': 26, 'trunk': 22, 'primary': 17, 'secondary': 14, 'tertiary': 12,
    'unclassified': 10, 'residential': 9, 'living_street': 8,
    'motorway_link': 9, 'trunk_link': 9, 'primary_link': 8, 'secondary_link': 8, 'tertiary_link': 8,
    'service': 6,
}
# las calles reales se sienten angostas para derrapar: todas (menos las de servicio) se ensanchan con este factor
ROAD_SCALE = 1.35
MAJOR = {'motorway', 'trunk', 'primary', 'secondary'}
SKIP_SERVICE = {'driveway', 'parking_aisle', 'drive-through'}


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)['elements']


def main(src, out_js, out_png=None):
    els = load(src)

    # bbox desde los datos
    lats, lons = [], []
    for e in els:
        for p in e.get('geometry') or []:
            lats.append(p['lat'])
            lons.append(p['lon'])
    # recorte fijo de la zona (el extracto trae vías que se salen del recuadro)
    S, Wl, N, E = 29.064, -110.972, 29.096, -110.936
    lat0 = (S + N) / 2
    mx = math.cos(math.radians(lat0)) * 111320.0
    my = 110574.0
    W = int(math.ceil((E - Wl) * mx / TILE_M))
    H = int(math.ceil((N - S) * my / TILE_M))

    def xy(p):
        return ((p['lon'] - Wl) * mx / TILE_M, (N - p['lat']) * my / TILE_M)

    img = Image.new('L', (W, H), T['BLOCK'])
    dr = ImageDraw.Draw(img)

    def rings(e):
        """Anillos (outer, inner) de un way cerrado o una relación multipolígono."""
        if e['type'] == 'way':
            g = e.get('geometry') or []
            if len(g) >= 4 and g[0] == g[-1]:
                return [[xy(p) for p in g]], []
            return [], []
        outer, inner = [], []
        for m in e.get('members', []):
            g = m.get('geometry') or []
            if len(g) < 3:
                continue
            (inner if m.get('role') == 'inner' else outer).append([xy(p) for p in g])
        return outer, inner

    def fill_area(e, val):
        outer, inner = rings(e)
        if not outer:
            return
        if not inner:
            for r in outer:
                dr.polygon(r, fill=val)
            return
        mask = Image.new('1', (W, H), 0)
        md = ImageDraw.Draw(mask)
        for r in outer:
            md.polygon(r, fill=1)
        for r in inner:
            md.polygon(r, fill=0)
        img.paste(val, mask=mask)

    def is_parking(t):
        return t.get('amenity') == 'parking' or t.get('building') == 'parking'

    def area_class(t):
        nat, lei, lu, am = t.get('natural'), t.get('leisure'), t.get('landuse'), t.get('amenity')
        if nat == 'water' or t.get('waterway') == 'riverbank':
            return 'WATER'
        if nat in ('fell', 'bare_rock') or (nat == 'grassland' and 'cerro' in t.get('name', '').lower()):
            return 'HILL'
        if nat in ('scrub', 'sand', 'grassland'):
            return 'DESERT'
        if nat == 'wood' or lei in ('park', 'garden') or lu in ('grass', 'recreation_ground', 'village_green'):
            return 'PARK'
        if lei == 'track' or (lei == 'pitch' and t.get('sport') == 'athletics'):
            # sin area=yes, un leisure=track es el trazo de un circuito, no una superficie
            return 'TRACK' if t.get('area') == 'yes' or lei == 'pitch' else 'TRACKLINE'
        if lei == 'pitch':
            return 'PITCH'
        if lei in ('sports_centre', 'stadium'):
            return 'PARK'
        # todo estacionamiento se puede manejar, salvo el subterráneo (multinivel = se maneja sobre la azotea)
        if am == 'parking' or t.get('building') == 'parking':
            return None if t.get('parking') == 'underground' else 'PARKING'
        if am in ('school', 'university', 'college', 'hospital', 'kindergarten'):
            return 'CAMPUS'
        if t.get('highway') == 'pedestrian' and t.get('area') == 'yes':
            return 'PLAZA'
        if am == 'fountain':
            return 'WATER'
        return None

    # 1) áreas, de la más general a la más específica
    order = ['CAMPUS', 'DESERT', 'HILL', 'PARK', 'PITCH', 'TRACK', 'PARKING', 'PLAZA', 'WATER']
    buckets = {k: [] for k in order}
    hill_mask = Image.new('1', (W, H), 0)
    track_lines = []
    for e in els:
        t = e.get('tags', {})
        if 'building' in t and not is_parking(t):
            continue
        c = area_class(t)
        if c == 'TRACKLINE':
            if e['type'] == 'way':
                track_lines.append([xy(p) for p in e['geometry']])
        elif c:
            buckets[c].append(e)
    for c in order:
        for e in buckets[c]:
            if c == 'HILL':
                outer, inner = rings(e)
                hd = ImageDraw.Draw(hill_mask)
                for r in outer:
                    hd.polygon(r, fill=1)
                for r in inner:
                    hd.polygon(r, fill=0)
                fill_area(e, T['DESERT'])
            else:
                fill_area(e, T[c])

    # 2) caminos de parque, veredas del cerro (solo fuera de manzanas, para no partir cuadras)
    layers = {v: Image.new('1', (W, H), 0) for v in (T['PLAZA'], T['DIRT'], T['PATH'], T['TRACK'])}
    for pts in track_lines:
        ImageDraw.Draw(layers[T['TRACK']]).line(pts, fill=1, width=2, joint='curve')
    for e in els:
        t = e.get('tags', {})
        hw = t.get('highway')
        if e['type'] != 'way' or hw not in ('footway', 'path', 'pedestrian', 'cycleway', 'track', 'steps'):
            continue
        if t.get('footway') in ('sidewalk', 'crossing') or t.get('area') == 'yes':
            continue
        pts = [xy(p) for p in e['geometry']]
        if len(pts) < 2:
            continue
        val = T['PLAZA'] if hw == 'pedestrian' else (T['DIRT'] if hw in ('path', 'track') else T['PATH'])
        ImageDraw.Draw(layers[val]).line(pts, fill=1, width=3 if hw == 'pedestrian' else 1, joint='curve')
    a = np.array(img)
    for val, lay in layers.items():
        m = np.array(lay, dtype=bool) & (a != T['BLOCK'])
        a[m] = val
    img = Image.fromarray(a)
    dr = ImageDraw.Draw(img)

    # 2b) entradas y pasillos de estacionamiento: solo los que tocan un estacionamiento
    a = np.array(img)
    pk = a == T['PARKING']
    pk_near = pk.copy()
    for _ in range(3):
        o = pk_near.copy()
        o[1:, :] |= pk_near[:-1, :]; o[:-1, :] |= pk_near[1:, :]
        o[:, 1:] |= pk_near[:, :-1]; o[:, :-1] |= pk_near[:, 1:]
        pk_near = o
    n_drive = 0
    for e in els:
        t = e.get('tags', {})
        if e['type'] != 'way' or t.get('highway') != 'service' or t.get('service') not in SKIP_SERVICE:
            continue
        pts = [xy(p) for p in e['geometry']]
        if len(pts) < 2:
            continue
        if not any(0 <= int(x) < W and 0 <= int(y) < H and pk_near[int(y), int(x)] for x, y in pts):
            continue
        dr.line(pts, fill=T['PARKING'], width=3, joint='curve')
        n_drive += 1

    # 3) calles
    roads = []
    for e in els:
        t = e.get('tags', {})
        hw = t.get('highway')
        if e['type'] != 'way' or hw not in ROAD_WIDTH_M:
            continue
        if hw == 'service' and t.get('service') in SKIP_SERVICE:
            continue
        if t.get('tunnel') in ('yes', 'building_passage') or t.get('area') == 'yes':
            continue
        pts = [xy(p) for p in e['geometry']]
        if len(pts) < 2:
            continue
        wm = ROAD_WIDTH_M[hw]
        try:
            lanes = int(t.get('lanes', '0'))
            if lanes and hw not in ('service',):
                wm = max(wm * 0.7, min(wm * 1.4, lanes * 3.4 + 2))
        except ValueError:
            pass
        if hw != 'service':
            wm *= ROAD_SCALE
        roads.append((hw, pts, max(2, round(wm / TILE_M))))
    # primero las angostas, luego las anchas encima
    roads.sort(key=lambda r: r[2])
    for hw, pts, w in roads:
        dr.line(pts, fill=T['ROAD'], width=w, joint='curve')
        r = w / 2
        for x, y in (pts[0], pts[-1]):
            dr.ellipse([x - r, y - r, x + r, y + r], fill=T['ROAD'])

    a = np.array(img)

    # 4) rayas discontinuas al centro de avenidas
    line_lay = Image.new('1', (W, H), 0)
    ld = ImageDraw.Draw(line_lay)
    for hw, pts, w in roads:
        if hw not in MAJOR or w < 5:
            continue
        acc = 0.0
        on = True
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            seg = math.hypot(x2 - x1, y2 - y1)
            pos = 0.0
            while pos < seg:
                step = min(seg - pos, (2.0 if on else 2.0) - acc)
                if on:
                    t0, t1 = pos / seg, (pos + step) / seg
                    ld.line([(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0), (x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1)], fill=1, width=1)
                pos += step
                acc += step
                if acc >= 2.0 - 1e-6:
                    acc = 0.0
                    on = not on
    lm = np.array(line_lay, dtype=bool) & (a == T['ROAD'])
    # no rayar cruces: solo donde la raya tiene asfalto a ambos lados en algún eje
    a[lm] = T['LINE']

    road = (a == T['ROAD']) | (a == T['LINE'])

    def dilate(m, n=1):
        out = m.copy()
        for _ in range(n):
            o = out.copy()
            o[1:, :] |= out[:-1, :]
            o[:-1, :] |= out[1:, :]
            o[:, 1:] |= out[:, :-1]
            o[:, :-1] |= out[:, 1:]
            out = o
        return out

    def erode(m):
        o = m.copy()
        o[1:, :] &= m[:-1, :]
        o[:-1, :] &= m[1:, :]
        o[:, 1:] &= m[:, :-1]
        o[:, :-1] &= m[:, 1:]
        o[0, :] = o[-1, :] = o[:, 0] = o[:, -1] = False
        return o

    # 5) banquetas: anillo de 1 tile donde la calle toca manzana o campus
    near = dilate(road, 1) & ~road
    a[near & ((a == T['BLOCK']) | (a == T['CAMPUS']))] = T['SIDEWALK']

    # 6) edificios reales (solo sobre manzana, campus, plaza o parque)
    # cada edificio recibe una de 4 azoteas (concreto, blanca, beige, paneles solares)
    bl = Image.new('L', (W, H), 0)
    bd = ImageDraw.Draw(bl)
    for e in els:
        t = e.get('tags', {})
        if 'building' not in t or t.get('building') in ('roof', 'construction', 'ruins') or is_parking(t):
            continue
        h = (e['id'] * 2654435761) & 0xFFFFFFFF
        variant = (h >> 7) % 4
        outer, inner = rings(e)
        for r in outer:
            bd.polygon(r, fill=T['BUILDING'] + variant)
    bv = np.array(bl)
    bm = (bv > 0) & np.isin(a, [T['BLOCK'], T['CAMPUS'], T['PLAZA'], T['PARK'], T['SIDEWALK']])
    bm &= ~dilate(road, 1)
    a[bm] = bv[bm]

    # 7) cerro en terrazas: nivel = cuántas erosiones sobrevive el tile
    hill = np.array(hill_mask, dtype=bool) & ~road & (a != T['PLAZA']) & (a != T['DIRT']) & (a != T['PATH'])
    hill_all = np.array(hill_mask, dtype=bool)
    level = np.zeros(a.shape, dtype=np.int16)
    m = hill_all.copy()
    step = 9  # tiles por terraza (~27 m)
    k = 0
    while m.any() and k < 200:
        for _ in range(step):
            m = erode(m)
        k += 1
        level[m] += 1
    level = np.clip(level, 0, 4)
    a[hill] = T['CERRO0'] + level[hill]

    # 8) decoración sólida determinística: árboles en parques, sahuaros en desierto y cerro
    rng = np.random.default_rng(2026)
    rnd = rng.random(a.shape)
    yy, xx = np.indices(a.shape)
    park = a == T['PARK']
    free_park = park & ~dilate(~park, 1)
    a[free_park & (xx % 3 == 0) & (yy % 3 == 0) & (rnd < 0.35)] = T['TREE']
    cerro = (a >= T['CERRO0']) & (a <= T['CERRO0'] + 4)
    desert = (a == T['DESERT']) | cerro
    free_des = desert & ~dilate(~desert, 2)
    a[free_des & (xx % 4 == 0) & (yy % 4 == 0) & (rnd < 0.22)] = T['SAGUARO']

    # 8b) todo estacionamiento con entrada desde la calle: un camino pavimentado
    #     (calle, banqueta o estacionamiento) donde quepa un cuadro de 2x2 tiles (6 m)
    Hh, Ww = a.shape
    PAVED = [T['ROAD'], T['LINE'], T['SIDEWALK'], T['PARKING']]
    NB = lambda i, x: (i - Ww, i + Ww, i - 1 if x > 0 else -1, i + 1 if x < Ww - 1 else -1)
    # el cuadro de 2x2 también avanza en diagonal (una entrada a 45° es una escalera de tiles)
    NB8 = lambda i, x: NB(i, x) + ((i - Ww - 1, i + Ww - 1) if x > 0 else ()) + ((i - Ww + 1, i + Ww + 1) if x < Ww - 1 else ())

    def fat_of(arr):
        p = np.isin(arr, PAVED)
        f = p.copy()
        f[:-1, :] &= p[1:, :]
        f[:, :-1] &= p[:, 1:]
        f[:-1, :-1] &= p[1:, 1:]
        f[-1, :] = False
        f[:, -1] = False
        return f

    def reach_from_roads(arr):
        # tiles cubiertos por algún cuadro 2x2 alcanzable desde la red principal de calles
        f = fat_of(arr).ravel().tolist()
        flat_ = arr.ravel()
        seen = [False] * len(f)
        # semilla: el componente de cuadros 2x2 con más calle
        best, best_road = None, -1
        lab_done = [False] * len(f)
        for s0 in np.flatnonzero((flat_ == T['ROAD']) & np.array(f)).tolist():
            if lab_done[s0]:
                continue
            q = [s0]; lab_done[s0] = True; k = 0; road_n = 0
            while k < len(q):
                i = q[k]; k += 1
                if flat_[i] == T['ROAD']:
                    road_n += 1
                for j in NB8(i, i % Ww):
                    if 0 <= j < len(f) and f[j] and not lab_done[j]:
                        lab_done[j] = True; q.append(j)
            if road_n > best_road:
                best, best_road = q, road_n
        cov = np.zeros(len(f), dtype=bool)
        idx = np.array(best, dtype=np.int64)
        for off in (0, 1, Ww, Ww + 1):
            cov[np.clip(idx + off, 0, len(f) - 1)] = True
        origin = np.zeros(len(f), dtype=bool)
        origin[idx] = True
        reach_from_roads.origin = origin
        return cov.reshape(arr.shape)

    carved = removed = 0
    for _pass in range(8):
        acc = reach_from_roads(a)
        bad = (a == T['PARKING']) & ~acc
        if not bad.any():
            break
        # agrupa los tiles de estacionamiento sin entrada
        bflat = bad.ravel().tolist()
        seen = [False] * len(bflat)
        groups = []
        for s0 in np.flatnonzero(bad).tolist():
            if seen[s0]:
                continue
            q = [s0]; seen[s0] = True; k = 0
            while k < len(q):
                i = q[k]; k += 1
                for j in NB(i, i % Ww):
                    if 0 <= j < len(bflat) and bflat[j] and not seen[j]:
                        seen[j] = True; q.append(j)
            groups.append(q)
        accf = acc.ravel().tolist()
        orig = reach_from_roads.origin.tolist()  # esquinas de cuadros 2x2 de la red principal
        for grp in groups:
            touches = any(accf[j] for i in grp for j in NB(i, i % Ww) if 0 <= j < Hh * Ww)
            if len(grp) < 8 and not touches and _pass == 0:  # astilla suelta de polígono
                for i in grp:
                    a.flat[i] = T['BLOCK']
                removed += 1
                continue
            # camino más corto hasta un tile con acceso; se abre de 2x2 tiles
            prev = {i: -1 for i in grp}
            dq = deque(grp)
            hit = -1
            while dq:
                i = dq.popleft()
                if orig[i]:
                    hit = i
                    break
                for j in NB(i, i % Ww):
                    if 0 <= j < Hh * Ww and j not in prev and a.flat[j] != T['WATER']:
                        prev[j] = i
                        dq.append(j)
            if hit < 0:
                continue
            i = hit
            while i != -1:
                y, x = divmod(i, Ww)
                for yy2, xx2 in ((y, x), (y, x + 1), (y + 1, x), (y + 1, x + 1), (y - 1, x), (y, x - 1), (y - 1, x - 1), (y - 1, x + 1), (y + 1, x - 1)):
                    if 0 <= yy2 < Hh and 0 <= xx2 < Ww and a[yy2, xx2] not in (T['ROAD'], T['LINE'], T['WATER'], T['PARKING'], T['SIDEWALK']):
                        if abs(yy2 - y) + abs(xx2 - x) <= 2 and (yy2 >= y and xx2 >= x):
                            a[yy2, xx2] = T['PARKING']
                i = prev[i]
            carved += 1
    left = int(((a == T['PARKING']) & ~reach_from_roads(a)).sum())
    print(f'estacionamientos: {n_drive} entradas de OSM, {carved} entradas nuevas, {removed} astillas quitadas, {left} tiles aún sin entrada')

    # 9) puntos de interés (en tiles)
    def tile_of(lat, lon):
        x, y = xy({'lat': lat, 'lon': lon})
        return [int(x), int(y)]

    pois = {
        'campana': tile_of(29.073052, -110.9504353),
    }
    for e in els:
        t = e.get('tags', {})
        if t.get('building') == 'cathedral' or t.get('amenity') == 'townhall' or (t.get('leisure') == 'park' and t.get('name') in ('Plaza Zaragoza', 'Parque Madero')):
            g = e.get('geometry') or [p for mm in e.get('members', []) for p in (mm.get('geometry') or [])]
            if g:
                la = sum(p['lat'] for p in g) / len(g)
                lo = sum(p['lon'] for p in g) / len(g)
                key = {'cathedral': 'catedral'}.get(t.get('building')) or ('palacio' if t.get('amenity') == 'townhall' else t['name'].lower().replace(' ', '_'))
                pois[key] = tile_of(la, lo)

    # 9b) gasolineras: cada una con patio de 10x7 tiles pegado a la calle,
    #     carril de entrada, 2 islas de bombas y 4 lugares para cargar.
    import os
    gas_path = os.path.join(os.path.dirname(src), 'gasolineras.json')
    pois['fuel'], pois['charge'] = [], []
    isroad = lambda x, y: 0 <= x < W and 0 <= y < H and a[y, x] in (T['ROAD'], T['LINE'])

    def nearest_road(x, y, rmax=40):
        for r in range(rmax):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    if max(abs(dx), abs(dy)) == r and isroad(x + dx, y + dy):
                        return x + dx, y + dy
        return None

    def road_axis(x, y):
        def run(dx, dy):
            n = 1
            while n < 40 and isroad(x + dx * n, y + dy * n):
                n += 1
            return n
        return 'h' if run(1, 0) + run(-1, 0) >= run(0, 1) + run(0, -1) else 'v'

    def layout(rx, ry, axis, side, along):
        """Tiles del patio: (x, y, tipo). 'along' es el inicio del patio sobre el eje de la calle."""
        # avanza desde la calle hacia el lado del patio hasta salir del asfalto
        if axis == 'h':
            y = ry
            while isroad(rx, y):
                y += side
            to_xy = lambda i, d: (along + i, y + side * d)
        else:
            x = rx
            while isroad(x, ry):
                x += side
            to_xy = lambda i, d: (x + side * d, along + i)
        tiles, bays = [], []
        for d in range(7):            # 0-1 carril de entrada, 2-3 lugar A, 4 isla, 5-6 lugar B
            for i in range(10):
                kind = T['PUMP'] if d == 4 and (1 <= i <= 3 or 6 <= i <= 8) else T['PAD']
                tiles.append((*to_xy(i, d), kind))
        for ic in (2, 7):              # centro de cada isla
            for dc in (2.5, 5.5):      # lugar a cada lado de la isla
                bx, by = to_xy(ic, dc)
                bays.append([bx + 0.5, by + 0.5] if axis == 'h' else [bx + 0.5, by + 0.5])
        cx, cy = to_xy(5, 3.5)
        # frente del patio: la fila de afuera del carril de entrada (debe ser calle o banqueta)
        front = [to_xy(i, -1) for i in range(10)]
        return tiles, bays, [cx, cy], front

    def place(tiles):
        for x, y, kind in tiles:
            if 0 <= x < W and 0 <= y < H and a[y, x] not in (T['ROAD'], T['LINE'], T['WATER']):
                a[y, x] = kind

    def station_at(sx, sy):
        # calles candidatas: la más cercana y otras alrededor (para esquinas complicadas)
        roads = []
        rr = nearest_road(sx, sy)
        if not rr:
            return None
        roads.append(rr)
        for dy in range(-24, 25, 3):
            for dx in range(-24, 25, 3):
                if isroad(sx + dx, sy + dy):
                    roads.append((sx + dx, sy + dy))
        best = None
        for (rx, ry) in roads:
            axis = road_axis(rx, ry)
            pref = (1 if sy >= ry else -1) if axis == 'h' else (1 if sx >= rx else -1)
            base = (sx if axis == 'h' else sy) - 5
            dist = abs(rx - sx) + abs(ry - sy)
            # prueba recorrer el patio y cambiar de lado; gana la opción que menos calle pisa y queda más cerca
            for side in (pref, -pref):
                for off in (0, -3, 3, -6, 6, -9, 9):
                    tiles, bays, c, front = layout(rx, ry, axis, side, base + off)
                    touch = sum(1 for x, y in front if 0 <= x < W and 0 <= y < H and a[y, x] in (T['ROAD'], T['LINE'], T['SIDEWALK'], T['PARKING']))
                    hit = sum(1 for x, y, _k in tiles if not (0 <= x < W and 0 <= y < H) or a[y, x] in (T['ROAD'], T['LINE'], T['WATER']))
                    bad_bays = sum(1 for bx, by in bays if not (0 <= int(bx) < W and 0 <= int(by) < H) or a[int(by), int(bx)] in (T['ROAD'], T['LINE'], T['WATER']))
                    score = bad_bays * 100 + max(0, 6 - touch) * 40 + hit * 2 + abs(off) * 0.5 + (0 if side == pref else 5) + (dist if (rx, ry) != rr else 0)
                    if best is None or score < best[0]:
                        best = (score, tiles, bays, c, axis)
        _, tiles, bays, c, axis = best
        place(tiles)
        return {'c': [round(c[0], 1), round(c[1], 1)], 'bays': [[round(b[0], 1), round(b[1], 1)] for b in bays], 'axis': axis}

    raw = []
    if os.path.exists(gas_path):
        with open(gas_path, encoding='utf-8') as f:
            gels = json.load(f)['elements']
        for e in gels:
            t = e.get('tags', {})
            lat = e.get('lat') or e.get('center', {}).get('lat')
            lon = e.get('lon') or e.get('center', {}).get('lon')
            if lat is None:
                continue
            x, y = xy({'lat': lat, 'lon': lon})
            if not (0 <= x < W and 0 <= y < H):
                continue
            if t.get('amenity') == 'charging_station':
                pois['charge'].append([int(x), int(y)])
            elif t.get('amenity') == 'fuel' and all(abs(int(x) - q[0]) + abs(int(y) - q[1]) > 15 for q in raw):
                raw.append([int(x), int(y)])
    for sx, sy in raw:
        st = station_at(sx, sy)
        if st:
            st['gen'] = False
            pois['fuel'].append(st)

    # hasta 3 gasolineras extra en bulevares, al azar entre los puntos más alejados de las existentes
    grng = np.random.default_rng(77)
    line_y, line_x = np.nonzero(a == T['LINE'])
    keep = (line_x > 25) & (line_x < W - 25) & (line_y > 25) & (line_y < H - 25)
    line_x, line_y = line_x[keep], line_y[keep]
    for _ in range(3):
        if not len(line_x):
            break
        cs = np.array([st['c'] for st in pois['fuel']]) if pois['fuel'] else np.zeros((0, 2))
        if len(cs):
            dmin = np.min(np.hypot(line_x[:, None] - cs[None, :, 0], line_y[:, None] - cs[None, :, 1]), axis=1)
        else:
            dmin = np.full(len(line_x), 1e9)
        order = np.argsort(-dmin)
        placed = False
        for idx in grng.permutation(order[: max(1, len(order) // 12)])[:200]:
            rx, ry = int(line_x[idx]), int(line_y[idx])
            axis = road_axis(rx, ry)
            for side in grng.permutation([1, -1]):
                along = (rx if axis == 'h' else ry) - 5
                tiles, bays, c, front = layout(rx, ry, axis, int(side), along)
                touch = sum(1 for x, y in front if 0 <= x < W and 0 <= y < H and a[y, x] in (T['ROAD'], T['LINE'], T['SIDEWALK'], T['PARKING']))
                if touch < 6:
                    continue
                # el patio va sobre manzanas o estacionamiento, no sobre parques, cerro ni otra calle
                ok = sum(1 for x, y, _k in tiles if 0 <= x < W and 0 <= y < H and a[y, x] in (T['BLOCK'], T['SIDEWALK'], T['PARKING'], 30, 31, 32, 33))
                if ok >= len(tiles) * 0.85:
                    place(tiles)
                    pois['fuel'].append({'c': [round(c[0], 1), round(c[1], 1)], 'bays': [[round(b[0], 1), round(b[1], 1)] for b in bays], 'axis': axis, 'gen': True})
                    placed = True
                    break
            if placed:
                break
    print('gasolineras', sum(1 for st in pois['fuel'] if not st['gen']), 'reales +', sum(1 for st in pois['fuel'] if st['gen']), 'nuevas en bulevar; electrolineras', len(pois['charge']))

    # 9b2) talleres: patio de 6x4 tiles pegado a una calle. Sitios reales de OSM y, para completar 9,
    #      otros en calles de colonia, repartidos lejos de los que ya hay.
    def shop_layout(rx, ry, axis, side, along):
        if axis == 'h':
            y = ry
            while isroad(rx, y):
                y += side
            to_xy = lambda i, d: (along + i, y + side * d)
        else:
            x = rx
            while isroad(x, ry):
                x += side
            to_xy = lambda i, d: (x + side * d, along + i)
        tiles = [(*to_xy(i, d), T['GARAGE']) for d in range(4) for i in range(6)]
        front = [to_xy(i, -1) for i in range(6)]
        cx, cy = to_xy(3, 2)
        return tiles, [cx, cy], front

    def shop_score(tiles, front):
        touch = sum(1 for x, y in front if 0 <= x < W and 0 <= y < H and a[y, x] in (T['ROAD'], T['LINE'], T['SIDEWALK'], T['PARKING']))
        bad = sum(1 for x, y, _k in tiles if not (0 <= x < W and 0 <= y < H) or a[y, x] in (T['ROAD'], T['LINE'], T['WATER'], T['PAD'], T['PUMP'], T['GARAGE']))
        return touch, bad

    def shop_at(sx, sy):
        best = None
        cands = [nearest_road(sx, sy)] + [(sx + dx, sy + dy) for dy in range(-15, 16, 3) for dx in range(-15, 16, 3) if isroad(sx + dx, sy + dy)]
        for rr in cands:
            if not rr:
                continue
            rx, ry = rr
            axis = road_axis(rx, ry)
            pref = (1 if sy >= ry else -1) if axis == 'h' else (1 if sx >= rx else -1)
            base = (sx if axis == 'h' else sy) - 3
            for side in (pref, -pref):
                for off in (0, -3, 3, -6, 6):
                    tiles, c, front = shop_layout(rx, ry, axis, side, base + off)
                    touch, bad = shop_score(tiles, front)
                    score = max(0, 4 - touch) * 50 + bad * 30 + abs(off) + (0 if side == pref else 4) + abs(rx - sx) + abs(ry - sy)
                    if best is None or score < best[0]:
                        best = (score, tiles, c, axis, touch, bad)
        if not best or best[4] < 4 or best[5] > 0:
            return None
        _, tiles, c, axis, _t, _b = best
        place(tiles)
        return {'c': [c[0] + 0.5, c[1] + 0.5], 'axis': axis}

    pois['shops'] = []
    shop_path = os.path.join(os.path.dirname(src), 'talleres.json')
    if os.path.exists(shop_path):
        with open(shop_path, encoding='utf-8') as f:
            sels = json.load(f)['elements']
        seen_sites = []
        for e in sels:
            t = e.get('tags', {})
            if t.get('shop') not in ('car_repair', 'tyres'):
                continue
            lat = e.get('lat') or e.get('center', {}).get('lat')
            lon = e.get('lon') or e.get('center', {}).get('lon')
            x, y = xy({'lat': lat, 'lon': lon})
            if not (0 <= x < W and 0 <= y < H) or any(abs(x - q[0]) + abs(y - q[1]) < 30 for q in seen_sites):
                continue
            seen_sites.append((x, y))
            sh = shop_at(int(x), int(y))
            if sh:
                sh['real'] = True
                pois['shops'].append(sh)
    srng = np.random.default_rng(31)
    ry_, rx_ = np.nonzero(a == T['ROAD'])
    keep = (rx_ > 30) & (rx_ < W - 30) & (ry_ > 30) & (ry_ < H - 30)
    rx_, ry_ = rx_[keep], ry_[keep]
    tries = 0
    while len(pois['shops']) < 9 and tries < 40:
        tries += 1
        cs = np.array([sh['c'] for sh in pois['shops']] + [st['c'] for st in pois['fuel']])
        dmin = np.min(np.hypot(rx_[:, None] - cs[None, :, 0], ry_[:, None] - cs[None, :, 1]), axis=1)
        order = np.argsort(-dmin)
        idx = srng.choice(order[: max(1, len(order) // 15)])
        sh = shop_at(int(rx_[idx]), int(ry_[idx]))
        if sh:
            sh['real'] = False
            pois['shops'].append(sh)
    print('talleres', sum(1 for sh in pois['shops'] if sh['real']), 'reales +', sum(1 for sh in pois['shops'] if not sh['real']), 'nuevos')

    # 9b3) estacionamientos grandes = lugares de meet; medianos = escondites posibles para talleres que rotan
    pk = (a == T['PARKING'])
    lab = -np.ones(a.shape, dtype=np.int32)
    lots = []
    for y0, x0 in zip(*np.nonzero(pk)):
        if lab[y0, x0] >= 0:
            continue
        q = [(y0, x0)]
        lab[y0, x0] = len(lots)
        k = 0
        while k < len(q):
            y, x = q[k]; k += 1
            for yy2, xx2 in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy2 < H and 0 <= xx2 < W and pk[yy2, xx2] and lab[yy2, xx2] < 0:
                    lab[yy2, xx2] = len(lots)
                    q.append((yy2, xx2))
        ys = np.array([t_[0] for t_ in q]); xs = np.array([t_[1] for t_ in q])
        # el tile del lote más cercano a su centro
        j = int(np.argmin(np.hypot(xs - xs.mean(), ys - ys.mean())))
        lots.append((len(q), int(xs[j]), int(ys[j])))
    lots.sort(reverse=True)
    meets, hidden = [], []
    for size, x, y in lots:
        if size >= 250 and all(abs(x - m[0]) + abs(y - m[1]) > 60 for m in meets):
            meets.append([x, y])
        elif 50 <= size and all(abs(x - m[0]) + abs(y - m[1]) > 40 for m in hidden + meets):
            hidden.append([x, y])
    pois['meetSpots'] = meets[:16]
    pois['hiddenSpots'] = hidden[:40]
    print('lugares de meet', len(pois['meetSpots']), '| escondites para talleres', len(pois['hiddenSpots']))

    # 9c) postes de luz: cada ~30 m a lo largo de cada calle, sobre la banqueta, alternando lado.
    #     Algunos grupos de 2 a 5 postes vecinos quedan apagados.
    LAMP_STEP_M = 30.0
    lamps = []
    occupied = {}

    def lamp_ok(x, y):
        if not (0 <= x < W and 0 <= y < H):
            return False
        return a[y, x] in (T['SIDEWALK'], T['PLAZA'], T['PARK'], T['CAMPUS'], T['PARKING'], T['PAD'])

    for hw, pts, wtiles in roads:
        if hw == 'service':
            continue
        step = LAMP_STEP_M / TILE_M
        acc = step / 2
        side = 1
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            seg = math.hypot(x2 - x1, y2 - y1)
            if seg < 1e-6:
                continue
            ux, uy = (x2 - x1) / seg, (y2 - y1) / seg
            pos = acc
            while pos < seg:
                cx, cy = x1 + ux * pos, y1 + uy * pos
                # el poste va justo afuera del asfalto, del lado que toque
                for sd in (side, -side):
                    off = wtiles / 2 + 0.6
                    lx, ly = cx - uy * off * sd, cy + ux * off * sd
                    tx, ty = int(lx), int(ly)
                    if lamp_ok(tx, ty):
                        key = (tx // 6, ty // 6)
                        if not any(abs(qx - lx) + abs(qy - ly) < step * 0.6 for qx, qy in occupied.get(key, [])):
                            lamps.append([lx, ly])
                            for kx in (key[0] - 1, key[0], key[0] + 1):
                                for ky in (key[1] - 1, key[1], key[1] + 1):
                                    occupied.setdefault((kx, ky), []).append((lx, ly))
                        break
                side = -side
                pos += step
            acc = pos - seg

    # apagados: semillas al azar y, por cada una, de 1 a 4 vecinos más cercanos (grupos de 2 a 5)
    lrng = np.random.default_rng(9)
    L = np.array(lamps) if lamps else np.zeros((0, 2))
    on = np.ones(len(L), dtype=bool)
    n_groups = max(1, len(L) // 60)
    for seed in lrng.choice(len(L), size=min(n_groups, len(L)), replace=False):
        # que un grupo nuevo no quede pegado a otro ya apagado (si no, se juntan en uno de más de 5)
        if (~on).any() and np.min(np.hypot(L[~on, 0] - L[seed, 0], L[~on, 1] - L[seed, 1])) < 40:
            continue
        size = int(lrng.choice([2, 3, 4, 5], p=[0.35, 0.3, 0.25, 0.1]))
        d = np.hypot(L[:, 0] - L[seed, 0], L[:, 1] - L[seed, 1])
        for j in np.argsort(d)[:size]:
            if d[j] < 15:  # solo vecinos de verdad (menos de 45 m)
                on[j] = False
    # un apagado solitario no cuenta como grupo: se vuelve a encender
    for j in np.flatnonzero(~on):
        others = np.flatnonzero(~on)
        others = others[others != j]
        if not len(others) or np.min(np.hypot(L[others, 0] - L[j, 0], L[others, 1] - L[j, 1])) >= 15:
            on[j] = True
    # se guardan en décimas de tile: x, y, encendido
    pois['lamps'] = [[int(round(x * 10)), int(round(y * 10)), int(o)] for (x, y), o in zip(L.tolist(), on.tolist())]
    print(f'postes de luz: {len(L)}, apagados: {int((~on).sum())} en ~{n_groups} grupos')

    # 9d) nombres de calles: polilíneas simplificadas (en medios tiles) para saber en qué calle estás
    names, streets = [], []
    name_idx = {}
    for e in els:
        t = e.get('tags', {})
        if e['type'] != 'way' or t.get('highway') not in ROAD_WIDTH_M or not t.get('name'):
            continue
        nm = t['name'].strip()
        if nm not in name_idx:
            name_idx[nm] = len(names)
            names.append(nm)
        flat_pts = []
        for p_ in e['geometry']:
            x, y = xy(p_)
            flat_pts += [int(round(x * 2)), int(round(y * 2))]
        streets.append([name_idx[nm], flat_pts])
    pois['streetNames'] = names
    pois['streets'] = streets
    print(f'calles con nombre: {len(names)} nombres, {len(streets)} tramos')

    # 10) RLE: pares (valor, largo) con largo en varint
    flat = a.astype(np.uint8).ravel()
    out = bytearray()
    i, n = 0, flat.size
    change = np.flatnonzero(np.diff(flat)) + 1
    starts = np.concatenate([[0], change])
    ends = np.concatenate([change, [n]])
    for s, e_ in zip(starts, ends):
        out.append(int(flat[s]))
        L = int(e_ - s)
        while True:
            b = L & 0x7F
            L >>= 7
            if L:
                out.append(b | 0x80)
            else:
                out.append(b)
                break
    payload = {
        'w': W, 'h': H, 'tileM': TILE_M,
        'bbox': [S, Wl, N, E],
        'pois': pois,
        'rle': base64.b64encode(bytes(out)).decode('ascii'),
    }
    with open(out_js, 'w', encoding='utf-8') as f:
        f.write('// Generado por tools/build_map.py a partir de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL).\n')
        f.write('window.HMO_MAP = ' + json.dumps(payload) + ';\n')

    vals, cnt = np.unique(a, return_counts=True)
    inv = {v: k for k, v in T.items()}
    print(f'mapa {W}x{H} tiles ({W*TILE_M:.0f} x {H*TILE_M:.0f} m), rle {len(out)/1024:.0f} KB')
    for v, c in zip(vals, cnt):
        print(f'  {inv.get(int(v), "CERRO" + str(int(v) - 20)):10s} {c/a.size*100:5.1f}%')

    if out_png:
        pal = {
            0: (214, 196, 170), 1: (74, 76, 86), 2: (240, 196, 70), 3: (232, 224, 210), 4: (104, 106, 116),
            5: (226, 208, 178), 6: (128, 184, 108), 7: (96, 160, 110), 8: (220, 200, 160), 9: (90, 160, 200),
            30: (196, 112, 84), 31: (196, 112, 84), 32: (196, 112, 84), 33: (196, 112, 84), 17: (190, 96, 72), 18: (220, 60, 60), 11: (226, 214, 190), 12: (150, 120, 100), 13: (206, 170, 120), 14: (60, 120, 70),
            15: (40, 110, 70), 16: (196, 150, 100),
            20: (200, 150, 100), 21: (190, 138, 90), 22: (178, 126, 82), 23: (166, 114, 74), 24: (154, 102, 66),
        }
        rgb = np.zeros(a.shape + (3,), dtype=np.uint8)
        for v, c in pal.items():
            rgb[a == v] = c
        Image.fromarray(rgb).save(out_png)


if __name__ == '__main__':
    main(*sys.argv[1:])
