/** El usuario (docs/contrato.md): 3 a 24 caracteres, minúsculas, números, `.` y `_`. */

export const USERNAME_RE = /^[a-z0-9._]{3,24}$/;

/** Lo escrito como lo guarda el servidor: sin espacios, sin `@` inicial y en minúsculas. */
export const normalizeUsername = (raw) => String(raw ?? '').trim().replace(/^@/, '').toLowerCase();

/** Error del usuario, o `null`. */
export function usernameProblem(raw) {
  const value = normalizeUsername(raw);
  if (!value) return 'Escribe un usuario.';
  if (value.length < 3) return 'Usa al menos 3 caracteres.';
  if (value.length > 24) return 'Usa como máximo 24 caracteres.';
  if (!USERNAME_RE.test(value)) return 'Solo letras, números, punto y guion bajo.';
  return null;
}
