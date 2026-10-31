import axios from 'axios';

/**
 * Cliente de la API. La sesión va en la cookie `httpOnly` `build_rt` (mismo origen: en
 * desarrollo Vite reenvía `/api` al backend), así que no hay token que guardar.
 *
 * Errores: `{error_code, message, detail}` (docs/contrato.md). `apiError(e)` los normaliza.
 */
export const api = axios.create({ baseURL: '/api', withCredentials: true });

/** `{status, code, message, detail}` de un error de axios (o de red). */
export function apiError(error) {
  const response = error?.response;
  if (!response) {
    return { status: 0, code: 'NETWORK', message: 'No hay conexión con el servidor.', detail: null };
  }
  const data = response.data ?? {};
  return {
    status: response.status,
    code: data.error_code ?? 'ERROR',
    message: data.message ?? 'Algo salió mal.',
    detail: data.detail ?? null,
  };
}
