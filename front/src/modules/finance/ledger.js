/**
 * Lo puro de la libreta de Finanzas: meses `YYYY-MM`, días `YYYY-MM-DD` (calculados en UTC, sin la
 * hora local del navegador; «hoy» lo da el servidor en `APP_TIMEZONE`) y montos con signo. Los
 * montos siguen siendo texto: aquí solo se les pone el signo, nunca se suman.
 */
// Ruta relativa (no `@/`): las pruebas corren con `node --test`, sin el alias de Vite.
import { formatMoney } from '../../components/money/money.js';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MS_DAY = 86_400_000;

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** `'2026-10-31'` → `Date` en UTC (o `null` si no es un día válido). */
export function parseDay(text) {
  const m = DAY_RE.exec(text ?? '');
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCDate() === Number(m[3]) && date.getUTCMonth() === Number(m[2]) - 1 ? date : null;
}

export const isDay = (text) => parseDay(text) !== null;

/** `'2026-10'` si es un mes válido del 2000 al 2100 (como el servidor); si no, `null`. */
export function parseMonth(text) {
  const m = MONTH_RE.exec(text ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  return year >= 2000 && year <= 2100 ? text : null;
}

/** El mes de un día: `'2026-10-31'` → `'2026-10'`. */
export const monthOf = (day) => day.slice(0, 7);

/** `'2026-10'` ± `delta` meses (`'2026-12'` + 1 → `'2027-01'`). */
export function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** `'2026-10'` → `'Octubre 2026'`. */
export function monthLabel(month) {
  const [year, m] = month.split('-').map(Number);
  return `${capitalize(MONTHS[m - 1])} ${year}`;
}

/** `'octubre'`, para los textos («Sin movimientos en octubre»). */
export const monthName = (month) => MONTHS[Number(month.slice(5, 7)) - 1];

/**
 * El encabezado de un día de la lista: `'Hoy'`, `'Ayer'`, `'Mañana'` o `'Jueves, 29 de octubre'`
 * (con el año si no es el de hoy).
 */
export function dayHeading(day, today) {
  const d = parseDay(day);
  const diff = Math.round((d - parseDay(today)) / MS_DAY);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff === 1) return 'Mañana';
  const base = `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
  return day.slice(0, 4) === today.slice(0, 4) ? base : `${base} de ${d.getUTCFullYear()}`;
}

const isZero = (text) => /^-?0+(\.0+)?$/.test(String(text ?? '0'));

/**
 * Un monto con su signo delante: `'+12,00 S/'`, `'−12,00 S/'` (el signo menos tipográfico) o
 * `'0,00 S/'`. `sign` fuerza el signo (`'+'` para un ingreso, `'-'` para un gasto); sin él, el del
 * texto (el neto, que puede ser negativo).
 */
export function signedMoney(text, currency, sign) {
  const raw = String(text ?? '0');
  const negative = raw.startsWith('-');
  const abs = negative ? raw.slice(1) : raw;
  const formatted = formatMoney(abs, currency);
  if (isZero(abs)) return formatted;
  const minus = sign ? sign === '-' : negative;
  return `${minus ? '−' : '+'}${formatted}`;
}

/** `'positive'`, `'negative'` o `'zero'` del texto de un neto (para elegir el color). */
export function netTone(text) {
  if (isZero(text)) return 'zero';
  return String(text).startsWith('-') ? 'negative' : 'positive';
}
