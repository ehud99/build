import { expect, test } from '@playwright/test';

import { registerUser } from './helpers.js';

/**
 * Finanzas contra el backend real: categorías de fábrica, gastos e ingresos, balance, totales y
 * porcentajes del servidor, periodos, pestañas, una categoría nueva, editar y borrar, y la hoja
 * del «+» en el celular.
 */

async function addMovement(page, amount, category, note = '') {
  await page.getByTestId('fin-fab').click();
  const sheet = page.getByTestId('fin-tx-sheet');
  await expect(sheet).toBeVisible();
  await page.getByTestId('fin-tx-amount').fill(amount);
  await sheet.locator(`[data-testid="fin-tx-category"][data-name="${category}"]`).click();
  if (note) await page.getByTestId('fin-tx-note').fill(note);
  await page.getByTestId('fin-tx-save').click();
  await expect(sheet).toBeHidden();
}

const row = (page, name) => page.locator(`[data-testid="fin-cat-row"][data-name="${name}"]`);

test('gastos e ingresos: balance, porcentajes, periodos, categoría nueva, editar y borrar', async ({ page }, info) => {
  page.on('dialog', (d) => d.accept());
  await registerUser(page);
  await page.getByTestId('nav-finance').click();
  await expect(page).toHaveURL(/\/finanzas$/);
  await expect(page.getByTestId('fin-empty')).toHaveText('Sin gastos en este periodo');
  await expect(page.getByTestId('fin-balance')).toContainText('0,00');

  // Categorías de fábrica en «Nuevo gasto».
  await page.getByTestId('fin-fab').click();
  const sheet = page.getByTestId('fin-tx-sheet');
  await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Nuevo gasto');
  await expect(page.getByTestId('fin-tx-category')).toHaveCount(10);
  await expect(page.getByTestId('fin-tx-category').first()).toHaveAttribute('data-name', 'Alimentación');
  if (info.project.name === 'mobile') {
    // En el celular es una hoja pegada abajo, y el «+» queda sobre la barra flotante.
    // (espera a que termine de subir)
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

  // Dos gastos (con coma decimal) y un ingreso.
  await addMovement(page, '30,50', 'Alimentación', 'Mercado');
  await addMovement(page, '10.5', 'Transporte');
  await expect(page.getByTestId('fin-total')).toContainText('41,00');
  await expect(page.getByTestId('fin-cat-row')).toHaveCount(2);
  await expect(row(page, 'Alimentación').getByTestId('fin-cat-percent')).toHaveText('74,4 %');
  await expect(row(page, 'Transporte').getByTestId('fin-cat-percent')).toHaveText('25,6 %');
  await expect(row(page, 'Alimentación').getByTestId('fin-cat-total')).toContainText('30,50');
  await expect(page.getByTestId('fin-donut-seg')).toHaveCount(2);
  await expect(page.getByTestId('fin-balance')).toContainText('-41,00');

  await page.getByTestId('fin-kind-income').click();
  await expect(page.getByTestId('fin-empty')).toHaveText('Sin ingresos en este periodo');
  await page.getByTestId('fin-fab').click();
  await expect(page.getByTestId('fin-tx-sheet').getByRole('heading', { level: 2 })).toHaveText('Nuevo ingreso');
  await page.keyboard.press('Escape');
  await addMovement(page, '100', 'Sueldo');
  await expect(row(page, 'Sueldo').getByTestId('fin-cat-percent')).toHaveText('100,0 %');
  await expect(page.getByTestId('fin-balance')).toContainText('59,00');
  await page.getByTestId('fin-kind-expense').click();
  await expect(page.getByTestId('fin-total')).toContainText('41,00');

  // Periodos: hoy, ayer (vacío), el mes y el año.
  await page.getByTestId('fin-mode-day').click();
  await expect(page.getByTestId('fin-period-label')).toHaveText(/^Hoy, \d+ de \w+/);
  await expect(page.getByTestId('fin-cat-row')).toHaveCount(2);
  await page.getByTestId('fin-prev').click();
  await expect(page.getByTestId('fin-period-label')).toHaveText(/^Ayer, /);
  await expect(page.getByTestId('fin-empty')).toBeVisible();
  await page.getByTestId('fin-next').click();
  await page.getByTestId('fin-mode-month').click();
  await expect(page.getByTestId('fin-period-label')).toHaveText(/^[A-Z][a-z]+ \d{4}$/);
  await page.getByTestId('fin-mode-year').click();
  await expect(page.getByTestId('fin-period-label')).toHaveText(/^\d{4}$/);
  await expect(page.getByTestId('fin-total')).toContainText('41,00');
  await page.getByTestId('fin-prev').click();
  await expect(page.getByTestId('fin-empty')).toBeVisible();
  await page.getByTestId('fin-next').click();
  await page.getByTestId('fin-mode-week').click();
  await expect(page.getByTestId('fin-period-label')).toHaveText(/ – /);
  await page.getByTestId('fin-mode-month').click();

  // Una categoría nueva con su ícono y color, creada desde «Nuevo gasto» y usada en el acto.
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
  await expect(page.getByTestId('fin-tx-sheet')).toBeHidden();
  await expect(row(page, 'Viajes')).toBeVisible();
  await expect(page.getByTestId('fin-total')).toContainText('46,00');

  // Editar un movimiento desde la categoría.
  await row(page, 'Alimentación').click();
  const detail = page.getByTestId('fin-detail-sheet');
  await expect(detail.getByTestId('fin-detail-row')).toHaveCount(1);
  await expect(detail.getByTestId('fin-detail-row')).toContainText('Mercado');
  await detail.getByTestId('fin-detail-edit').click();
  await expect(page.getByTestId('fin-tx-amount')).toHaveValue('30,50');
  await page.getByTestId('fin-tx-amount').fill('35');
  await page.getByTestId('fin-tx-save').click();
  await expect(detail.getByTestId('fin-detail-amount')).toContainText('35,00');
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(page.getByTestId('fin-total')).toContainText('50,50');

  // Borrar un movimiento: la categoría sale de la lista.
  await row(page, 'Transporte').click();
  await detail.getByTestId('fin-detail-delete').click();
  await expect(detail.getByTestId('fin-detail-row')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(row(page, 'Transporte')).toHaveCount(0);
  await expect(page.getByTestId('fin-total')).toContainText('40,00');
  await expect(page.getByTestId('fin-balance')).toContainText('60,00');

  // Sin scroll horizontal.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('la moneda se cambia desde el menú «⋯»', async ({ page }) => {
  await registerUser(page);
  await page.goto('/finanzas');
  await expect(page.getByTestId('fin-balance')).toContainText('S/');
  await page.getByTestId('fin-more').click();
  await page.getByTestId('fin-currency-EUR').click();
  await expect(page.getByTestId('fin-balance')).toContainText('€');
  await page.reload();
  await expect(page.getByTestId('fin-balance')).toContainText('€');
});
