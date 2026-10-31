import { api } from '@/lib/api.js';

/**
 * Datos del Dashboard (docs/contrato-dashboard.md). Lee las rutas de objetivos y las de Finanzas
 * que no cambian (`/finance/summary` y `/finance/settings`); no importa otros módulos.
 */

/** Estadísticas del mes (`YYYY-MM`; sin mes, el actual del servidor). */
export async function fetchStats(month) {
  return (await api.get('/goals/stats', { params: month ? { month } : {} })).data;
}

/** Mapa de calor del año. */
export async function fetchHeatmap(year) {
  return (await api.get('/goals/heatmap', { params: year ? { year } : {} })).data;
}

/** `{currency, currencies, today}`. */
export async function fetchFinanceSettings() {
  return (await api.get('/finance/settings')).data;
}

/** `{balance, total, currency, categories}` de gastos o ingresos entre dos días (incluidos). */
export async function fetchFinanceSummary(kind, from, to) {
  return (await api.get('/finance/summary', { params: { kind, from, to } })).data;
}
