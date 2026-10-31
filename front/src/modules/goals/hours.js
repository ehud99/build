/**
 * Horas trabajadas (docs/contrato.md, «Horas trabajadas»). El servidor las manda como texto
 * (`'8.5'`); aquí se cuentan en medias horas enteras (`17`) para sumar y restar sin decimales.
 */

export const MAX_HALVES = 48;

/** `'8.5'` → `17`; vacío o inválido → `0`. */
export function toHalves(text) {
  const n = Number(String(text ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 2) : 0;
}

/** Medias horas a texto, sin tope: `257` → `'128.5'` (sirve para los totales del mes). */
export function halvesText(halves) {
  const h = Math.max(0, Math.trunc(halves));
  return h % 2 ? `${(h - 1) / 2}.5` : `${h / 2}`;
}

/** Las horas de un día (0 a 24): `17` → `'8.5'`, `16` → `'8'` (el formato que espera el servidor). */
export function fromHalves(halves) {
  return halvesText(Math.min(MAX_HALVES, halves));
}

/** Para mostrar, sin tope: `'8.5'` → `'8,5'`, `'128.5'` → `'128,5'`; vacío o `'0'` → `''`. */
export function formatHours(text) {
  const halves = toHalves(text);
  return halves ? halvesText(halves).replace('.', ',') : '';
}
