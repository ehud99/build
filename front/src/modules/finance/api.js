import { api } from '@/lib/api.js';

/** Rutas de Finanzas (docs/contrato-finanzas.md). Los montos van y vienen como texto. */

export async function fetchSettings() {
  return (await api.get('/finance/settings')).data;
}

export async function saveSettings(body) {
  return (await api.put('/finance/settings', body)).data;
}

/** Todas las categorías (también las archivadas, con `archived`). */
export async function fetchCategories() {
  return (await api.get('/finance/categories')).data;
}

export async function createCategory(body) {
  return (await api.post('/finance/categories', body)).data;
}

export async function updateCategory(id, body) {
  return (await api.patch(`/finance/categories/${id}`, body)).data;
}

export async function deleteCategory(id) {
  await api.delete(`/finance/categories/${id}`);
}

/**
 * La libreta del mes: `{month, today, currency, totals: {income, expense, net}, days: [{date,
 * income, expense, net, transactions}]}`, con los filtros `{month, kind, category_id}`.
 */
export async function fetchLedger(params) {
  return (await api.get('/finance/ledger', { params })).data;
}

export async function createTransaction(body) {
  return (await api.post('/finance/transactions', body)).data;
}

export async function updateTransaction(id, body) {
  return (await api.patch(`/finance/transactions/${id}`, body)).data;
}

export async function deleteTransaction(id) {
  await api.delete(`/finance/transactions/${id}`);
}
