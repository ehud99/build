/**
 * Cuadros del cambio de tema con glitch (funciones puras, sin DOM ni CSS: las prueba
 * `glitch.test.js` con `node --test`). Las usa `glitch.js`.
 *
 * Todo se calcula una sola vez antes de empezar y lo anima el navegador con pasos
 * bruscos (`steps(1, end)` entre cuadros): no hay JS por cuadro. El azar entra por
 * `rand` (una función que devuelve [0, 1)), así una semilla da siempre el mismo glitch.
 *
 * Cada cuadro trae:
 * - `clip`: el `clip-path: polygon()` del tema nuevo, que aparece por franjas
 *   horizontales de alturas al azar con cortes a izquierda y derecha. Todos los
 *   polígonos tienen el mismo número de puntos (`CLIP_BANDS × 7`); el último cubre
 *   toda la pantalla.
 * - `newX`, `oldX`: saltos de `translateX` de la vista nueva y de la vieja.
 * - `newFx`, `oldFx`: el filtro SVG de cada vista en ese cuadro: `split` (px que se
 *   separan el rojo y el azul, con signo) y `bands`, franjas `{ y, h, dx }` que se
 *   desplazan `dx` px (`feDisplacementMap`). Sin nada que hacer, `null` (sin filtro).
 * - `noise`: `{ opacity, x, y }` de la capa de estática (0 = apagada).
 */

/** Duración total: 650 ms. */
export const GLITCH_MS = 650;
/** Cuadros clave (el último es el tema nuevo limpio). ~50 ms cada uno. */
export const GLITCH_FRAMES = 14;
/** Franjas del recorte del tema nuevo (cada una son 7 puntos del polígono). */
export const CLIP_BANDS = 12;
/** Franjas desplazadas por el filtro de cada vista. */
export const SHIFT_BANDS = 9;
export const POINTS_PER_BAND = 7;
/** Lado (px en pantalla) del mosaico de estática; `noise.x`, `noise.y` van de 0 a este valor. */
export const NOISE_TILE = 384;

/** PRNG con semilla (mulberry32): mismo `seed`, misma secuencia en [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Parte `[0, total]` en `count` tramos contiguos de alturas al azar (enteros, sin
 * huecos, el último llega a `total`). Los pesos al cuadrado dan franjas finas y gruesas.
 */
export function splitRange(total, count, rand) {
  const weights = [];
  for (let i = 0; i < count; i += 1) weights.push(0.06 + rand() ** 2);
  const sum = weights.reduce((s, x) => s + x, 0);
  const out = [];
  let y = 0;
  let acc = 0;
  for (let i = 0; i < count; i += 1) {
    acc += weights[i];
    const next = i === count - 1 ? total : Math.round((acc / sum) * total);
    out.push({ y, h: next - y });
    y = next;
  }
  return out;
}

/**
 * `clip-path: polygon()` de la unión de rectángulos `{ l, r, a, b }` (x de `l` a `r`,
 * y de `a` a `b`), en un solo polígono: un «peine» con el lomo en x = 0. Cada franja
 * son 7 puntos: del lomo a la esquina, el rectángulo en sentido horario y vuelta al
 * lomo. Las idas y vueltas por el mismo segmento no encierran área (regla nonzero), así
 * lo que queda entre franjas y a la izquierda de `l` no se ve. Una franja vacía
 * (`a == b`) son 7 puntos repetidos: mantiene la cuenta para que todos los cuadros
 * tengan los mismos puntos.
 */
export function bandsPolygon(rects) {
  const pts = [];
  for (const { l, r, a, b } of rects) {
    pts.push([0, a], [l, a], [r, a], [r, b], [l, b], [l, a], [0, a]);
  }
  return `polygon(${pts.map(([x, y]) => `${Math.round(x)}px ${Math.round(y)}px`).join(', ')})`;
}

/** Intensidad del glitch en `t` ∈ [0, 1]: sube rápido, pico a mitad, se apaga al final. */
function intensity(t) {
  if (t >= 1) return 0;
  return Math.sin(Math.PI * Math.min(1, t / 0.92)) ** 0.6;
}

/** Desplazamiento máximo de una franja (px) para un ancho de pantalla. */
export function maxShift(width) {
  return Math.round(clamp(width * 0.07, 24, 120));
}

/** Filtro de una vista en un cuadro de intensidad `k`, o `null` si queda limpia. */
function layerFx(width, height, k, rand) {
  if (k <= 0.02) return null;
  const limit = maxShift(width);
  const bands = splitRange(height, SHIFT_BANDS, rand).map(({ y, h }) => {
    const moves = rand() < 0.2 + 0.55 * k;
    const dx = moves ? Math.round((rand() < 0.5 ? -1 : 1) * limit * k * (0.25 + 0.75 * rand())) : 0;
    return { y, h, dx };
  });
  const splitMax = clamp(width / 90, 6, 18);
  const split = Math.round((rand() < 0.5 ? -1 : 1) * splitMax * k * (0.45 + 0.55 * rand()));
  if (!split && bands.every((b) => !b.dx)) return null;
  return { split, bands: bands.filter((b) => b.dx) };
}

