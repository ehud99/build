/**
 * Fechas y periodos de Finanzas, puros (sin la hora local del navegador): los días van como texto
 * `YYYY-MM-DD` y se calculan en UTC. «Hoy» lo da el servidor (`settings.today`, en `APP_TIMEZONE`).
 * La semana empieza el lunes.
 *
 * Un periodo es `{ mode, anchor, from, to }`: `mode` es `day | week | month | year | range`;
 * `anchor` es un día dentro del periodo; `from`/`to` solo cuentan en `range`.
 */

export const MODES = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
  { key: 'range', label: 'Período' },
];

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DAY = 86_400_000;

/** `'2026-10-31'` → `Date` en UTC (o `null` si no es un día válido). */
export function parseDay(text) {
  const m = DAY_RE.exec(text ?? '');
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.getUTCDate() === Number(m[3]) && date.getUTCMonth() === Number(m[2]) - 1 ? date : null;
}

/** `Date` (UTC) → `'2026-10-31'`. */
export function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

export const isDay = (text) => parseDay(text) !== null;

export function addDays(text, n) {
  return formatDay(new Date(parseDay(text).getTime() + n * MS_DAY));
}

/** Días entre dos fechas (`to - from`). */
export function daysBetween(from, to) {
  return Math.round((parseDay(to) - parseDay(from)) / MS_DAY);
}

/** Lunes de la semana del día. */
export function weekStart(text) {
  const weekday = parseDay(text).getUTCDay(); // 0 = domingo
  return addDays(text, -((weekday + 6) % 7));
}

function lastOfMonth(year, month0) {
  return new Date(Date.UTC(year, month0 + 1, 0));
}

/** `{from, to}` del periodo (los dos incluidos). */
export function periodRange(period) {
  const { mode, anchor } = period;
  const d = parseDay(anchor);
  switch (mode) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const from = weekStart(anchor);
      return { from, to: addDays(from, 6) };
    }
    case 'month':
      return {
        from: formatDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))),
        to: formatDay(lastOfMonth(d.getUTCFullYear(), d.getUTCMonth())),
      };
    case 'year':
      return { from: `${d.getUTCFullYear()}-01-01`, to: `${d.getUTCFullYear()}-12-31` };
    case 'range': {
      const [from, to] = period.from <= period.to ? [period.from, period.to] : [period.to, period.from];
      return { from, to };
    }
    default:
      throw new Error(`Periodo desconocido: ${mode}`);
  }
}

/** Mueve el periodo `delta` pasos (‹ = -1, › = +1). Un rango propio se corre su propio largo. */
export function shiftPeriod(period, delta) {
  const { mode, anchor } = period;
  const d = parseDay(anchor);
  switch (mode) {
    case 'day':
      return { ...period, anchor: addDays(anchor, delta) };
    case 'week':
      return { ...period, anchor: addDays(anchor, 7 * delta) };
    case 'month': {
      const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
      const last = lastOfMonth(first.getUTCFullYear(), first.getUTCMonth()).getUTCDate();
      first.setUTCDate(Math.min(d.getUTCDate(), last));
      return { ...period, anchor: formatDay(first) };
    }
    case 'year': {
      const year = d.getUTCFullYear() + delta;
      const day = Math.min(d.getUTCDate(), lastOfMonth(year, d.getUTCMonth()).getUTCDate());
      return { ...period, anchor: formatDay(new Date(Date.UTC(year, d.getUTCMonth(), day))) };
    }
    case 'range': {
      const { from, to } = periodRange(period);
      const step = (daysBetween(from, to) + 1) * delta;
      return { ...period, from: addDays(from, step), to: addDays(to, step), anchor: addDays(from, step) };
    }
    default:
      return period;
  }
}

/** Cambia de modo conservando el día de referencia (al pasar a `range`, el periodo de antes). */
export function switchMode(period, mode) {
  if (mode === 'range') {
    const { from, to } = periodRange(period);
    return { mode, anchor: from, from, to };
  }
  const anchor = period.mode === 'range' ? periodRange(period).from : period.anchor;
  return { mode, anchor };
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function shortDay(text, withYear) {
  const d = parseDay(text);
  const base = `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${base} ${d.getUTCFullYear()}` : base;
}

/** `'26 oct – 1 nov'`; con el año si no es el de hoy (`'29 dic 2025 – 4 ene 2026'`). */
export function rangeLabel(from, to, today) {
  const year = today.slice(0, 4);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  if (from === to) return dayLabel(from, today);
  if (sameYear && from.slice(0, 4) === year) return `${shortDay(from)} – ${shortDay(to)}`;
  if (sameYear) return `${shortDay(from)} – ${shortDay(to, true)}`;
  return `${shortDay(from, true)} – ${shortDay(to, true)}`;
}

/** `'Hoy, 31 de octubre'`, `'Ayer, …'`, `'Mañana, …'` o `'Viernes, 30 de octubre'` (con el año si no es el de hoy). */
export function dayLabel(text, today) {
  const d = parseDay(text);
  const base = `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
  const withYear = text.slice(0, 4) === today.slice(0, 4) ? base : `${base} de ${d.getUTCFullYear()}`;
  const diff = daysBetween(today, text);
  const name = diff === 0 ? 'Hoy' : diff === -1 ? 'Ayer' : diff === 1 ? 'Mañana' : WEEKDAYS[d.getUTCDay()];
  return `${name}, ${withYear}`;
}

/** La etiqueta del periodo bajo las pestañas. */
export function periodLabel(period, today) {
  const { from, to } = periodRange(period);
  const d = parseDay(period.anchor);
  switch (period.mode) {
    case 'day':
      return dayLabel(period.anchor, today);
    case 'month':
      return `${capitalize(MONTHS[d.getUTCMonth()])} ${d.getUTCFullYear()}`;
    case 'year':
      return String(d.getUTCFullYear());
    default:
      return rangeLabel(from, to, today);
  }
}

/** Fecha corta de un movimiento en la lista: `'31 oct'` (con el año si no es el de hoy). */
export function shortDate(text, today) {
  return shortDay(text, text.slice(0, 4) !== today.slice(0, 4));
}
