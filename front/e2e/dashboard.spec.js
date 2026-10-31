import { expect, test } from '@playwright/test';

import { registerUser } from './helpers.js';

/**
 * Dashboard (`/inicio`, docs/contrato-dashboard.md) contra el backend real: el estado vacío de un
 * usuario nuevo y, con objetivos, una marca de hoy, horas y un gasto y un ingreso (puestos con
 * `page.request`, que lleva la cookie de la sesión), los números de cada sección; luego el cambio
 * de mes con ‹ ›.
 */

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const shift = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + m - 1 + delta;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
const label = (month) => MONTHS[Number(month.slice(5)) - 1];

test('usuario nuevo: estados vacíos con sus enlaces', async ({ page }) => {
  await registerUser(page);
  await expect(page.getByTestId('dash-goals-empty')).toBeVisible();
  await expect(page.getByTestId('dash-goals-create')).toHaveAttribute('href', /\/objetivos\?mes=\d{4}-\d{2}$/);
  await expect(page.getByTestId('kpi-commitment-value')).toHaveText('—');
  await expect(page.getByTestId('kpi-delta-value')).toHaveText('—');
  await expect(page.getByTestId('kpi-streaks-value')).toHaveText('0');
  await expect(page.getByTestId('kpi-hours-value')).toHaveText('0');
  await expect(page.getByTestId('dash-hours-empty')).toBeVisible();
  await expect(page.getByTestId('dash-fin-empty')).toBeVisible();
  await expect(page.getByTestId('dash-fin-first')).toHaveAttribute('href', '/finanzas');
  await expect(page.getByTestId('dash-heatmap')).toBeVisible();
  // Sin scroll horizontal de la página.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByTestId('dash-goals-create').click();
  await expect(page).toHaveURL(/\/objetivos\?mes=/);
});

test('números del mes, rachas, horas, finanzas y cambio de mes', async ({ page }) => {
  await registerUser(page);
  const api = page.request;
  const { month, today } = await (await api.get('/api/goals')).json();
  const day = Number(today.slice(8, 10));

  const leer = await (await api.post('/api/goals', { data: { month, title: 'Leer' } })).json();
  await api.post('/api/goals', { data: { month, title: 'Correr' } });
  expect((await api.put(`/api/goals/${leer.id}/checks/${day}`, { data: { done: true } })).ok()).toBe(true);
  expect((await api.put(`/api/goals/work-hours/${day}`, { data: { hours: '7.5' } })).ok()).toBe(true);

  const cats = await (await api.get('/api/finance/categories')).json();
  const expenseCat = cats.find((c) => c.kind === 'expense' && !c.archived);
  const incomeCat = cats.find((c) => c.kind === 'income' && !c.archived);
  expect(
    (await api.post('/api/finance/transactions', { data: { kind: 'expense', category_id: expenseCat.id, amount: '120.50' } })).ok(),
  ).toBe(true);
  expect(
    (await api.post('/api/finance/transactions', { data: { kind: 'income', category_id: incomeCat.id, amount: '1000' } })).ok(),
  ).toBe(true);

  const stats = await (await api.get('/api/goals/stats')).json();
  await page.reload();

  // Indicadores.
  await expect(page.getByTestId('dash-month-label')).toContainText(label(month));
  await expect(page.getByTestId('kpi-commitment-value')).toContainText(stats.commitment.replace('.', ','));
  await expect(page.getByTestId('kpi-commitment-fraction')).toContainText(`1 / ${2 * day}`);
  await expect(page.getByTestId('kpi-hours-value')).toHaveText('7,5');
  await expect(page.getByTestId('kpi-hours-average')).toContainText('7,5 h por día trabajado · 1 día');
  await expect(page.getByTestId('kpi-streaks-value')).toHaveText('0');
  await expect(page.getByTestId('kpi-streak-best')).toContainText('Leer · 1 día');

  // Objetivos: el más y el menos cumplido.
  const rows = page.getByTestId('dash-goal-row');
  await expect(rows).toHaveCount(2);
  await expect(page.locator(`[data-testid="dash-goal-row"][data-goal-id="${leer.id}"]`)).toHaveAttribute('data-best', 'true');
  await expect(rows.nth(1)).toHaveAttribute('data-worst', 'true');
  await expect(rows.nth(0).getByTestId('dash-goal-percent')).toContainText(stats.goals[0].percent.replace('.', ','));
  await expect(rows.nth(0).getByTestId('dash-goal-best')).toHaveText('1');

  // Puntaje de hoy con el teclado (Inicio y flechas), igual que con el mouse.
  const daily = page.getByTestId('dash-daily-chart');
  await daily.locator('svg').focus();
  await page.keyboard.press('Home');
  for (let i = 1; i < day; i += 1) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('dash-daily-chart-tooltip')).toContainText('1 de 2');
  await expect(page.getByTestId('dash-weekday-chart')).toBeVisible();

  // Mapa de calor: con la primera flecha se para en hoy.
  await page.getByTestId('dash-heatmap').locator('svg[role="img"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('dash-heatmap-tooltip')).toContainText('1 de 2');
  await expect(page.locator(`[data-testid="dash-heatmap"] rect[data-date="${today}"]`)).toHaveAttribute('data-level', '2');

  // Horas por semana.
  await expect(page.getByTestId('dash-hours-week-total').filter({ hasText: '7,5 h' })).toHaveCount(1);

  // Finanzas: el servidor suma; aquí solo se muestra.
  await expect(page.getByTestId('dash-fin-expense')).toContainText('120,50');
  await expect(page.getByTestId('dash-fin-income')).toContainText('1.000,00');
  await expect(page.getByTestId('dash-fin-balance')).toContainText('879,50');
  await expect(page.getByTestId('dash-fin-cat')).toHaveCount(1);
  await expect(page.getByTestId('dash-fin-cat-percent')).toHaveText('100,0 %');
  await page.getByTestId('dash-fin-tab-income').click();
  await expect(page.getByTestId('dash-fin-cat')).toHaveAttribute('data-name', incomeCat.name);
  await expect(page.getByTestId('dash-fin-link')).toHaveAttribute('href', '/finanzas');

  // Mes anterior: sin objetivos ni movimientos, y de solo lectura (sin «Crea tus objetivos»).
  await page.getByTestId('dash-month-prev').click();
  const prev = shift(month, -1);
  await expect(page).toHaveURL(new RegExp(`\\?mes=${prev}$`));
  await expect(page.getByTestId('dash-month-label')).toContainText(label(prev));
  await expect(page.getByTestId('dash-goals-empty')).toBeVisible();
  await expect(page.getByTestId('dash-goals-create')).toHaveCount(0);
  await expect(page.getByTestId('dash-fin-empty')).toBeVisible();

  // Vuelve y pasa al siguiente: el mes futuro se puede preparar.
  await page.getByTestId('dash-month-next').click();
  await expect(page.getByTestId('dash-goal-row')).toHaveCount(2);
  await page.getByTestId('dash-month-next').click();
  await expect(page).toHaveURL(new RegExp(`\\?mes=${shift(month, 1)}$`));
  await expect(page.getByTestId('dash-goals-create')).toBeVisible();
  await expect(page.getByTestId('kpi-delta-value')).toHaveText('—');
});
