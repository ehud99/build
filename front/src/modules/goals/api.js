import { api } from '@/lib/api.js';

/** Rutas de objetivos (docs/contrato.md). Todas devuelven los datos ya sin el envoltorio de axios. */

/** `Month` de `YYYY-MM`; sin mes, el actual del servidor. */
export async function fetchMonth(month) {
  const { data } = await api.get('/goals', { params: month ? { month } : {} });
  return data;
}

/** Crea un objetivo en el mes. Devuelve el `Goal`. */
export async function createGoal(month, title) {
  const { data } = await api.post('/goals', { month, title });
  return data;
}

/** Cambia el título. Devuelve el `Goal`. */
export async function renameGoal(id, title) {
  const { data } = await api.patch(`/goals/${id}`, { title });
  return data;
}

/** Borra el objetivo. */
export async function deleteGoal(id) {
  await api.delete(`/goals/${id}`);
}

/** Marca o desmarca el día de hoy. Devuelve el `Goal`. */
export async function setCheck(id, day, done) {
  const { data } = await api.put(`/goals/${id}/checks/${day}`, { done });
  return data;
}

/** Copia los títulos del mes anterior a un mes vacío. Devuelve el `Month`. */
export async function copyPrevious(month) {
  const { data } = await api.post('/goals/copy-previous', { month });
  return data;
}

/** Horas trabajadas de hoy (`'8.5'`; `'0'` las borra). Devuelve `{month, day, hours, total_hours}`. */
export async function setWorkHours(day, hours) {
  const { data } = await api.put(`/goals/work-hours/${day}`, { hours });
  return data;
}
