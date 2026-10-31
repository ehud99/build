import { api } from '@/lib/api.js';

/** Rutas de notas (docs/contrato-notas.md). Todas devuelven los datos sin el envoltorio de axios. */

/** Las notas (resúmenes para las cards): fijadas primero y luego por la última edición. */
export async function fetchNotes(q) {
  const { data } = await api.get('/notes', { params: q ? { q } : {} });
  return data;
}

/** La nota completa, con su documento de Tiptap (`content`). */
export async function fetchNote(id) {
  const { data } = await api.get(`/notes/${id}`);
  return data;
}

/** Crea una nota (`{content, color?, pinned?}`). Devuelve la nota completa. */
export async function createNote(body) {
  const { data } = await api.post('/notes', body);
  return data;
}

/** Cambia `content`, `color` o `pinned`. Devuelve la nota completa. */
export async function updateNote(id, body) {
  const { data } = await api.patch(`/notes/${id}`, body);
  return data;
}

/** Borra la nota. */
export async function deleteNote(id) {
  await api.delete(`/notes/${id}`);
}
