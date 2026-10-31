/**
 * El código de acceso (igual que forge, AJ1): exactamente 6 caracteres: letras, números y signos
 * (ASCII visible, sin espacios); distingue mayúsculas.
 */

export const ACCESS_CODE_LENGTH = 6;

/** Las casillas se agrupan 4 – 2. */
export const ACCESS_CODE_GROUPS = Object.freeze([4, 2]);

const CODE_CHAR = /^[\x21-\x7E]$/;

/** ¿Es un carácter que puede ir en un código? */
export const isAccessCodeChar = (ch) => CODE_CHAR.test(ch);

/** ¿Está completo y bien formado? */
export const isValidAccessCode = (code) =>
  typeof code === 'string' && code.length === ACCESS_CODE_LENGTH && [...code].every(isAccessCodeChar);

/** Lo que se escribió o pegó, sin lo que no puede ir y cortado a 6. */
export const cleanAccessCode = (raw) =>
  [...String(raw ?? '')].filter(isAccessCodeChar).slice(0, ACCESS_CODE_LENGTH).join('');
