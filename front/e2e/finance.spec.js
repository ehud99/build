import { expect, test } from '@playwright/test';

import { registerUser } from './helpers.js';

/**
 * Finanzas como libreta contra el backend real: gastos e ingresos desde el «+» (con el selector
 * Gasto | Ingreso de la hoja), la lista agrupada por día, los totales del mes que da el servidor,
 * los filtros, editar, borrar, una categoría nueva, el mes en la URL, la moneda y, en el celular,
 * la hoja pegada abajo y el «+» sobre la barra.
 */

async function addMovement(page, { kind = 'expense', amount, category, note = '', day = '' }) {
  await page.getByTestId('fin-fab').click();
  const sheet = page.getByTestId('fin-tx-sheet');
  await expect(sheet).toBeVisible();
  await sheet.getByTestId(`fin-tx-kind-${kind}`).click();
  await page.getByTestId('fin-tx-amount').fill(amount);
  await sheet.locator(`[data-testid="fin-tx-category"][data-name="${category}"]`).click();
  if (note) await page.getByTestId('fin-tx-note').fill(note);
  if (day) await page.getByTestId('fin-tx-date').fill(day);
  await page.getByTestId('fin-tx-save').click();
  await expect(sheet).toBeHidden();
}

const rows = (page) => page.getByTestId('fin-tx-row');
const rowWith = (page, category) => page.locator(`[data-testid="fin-tx-row"][data-category="${category}"]`);

