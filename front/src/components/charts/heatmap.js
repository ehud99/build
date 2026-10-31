/**
 * Mapa de calor del año tipo GitHub: una columna por semana (de lunes a domingo) y una fila por
 * día. Funciones puras con fechas `YYYY-MM-DD` en UTC (sin la zona del navegador).
 */

const DAY_MS = 86_400_000;

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `'2026-11-03'` → milisegundos UTC. */
export const toUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Milisegundos UTC → `'2026-11-03'`. */
export const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Día de la semana con el lunes en 0 y el domingo en 6. */
export const weekdayMon = (iso) => (new Date(toUtc(iso)).getUTCDay() + 6) % 7;

/**
 * Nivel de un día (0 a 4) por el % de objetivos cumplidos: 0 nada; 1 hasta 25 %; 2 hasta 50 %;
 * 3 hasta 75 %; 4 más. En enteros (`done × 4` contra `goals × k`), sin redondeos.
 */
export function heatLevel(done, goals) {
  if (!goals || done <= 0) return 0;
  const scaled = done * 4;
  if (scaled <= goals) return 1;
  if (scaled <= goals * 2) return 2;
  if (scaled <= goals * 3) return 3;
  return 4;
}

/** Los tramos de la leyenda, de menos a más. */
export const HEAT_LEGEND = [
  { level: 0, label: '0 %' },
  { level: 1, label: 'Hasta 25 %' },
  { level: 2, label: 'Hasta 50 %' },
  { level: 3, label: 'Hasta 75 %' },
  { level: 4, label: 'Más de 75 %' },
];

/**
 * La cuadrícula del año: `{weeks, cells, months}`.
 * - `cells`: un día por elemento, `{date, col, row, data}` (`data` es la fila del servidor o `null`).
 * - `months`: `{label, col}` en la columna de la primera semana que contiene su día 1.
 */
export function yearGrid(year, days = []) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = Date.UTC(year, 0, 1);
  const last = Date.UTC(year, 11, 31);
  const offset = weekdayMon(toIso(first));
  const cells = [];
  const months = [];
  for (let ms = first; ms <= last; ms += DAY_MS) {
    const date = toIso(ms);
    const index = Math.round((ms - first) / DAY_MS) + offset;
    const cell = { date, col: Math.floor(index / 7), row: index % 7, data: byDate.get(date) ?? null };
    cells.push(cell);
    if (date.endsWith('-01')) months.push({ label: MONTHS_SHORT[Number(date.slice(5, 7)) - 1], col: cell.col });
  }
  return { weeks: cells[cells.length - 1].col + 1, cells, months };
}

/** Índice de la celda que se mueve con las flechas: ←/→ una semana, ↑/↓ un día. */
export function moveCell(index, key, count) {
  const delta = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[key];
  if (delta === undefined) return index;
  if (index < 0) return 0;
  const next = index + delta;
  return next < 0 || next >= count ? index : next;
}

/** `'2026-11-03'` → «mar 3 nov 2026». */
export function heatDateLabel(iso) {
  const names = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const day = Number(iso.slice(8, 10));
  return `${names[weekdayMon(iso)]} ${day} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** El texto de un día para el globo y el lector de pantalla: «2 de 3 · 67 %» o «Sin objetivos». */
export function heatValue(cell) {
  if (!cell?.data) return 'Sin objetivos';
  const { done, goals } = cell.data;
  return `${done} de ${goals} · ${Math.round((done * 100) / goals)}\u00a0%`;
}
