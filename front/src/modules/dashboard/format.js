/**
 * Fechas y textos del Dashboard. Funciones puras (pruebas en `format.test.js`). Los porcentajes y
 * las horas llegan del servidor como texto (`'63.3'`, `'15.5'`) y aquí solo se formatean: no se
 * suma nada en el navegador.
 *
 * Un módulo no importa a otro: lo poco que se parece a `modules/goals/score.js` (nombres de los
 * meses, mes anterior y siguiente, niveles de racha) se repite aquí.
 */

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Iniciales de lunes a domingo (como la hoja de papel) y sus nombres para el lector de pantalla. */
export const WEEKDAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** `'2026-11'` → `'Noviembre 2026'`. */
export function monthLabel(month) {
  const [year, m] = String(month).split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

/** `'2026-11'` → `'noviembre'`; un mes inválido (aún sin cargar) → `'el mes'`. */
export const monthName = (month) => MONTH_NAMES[Number(String(month ?? '').slice(5, 7)) - 1]?.toLowerCase() ?? 'el mes';

/** Mes anterior (`-1`) o siguiente (`1`): `('2026-01', -1)` → `'2025-12'`. */
export function shiftMonth(month, delta) {
  const [year, m] = String(month).split('-').map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Primer y último día del mes como `YYYY-MM-DD` (para el resumen de Finanzas). */
export function monthBounds(month) {
  const [year, m] = String(month).split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** `'63.3'` → `'63,3 %'`; `null` → `'—'`. Un entero termina en `,0` como lo manda el servidor. */
export const percentLabel = (text) => (text == null ? '—' : `${String(text).replace('.', ',')}\u00a0%`);

/** `'63.3'` → `'63,3'` (el número sin el signo de %, para el anillo). */
export const decimalLabel = (text) => (text == null ? '—' : String(text).replace('.', ','));

/**
 * La diferencia con el mes anterior en puntos: `'5.2'` → `{dir: 'up', text: '+5,2'}`,
 * `'-1.2'` → `{dir: 'down', text: '−1,2'}`, `'0.0'` → `{dir: 'flat', text: '0,0'}`; `null` → `null`.
 */
export function deltaParts(text) {
  if (text == null) return null;
  const raw = String(text);
  const negative = raw.startsWith('-');
  const body = (negative ? raw.slice(1) : raw).replace('.', ',');
  if (/^0(,0*)?$/.test(body)) return { dir: 'flat', text: body };
  return negative ? { dir: 'down', text: `−${body}` } : { dir: 'up', text: `+${body}` };
}

/** Horas del servidor para mostrar: `'15.5'` → `'15,5'`; `null` → `'—'`. */
export const hoursLabel = (text) => (text == null ? '—' : String(text).replace('.', ','));

/** Las horas como número para dibujar la barra (`'8.5'` → `8.5`): solo geometría, nunca sumas. */
export const hoursValue = (text) => {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Semana de las horas: `{start_day: 2, end_day: 8}` de noviembre → `'2–8 nov'`; un día → `'1 nov'`. */
export function weekLabel(week, month) {
  const short = MONTHS_SHORT[Number(String(month).slice(5, 7)) - 1];
  return week.start_day === week.end_day
    ? `${week.start_day} ${short}`
    : `${week.start_day}–${week.end_day} ${short}`;
}

/** `1` → `'1 día'`, `3` → `'3 días'`. */
export const daysLabel = (n) => (n === 1 ? '1 día' : `${n} días`);

/** Umbrales de los niveles de racha (los mismos de Objetivos): 1–6 → 0, 7 → 1, 14 → 2, 21 → 3, 30 → 4. */
export const STREAK_LEVELS = Object.freeze([7, 14, 21, 30]);
export const streakLevel = (n) => STREAK_LEVELS.filter((min) => n >= min).length;

/** Etiquetas del eje X de los días: 1, 5, 10, 15, 20, 25 y el último. */
export function dayTicks(days) {
  const out = [1];
  for (let d = 5; d < days - 1; d += 5) out.push(d);
  if (days > 1) out.push(days);
  return out;
}