/** El día anterior a `YYYY-MM-DD` (en UTC, como la app). */
function previousDay(text) {
  const d = new Date(`${text}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

test('libreta: agregar, agrupar por día, totales, filtros, editar, borrar y categoría nueva', async ({ page }, info) => {
  page.on('dialog', (d) => d.accept());
  await registerUser(page);
  await page.getByTestId('nav-finance').click();
  await expect(page).toHaveURL(/\/finanzas$/);
  await expect(page.getByTestId('fin-empty')).toContainText('Sin movimientos en');
  await expect(page.getByTestId('fin-total-net')).toContainText('0,00');
  await expect(page.getByTestId('fin-month')).toHaveText(/^[A-Z][a-z]+ \d{4}$/);
  const today = await page.evaluate(() => fetch('/api/finance/settings').then((r) => r.json()).then((s) => s.today));

  // «Nuevo movimiento»: Gasto por defecto con sus 10 categorías; Ingreso cambia la grilla.
  await page.getByTestId('fin-fab').click();
  const sheet = page.getByTestId('fin-tx-sheet');
  await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Nuevo movimiento');
  await expect(sheet.getByTestId('fin-tx-kind-expense')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('fin-tx-category')).toHaveCount(10);
  await sheet.getByTestId('fin-tx-kind-income').click();
  await expect(page.getByTestId('fin-tx-category')).toHaveCount(5);
  await expect(page.getByTestId('fin-tx-category').first()).toHaveAttribute('data-name', 'Sueldo');
  if (info.project.name === 'mobile') {
    // En el celular es una hoja pegada abajo (espera a que termine de subir).
    const viewport = page.viewportSize();
    await expect
      .poll(async () => {
        const box = await sheet.boundingBox();
        return Math.abs(box.y + box.height - viewport.height);
      })
      .toBeLessThan(2);
    await expect(page.getByTestId('fin-tx-amount')).toHaveAttribute('inputmode', 'decimal');
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  if (info.project.name === 'mobile') {
    const fab = await page.getByTestId('fin-fab').boundingBox();
    const nav = await page.getByTestId('nav-finance').boundingBox();
    expect(fab.y + fab.height).toBeLessThan(nav.y);
  }

  // Dos gastos hoy (uno con coma decimal), uno ayer y un ingreso hoy.
  const yesterday = previousDay(today);
  const sameMonth = yesterday.slice(0, 7) === today.slice(0, 7);
  await addMovement(page, { amount: '30,50', category: 'Alimentación', note: 'Mercado' });
  await addMovement(page, { amount: '10.5', category: 'Transporte' });
  await addMovement(page, { kind: 'income', amount: '100', category: 'Sueldo' });
  await addMovement(page, { amount: '4', category: 'Ocio', note: 'Cine', day: yesterday });
  if (!sameMonth) {
    // El 1.º del mes, el de ayer cae en el mes anterior: la libreta se va a ese mes. Se vuelve.
    await expect(page.getByTestId('fin-day')).toHaveCount(1);
    await page.getByTestId('fin-next').click();
  }

  const days = page.getByTestId('fin-day');
  await expect(days).toHaveCount(sameMonth ? 2 : 1);
  const todayGroup = page.locator(`[data-testid="fin-day"][data-date="${today}"]`);
  await expect(todayGroup.getByTestId('fin-day-label')).toHaveText('Hoy');
  await expect(todayGroup.getByTestId('fin-day-net')).toHaveText(/^\+59,00/);
  // Del más nuevo al más viejo: el ingreso arriba.
  await expect(todayGroup.getByTestId('fin-tx-row')).toHaveCount(3);
  await expect(todayGroup.getByTestId('fin-tx-row').first()).toHaveAttribute('data-category', 'Sueldo');
  await expect(rowWith(page, 'Sueldo').getByTestId('fin-tx-row-amount')).toHaveText(/^\+100,00/);
  await expect(rowWith(page, 'Alimentación').getByTestId('fin-tx-row-amount')).toHaveText(/^−30,50/);
  await expect(rowWith(page, 'Alimentación').getByTestId('fin-tx-row-note')).toHaveText('Mercado');
  if (sameMonth) {
    const yesterdayGroup = page.locator(`[data-testid="fin-day"][data-date="${yesterday}"]`);
    await expect(yesterdayGroup.getByTestId('fin-day-label')).toHaveText('Ayer');
    await expect(yesterdayGroup.getByTestId('fin-day-net')).toHaveText(/^−4,00/);
    await expect(days.first()).toHaveAttribute('data-date', today);
    await expect(page.getByTestId('fin-total-income')).toHaveText(/^\+100,00/);
    await expect(page.getByTestId('fin-total-expense')).toHaveText(/^−45,00/);
    await expect(page.getByTestId('fin-total-net')).toHaveText(/^\+55,00/);
  }
  const expenseTotal = sameMonth ? '45,00' : '41,00';

  // Filtros: Gastos, Ingresos, una categoría y quitarlos.
  await page.getByTestId('fin-filter-gastos').click();
  await expect(page).toHaveURL(/tipo=gastos/);
  await expect(page.locator('[data-testid="fin-tx-row"][data-kind="income"]')).toHaveCount(0);
  await expect(page.getByTestId('fin-total-income')).toHaveText(/^0,00/);
  await expect(page.getByTestId('fin-total-expense')).toContainText(expenseTotal);
  await page.getByTestId('fin-filter-ingresos').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByTestId('fin-total-net')).toHaveText(/^\+100,00/);
  await page.getByTestId('fin-filter-all').click();
  await page.getByTestId('fin-filter-category').selectOption({ label: 'Transporte' });
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByTestId('fin-total-expense')).toContainText('10,50');
  // Con Ingresos, la categoría de gastos se quita sola.
  await page.getByTestId('fin-filter-ingresos').click();
  await expect(page).not.toHaveURL(/cat=/);
  await page.getByTestId('fin-filter-category').selectOption({ label: 'Extras' });
  await expect(page.getByTestId('fin-empty')).toContainText('Nada con estos filtros');
  await page.getByTestId('fin-clear-filters').click();
  await expect(rows(page)).toHaveCount(sameMonth ? 4 : 3);

  // Editar: tocar la fila abre la hoja con sus datos (sin el selector de tipo).
  await rowWith(page, 'Alimentación').click();
  await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Editar gasto');
  await expect(sheet.getByTestId('fin-tx-kind-expense')).toHaveCount(0);
  await expect(page.getByTestId('fin-tx-amount')).toHaveValue('30,50');
  await expect(page.getByTestId('fin-tx-note')).toHaveValue('Mercado');
  await page.getByTestId('fin-tx-amount').fill('35');
  await page.getByTestId('fin-tx-save').click();
  await expect(sheet).toBeHidden();
  await expect(rowWith(page, 'Alimentación').getByTestId('fin-tx-row-amount')).toHaveText(/^−35,00/);
  await expect(todayGroup.getByTestId('fin-day-net')).toHaveText(/^\+54,50/);

  // Borrar desde la hoja.
  await rowWith(page, 'Transporte').click();
  await page.getByTestId('fin-tx-delete').click();
  await expect(sheet).toBeHidden();
  await expect(rowWith(page, 'Transporte')).toHaveCount(0);
  await expect(todayGroup.getByTestId('fin-day-net')).toHaveText(/^\+65,00/);

  // Una categoría nueva creada desde «Nuevo movimiento» y usada en el acto.
  await page.getByTestId('fin-fab').click();
  await page.getByTestId('fin-tx-amount').fill('5');
  await page.getByTestId('fin-tx-new-category').click();
  const catSheet = page.getByTestId('fin-category-sheet');
  await expect(catSheet.getByRole('heading', { level: 2 })).toHaveText('Crear nueva categoría');
  await page.getByTestId('fin-cat-name').fill('Viajes');
  await page.getByTestId('fin-icon-plane').click();
  await page.getByTestId('fin-color-cyan').click();
  await page.getByTestId('fin-cat-save').click();
  await expect(catSheet).toBeHidden();
  await expect(page.locator('[data-testid="fin-tx-category"][data-name="Viajes"]')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('fin-tx-save').click();
  await expect(sheet).toBeHidden();
  await expect(rowWith(page, 'Viajes')).toBeVisible();
  await expect(todayGroup.getByTestId('fin-day-net')).toHaveText(/^\+60,00/);

  // El mes en la URL: el anterior está vacío y el enlace lo recuerda.
  await page.getByTestId('fin-prev').click();
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  if (sameMonth) await expect(page.getByTestId('fin-empty')).toContainText('Sin movimientos en');
  await page.reload();
  await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
  await page.getByTestId('fin-next').click();
  await expect(rowWith(page, 'Viajes')).toBeVisible();

  // Sin scroll horizontal.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('la moneda se cambia desde el menú «⋯» y el estado vacío agrega', async ({ page }) => {
  await registerUser(page);
  await page.goto('/finanzas');
  await expect(page.getByTestId('fin-total-net')).toContainText('S/');
  await page.getByTestId('fin-more').click();
  await page.getByTestId('fin-currency-EUR').click();
  await expect(page.getByTestId('fin-total-net')).toContainText('€');
  await page.reload();
  await expect(page.getByTestId('fin-total-net')).toContainText('€');

  await page.getByTestId('fin-empty-add').click();
  await expect(page.getByTestId('fin-tx-sheet').getByRole('heading', { level: 2 })).toHaveText('Nuevo movimiento');
  await page.getByTestId('fin-tx-amount').fill('12');
  await page.locator('[data-testid="fin-tx-category"][data-name="Casa"]').click();
  await page.getByTestId('fin-tx-save').click();
  await expect(rowWith(page, 'Casa').getByTestId('fin-tx-row-amount')).toHaveText(/^−12,00\s€$/);
});
