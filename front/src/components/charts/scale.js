/**
 * Escalas de los gráficos (SVG a mano). Funciones puras, con pruebas en `scale.test.js`.
 * Los valores llegan como números ya contados (marcas, medias horas o porcentajes): nunca dinero.
 */

/** Un máximo «redondo» para el eje: `7` → `8`, `13` → `15`, `0` → `1`. */
export function niceMax(value, minimum = 1) {
  const v = Math.max(minimum, Number(value) || 0);
  const power = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * power >= v - 1e-9) return step * power;
  }
  return 10 * power;
}

/**
 * Marcas del eje Y de 0 a `max` en `count` tramos iguales, solo si salen enteras o en medios
 * (`(8, 4)` → `[0, 2, 4, 6, 8]`). Si un tramo no sale limpio, se prueba con menos.
 * Con `integer` (objetivos, no medios): pasos de 1, 2, 5, 10… con a lo más 5 tramos, sin pasar
 * de `max` (`7` → `[0, 2, 4, 6]`).
 */
export function ticks(max, count = 4, { integer = false } = {}) {
  if (integer) {
    let step = 1;
    for (let power = 1; max / step > 5; power *= 10) {
      step = [1, 2, 5, 10].map((m) => m * power).find((s) => max / s <= 5) ?? 10 * power;
    }
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  }
  for (let n = count; n >= 1; n -= 1) {
    const step = max / n;
    if (Number.isInteger(step * 2)) return Array.from({ length: n + 1 }, (_, i) => i * step);
  }
  return [0, max];
}

/**
 * Columnas en una banda de `width` px: cada una ocupa su franja y la barra, centrada, mide hasta
 * `maxBar` (24 px) y deja al menos `gap` (2 px) de aire. Devuelve `{slot, bar, x(i)}`.
 */
export function bandLayout(count, width, { maxBar = 24, gap = 2, ratio = 0.62 } = {}) {
  const slot = count > 0 ? width / count : width;
  const bar = Math.max(1, Math.min(maxBar, slot * ratio, slot - gap));
  return { slot, bar, x: (i) => i * slot + (slot - bar) / 2 };
}

/**
 * La columna como `path`: esquinas de 4 px arriba (el extremo del dato) y cuadrada en la base.
 * Con poca altura el radio se achica para no salirse.
 */
export function columnPath(x, baseline, width, height, radius = 4) {
  if (height <= 0) return '';
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const top = baseline - height;
  return [
    `M${x},${baseline}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + width - r}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `V${baseline}`,
    'Z',
  ].join('');
}

/** La barra horizontal desde la izquierda: extremo derecho redondeado, base cuadrada. */
export function barPath(x, y, length, thickness, radius = 4) {
  if (length <= 0) return '';
  const r = Math.max(0, Math.min(radius, thickness / 2, length));
  const end = x + length;
  return [
    `M${x},${y}`,
    `H${end - r}`,
    `Q${end},${y} ${end},${y + r}`,
    `V${y + thickness - r}`,
    `Q${end},${y + thickness} ${end - r},${y + thickness}`,
    `H${x}`,
    'Z',
  ].join('');
}

/** Índice siguiente con las flechas (para recorrer las marcas con el teclado), sin salirse. */
export function stepIndex(index, key, count) {
  if (count <= 0) return -1;
  const from = index < 0 ? (key === 'ArrowLeft' || key === 'End' ? count : -1) : index;
  if (key === 'ArrowRight') return Math.min(count - 1, from + 1);
  if (key === 'ArrowLeft') return Math.max(0, from - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return index;
}
