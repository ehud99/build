/**
 * Puntaje de la hoja de objetivos (docs/contrato.md, «Puntaje»). Funciones puras: el servidor
 * solo manda las marcas (`checked_days`) y el frontend suma.
 */

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** T de una fila: los días marcados del objetivo. */
export function rowTotal(goal) {
  return goal?.checked_days?.length ?? 0;
}

/** Puntaje del día: cuántos objetivos están marcados ese día. */
export function dayScore(goals, day) {
  return (goals ?? []).filter((g) => g.checked_days?.includes(day)).length;
}

/** Puntaje final: todas las marcas del mes. */
export function finalScore(goals) {
  return (goals ?? []).reduce((sum, g) => sum + rowTotal(g), 0);
}

/** Máximo posible: objetivos × días del mes. */
export function maxScore(goals, daysInMonth) {
  return (goals ?? []).length * daysInMonth;
}

/** `'2026-11'` → `'Noviembre 2026'`. */
export function monthLabel(month) {
  const [year, m] = String(month).split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

/** Mes anterior (`delta` -1) o siguiente (`delta` 1): `('2026-01', -1)` → `'2025-12'`. */
export function shiftMonth(month, delta) {
  const [year, m] = String(month).split('-').map(Number);
  const index = year * 12 + (m - 1) + delta;
  const y = Math.floor(index / 12);
  const mm = (index % 12) + 1;
  return `${y}-${String(mm).padStart(2, '0')}`;
}

/**
 * Rachas: días seguidos marcados. La de una casilla marcada es la cantidad de días seguidos que
 * terminan en ella (el primer día de una racha vale 1). Cuentan dentro del mes del objetivo.
 */

/** Umbrales de los niveles de racha: 1–6 → 0, 7–13 → 1, 14–20 → 2, 21–29 → 3, 30+ → 4. */
export const STREAK_LEVELS = Object.freeze([7, 14, 21, 30]);

/** `{día: racha}` de cada día marcado. */
export function streaksByDay(checkedDays) {
  const days = [...new Set(checkedDays ?? [])].sort((a, b) => a - b);
  const out = {};
  for (const day of days) out[day] = (out[day - 1] ?? 0) + 1;
  return out;
}

/** Nivel de una racha de `n` días (0 no resalta; 4 desde 30 días). */
export function streakLevel(n) {
  return STREAK_LEVELS.filter((min) => n >= min).length;
}

/**
 * Racha viva de un objetivo: la que termina hoy o, si hoy aún no se marcó, la que terminó ayer.
 * `today` es el número del día (o `null` si no es el mes actual: entonces 0).
 */
export function currentStreak(goal, today) {
  if (!today) return 0;
  const streaks = streaksByDay(goal?.checked_days);
  return streaks[today] ?? streaks[today - 1] ?? 0;
}

/** ¿Marcó todos los días del mes? */
export function fullMonth(goal, daysInMonth) {
  return daysInMonth > 0 && new Set(goal?.checked_days ?? []).size >= daysInMonth;
}

/** Número del día de `today` (`'2026-11-03'`) si cae en `month`; si no, `null`. */
export function todayDay(month, today) {
  if (!month || !today) return null;
  if (String(today).slice(0, 7) !== month) return null;
  return Number(String(today).slice(8, 10));
}