/**
 * Los `GLITCH_FRAMES` cuadros para una pantalla de `width × height` (ver arriba).
 * El tema nuevo va apareciendo por franjas (cada vez más) y en el último cubre todo,
 * sin filtros, sin saltos y sin ruido.
 */
export function glitchFrames(width, height, rand = Math.random) {
  const frames = [];
  const last = GLITCH_FRAMES - 1;
  for (let f = 0; f < GLITCH_FRAMES; f += 1) {
    const t = f / last;
    if (f === last) {
      const full = { l: 0, r: width, a: 0, b: height };
      frames.push({
        clip: bandsPolygon(Array.from({ length: CLIP_BANDS }, () => full)),
        newX: 0,
        oldX: 0,
        newFx: null,
        oldFx: null,
        noise: { opacity: 0, x: 0, y: 0 },
      });
      break;
    }
    const k = clamp(intensity(t) * (0.7 + 0.3 * rand()), 0, 1);
    // Cuánto del tema nuevo se ve: nada al empezar, casi todo en el penúltimo.
    const reveal = f === 0 ? 0 : clamp(t * 1.15 - 0.08 + (rand() - 0.5) * 0.25, 0.05, 0.96);
    const rects = splitRange(height, CLIP_BANDS, rand).map(({ y, h }) => {
      if (rand() >= reveal) return { l: 0, r: 0, a: y, b: y };
      const cut = 0.3 + 0.5 * k;
      const l = rand() < cut ? Math.round(rand() * width * 0.45) : 0;
      const r = rand() < cut ? Math.round(width - rand() * width * 0.45) : width;
      return l < r ? { l, r, a: y, b: y + h } : { l: 0, r: width, a: y, b: y + h };
    });
    const jump = () => (rand() < 0.55 * k ? Math.round((rand() < 0.5 ? -1 : 1) * width * 0.035 * k * (0.4 + 0.6 * rand())) : 0);
    const newX = jump();
    const oldX = jump();
    // Ruido: destellos breves (siempre en el segundo cuadro y cerca del pico).
    const flash = f === 1 || f === Math.round(last * 0.45) || rand() < 0.4 * k;
    const noise = flash
      ? { opacity: Math.round((0.3 + 0.35 * rand() * Math.max(k, 0.5)) * 100) / 100, x: Math.round(rand() * NOISE_TILE), y: Math.round(rand() * NOISE_TILE) }
      : { opacity: 0, x: 0, y: 0 };
    frames.push({
      clip: bandsPolygon(rects),
      newX,
      oldX,
      newFx: layerFx(width, height, k, rand),
      oldFx: layerFx(width, height, k, rand),
      noise,
    });
  }
  return frames;
}

/**
 * El `<filter>` SVG de una vista en un cuadro (texto, sin DOM). En sRGB para que los
 * colores del mapa de desplazamiento se lean tal cual.
 *
 * - Franjas: un mapa gris (128 = quieto) con un `feFlood` por franja en su subregión,
 *   de rojo `128 + dx / scale × 255`; `feDisplacementMap` lee el rojo y corre esa franja
 *   `dx` px. Así las franjas se ven desplazadas de verdad (no solo recortadas) sin
 *   duplicar la vista.
 * - RGB split: tres `feColorMatrix` aíslan cada canal, el rojo y el azul se corren
 *   `±split` px (`feOffset`) y se vuelven a sumar (`feComposite arithmetic`).
 *   `drop-shadow` no sirve: la foto de la página es opaca y la sombra quedaría debajo.
 */
export function glitchFilterMarkup(id, fx, width, height) {
  const scale = maxShift(width) * 2;
  const parts = [];
  let src = 'SourceGraphic';
  if (fx.bands.length) {
    parts.push(`<feFlood flood-color="rgb(128,128,128)" x="0" y="0" width="${width}" height="${height}" result="m"/>`);
    const merge = ['<feMergeNode in="m"/>'];
    fx.bands.forEach(({ y, h, dx }, i) => {
      const red = clamp(Math.round(128 + (dx / scale) * 255), 0, 255);
      parts.push(`<feFlood flood-color="rgb(${red},128,128)" x="0" y="${y}" width="${width}" height="${h}" result="b${i}"/>`);
      merge.push(`<feMergeNode in="b${i}"/>`);
    });
    parts.push(`<feMerge result="map">${merge.join('')}</feMerge>`);
    parts.push(`<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>`);
    src = 'd';
  }
  if (fx.split) {
    parts.push(
      `<feColorMatrix in="${src}" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>`,
      `<feOffset in="r" dx="${fx.split}" dy="0" result="r2"/>`,
      `<feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>`,
      `<feColorMatrix in="${src}" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>`,
      `<feOffset in="b" dx="${-fx.split}" dy="0" result="b2"/>`,
      '<feComposite in="r2" in2="g" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg"/>',
      '<feComposite in="rg" in2="b2" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>',
    );
  }
  return (
    `<filter id="${id}" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse" ` +
    `primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${parts.join('')}</filter>`
  );
}
