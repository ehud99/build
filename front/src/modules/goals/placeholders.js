/**
 * Recomendaciones en el campo de un objetivo nuevo: los tres primeros proponen un objetivo,
 * desde el cuarto dice «Nuevo objetivo». Muy de vez en cuando (`RARE_CHANCE`) sale el especial.
 */

export const SUGGESTIONS = Object.freeze([
  'Dormir 8 horas',
  'Hacer ejercicios',
  'Menos horas en redes sociales que ayer',
]);

export const DEFAULT_PLACEHOLDER = 'Nuevo objetivo';
export const RARE_PLACEHOLDER = 'Tomar agua';
export const RARE_CHANCE = 0.05;

/** El placeholder del objetivo que sigue cuando el mes ya tiene `count`. `rand` para las pruebas. */
export function goalPlaceholder(count, rand = Math.random) {
  if (rand() < RARE_CHANCE) return RARE_PLACEHOLDER;
  return SUGGESTIONS[count] ?? DEFAULT_PLACEHOLDER;
}
