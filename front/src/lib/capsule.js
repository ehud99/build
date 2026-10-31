/** Tiempos de la cápsula de «Verificar código» (`CapsuleButton.jsx`). */

/** Lo que tarda en terminar de llenarse. */
export const FILL_MS = 260;

/** Pausa entre una letra y la siguiente al borrarse. */
export const LETTER_STEP_MS = 38;

/** Lo que tarda en irse todo el texto. */
export const eraseMs = (label) => String(label).length * LETTER_STEP_MS + 220;
