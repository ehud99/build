/**
 * Geometría de la dona (sin dinero: solo las fracciones `share` que da el servidor). Cada tramo
 * es `{start, length}` en una circunferencia de largo 100 (`pathLength="100"` del SVG), con un
 * pequeño hueco entre tramos cuando hay más de uno.
 */
export const DONUT_GAP = 0.8;

export function donutSegments(items, gap = DONUT_GAP) {
  const shares = items.map((i) => Math.max(0, Number(i.share) || 0));
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];
  const visible = shares.filter((s) => s > 0).length;
  const useGap = visible > 1 ? gap : 0;
  let cursor = 0;
  return shares.map((share, index) => {
    // Las fracciones se reescalan a 100 para que el último tramo cierre el anillo.
    const start = (cursor / sum) * 100;
    cursor += share;
    const end = (cursor / sum) * 100;
    const raw = end - start;
    const length = raw > useGap * 2 ? raw - useGap : Math.min(raw, Math.max(raw * 0.5, 0.2));
    return { index, start, length: share > 0 ? length : 0 };
  });
}
