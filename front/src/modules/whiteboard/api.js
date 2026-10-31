import { api } from '@/lib/api.js';

/** Rutas de la pizarra (docs/contrato-pizarra.md). Todas devuelven los datos sin el envoltorio de axios. */

/** Las pizarras (resúmenes para las cards, sin la escena), de la última editada a la primera. */
export async function fetchBoards() {
  const { data } = await api.get('/whiteboards');
  return data;
}

/** La pizarra completa: `elements`, `app_state` y `files`. */
export async function fetchBoard(id) {
  const { data } = await api.get(`/whiteboards/${id}`);
  return data;
}

/** Crea una pizarra (`{name?, elements?, app_state?, files?}`). */
export async function createBoard(body = {}) {
  const { data } = await api.post('/whiteboards', body);
  return data;
}

/** Cambia `name`, `elements`, `app_state`, `files` o `thumbnail` (data URL PNG/WebP o `null`). */
export async function updateBoard(id, body) {
  const { data } = await api.patch(`/whiteboards/${id}`, body);
  return data;
}

/** Una copia con el nombre «Copia de …». */
export async function duplicateBoard(id) {
  const { data } = await api.post(`/whiteboards/${id}/duplicate`);
  return data;
}

export async function deleteBoard(id) {
  await api.delete(`/whiteboards/${id}`);
}

/**
 * El último guardado al cerrar la pestaña: `fetch` con `keepalive` (sobrevive a la descarga de la
 * página) si el cuerpo entra en su tope de 64 KB; si no, un PATCH normal que puede no llegar.
 */
export function updateBoardOnExit(id, body) {
  const json = JSON.stringify(body);
  if (json.length < 60_000) {
    fetch(`/api/whiteboards/${id}`, {
      method: 'PATCH',
      body: json,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
    return;
  }
  updateBoard(id, body).catch(() => {});
}
