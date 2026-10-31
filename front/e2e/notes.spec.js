import { expect, test } from '@playwright/test';

import { registerUser } from './helpers.js';

/**
 * Notas (docs/contrato-notas.md) contra el backend real: crear una nota escribiendo, su card,
 * buscarla, negrita y lista de verificación en el editor, fijarla, pintarla, recargar y ver todo
 * persistido, y eliminarla. En el celular, el «+» flotante abre el editor a pantalla completa.
 */

const isMobile = (testInfo) => testInfo.project.name === 'mobile';

async function openNewNote(page, testInfo) {
  if (isMobile(testInfo)) {
    await expect(page.getByTestId('notes-create-bar')).toBeHidden();
    await page.getByTestId('notes-fab').click();
  } else {
    await expect(page.getByTestId('notes-fab')).toBeHidden();
    await page.getByTestId('notes-create-bar').click();
  }
  await expect(page.getByTestId('note-editor')).toBeVisible();
}

async function closeEditor(page) {
  await page.getByTestId('note-back').click();
  await expect(page.getByTestId('note-editor')).toBeHidden();
}

const card = (page, title) => page.getByTestId('note-card').filter({ hasText: title });

test('notas: crear, buscar, formato, lista, fijar, color, recargar y eliminar', async ({ page }, testInfo) => {
  await registerUser(page);
  await page.getByTestId('nav-notes').click();
  await expect(page).toHaveURL(/\/notas$/);
  await expect(page.getByTestId('notes-empty')).toBeVisible();

  // Crear escribiendo el título y el texto: se crea sola al escribir (sin botón «Guardar»).
  await openNewNote(page, testInfo);
  const content = page.getByTestId('note-editor-content');
  await expect(content).toBeFocused();
  await expect(page.getByTestId('note-date')).toHaveText(/^\d{1,2} de [a-z]+ de \d{4}, \d{2}:\d{2}$/);
  const created = page.waitForResponse((r) => r.url().endsWith('/api/notes') && r.request().method() === 'POST');
  await page.keyboard.type('Lista del súper');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Comprar fruta');
  expect((await created).status()).toBe(201);
  await expect(page.getByTestId('note-done')).toBeVisible();
  await page.getByTestId('note-done').click();
  await expect(page.getByTestId('note-done')).toBeHidden();
  await closeEditor(page);

  await expect(card(page, 'Lista del súper')).toBeVisible();
  await expect(card(page, 'Lista del súper').getByTestId('note-card-title')).toHaveText('Lista del súper');
  await expect(card(page, 'Lista del súper')).toContainText('Comprar fruta');

  // Buscar.
  await page.getByTestId('notes-search').fill('FRUTA');
  await expect(card(page, 'Lista del súper')).toBeVisible();
  await page.getByTestId('notes-search').fill('no existe');
  await expect(page.getByTestId('notes-empty')).toContainText('No hay notas que coincidan');
  await page.getByTestId('notes-search').fill('');
  await expect(card(page, 'Lista del súper')).toBeVisible();

  // Abrir y dar formato: una línea en negrita desde «Aa» y una lista de verificación.
  await card(page, 'Lista del súper').getByRole('button', { name: /Abrir la nota/ }).click();
  await expect(content).toContainText('Comprar fruta');
  // Tocar debajo del texto deja el cursor al final (sin depender de End/Home, que no son fiables).
  const box = await content.boundingBox();
  await content.click({ position: { x: 24, y: box.height - 24 } });
  await page.keyboard.press('Enter');
  await page.getByTestId('note-format').click();
  await expect(page.getByTestId('note-format-panel')).toBeVisible();
  await page.getByTestId('fmt-bold').click();
  await expect(page.getByTestId('fmt-bold')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('Importante');
  await expect(content.locator('strong')).toHaveText('Importante');
  await page.getByTestId('fmt-bold').click();
  await expect(page.getByTestId('fmt-bold')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('note-format').click();
  await expect(page.getByTestId('note-format-panel')).toBeHidden();
  await page.keyboard.press('Enter');
  await page.getByTestId('note-checklist').click();
  await page.keyboard.type('Leche');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Pan');
  // Enter en un ítem vacío sale de la lista.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Fin');
  await expect(content.locator('li[data-type="taskItem"]')).toHaveCount(2);
  await expect(content.locator(':scope > p').last()).toHaveText('Fin');
  await content.locator('li[data-type="taskItem"]').filter({ hasText: 'Leche' }).locator('input').check();
  await expect(content.locator('li[data-type="taskItem"][data-checked="true"] > div')).toHaveText('Leche');

  // Fijar y pintar desde «⋯».
  await page.getByTestId('note-more').click();
  const pinned = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.request().postData()?.includes('pinned'));
  await page.getByTestId('note-menu-pin').click();
  expect((await pinned).status()).toBe(200);
  await page.getByTestId('note-more').click();
  const colored = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.request().postData()?.includes('color'));
  await page.getByTestId('note-menu').getByTestId('note-color-yellow').click();
  expect((await colored).status()).toBe(200);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-menu')).toBeHidden();
  await expect(page.getByTestId('note-editor')).toBeVisible();
  await closeEditor(page);

  const pinnedCard = page.getByTestId('notes-pinned').getByTestId('note-card').filter({ hasText: 'Lista del súper' });
  await expect(page.getByTestId('notes-pinned')).toContainText('Fijadas');
  await expect(pinnedCard).toHaveAttribute('data-color', 'yellow');
  await expect(pinnedCard.locator('[data-testid="note-preview-task"][data-checked="true"]')).toHaveText('Leche');

  // Recargar: todo sigue ahí.
  await page.reload();
  await expect(pinnedCard).toBeVisible();
  await expect(pinnedCard).toHaveAttribute('data-color', 'yellow');
  await expect(pinnedCard.getByTestId('note-preview-task')).toHaveCount(2);
  await expect(pinnedCard).toContainText('Fin');
  await pinnedCard.getByRole('button', { name: /Abrir la nota/ }).click();
  await expect(content.locator('strong')).toHaveText('Importante');
  await expect(content).toContainText('Comprar fruta');
  await expect(content.locator('li[data-type="taskItem"]').filter({ hasText: 'Leche' }).locator('input')).toBeChecked();
  await expect(content.locator('li[data-type="taskItem"]').filter({ hasText: 'Pan' }).locator('input')).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-editor')).toBeHidden();

  // Eliminar desde la card (con confirmación).
  await pinnedCard.hover();
  await pinnedCard.getByTestId('note-card-delete').click();
  await page.getByTestId('note-confirm-ok').click();
  await expect(page.getByTestId('note-card')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('notes-empty')).toBeVisible();
});

test('notas: una nota nueva que se cierra vacía no queda; una que se vacía se borra', async ({ page }, testInfo) => {
  await registerUser(page);
  await page.goto('/notas');
  await expect(page.getByTestId('notes-empty')).toBeVisible();

  await openNewNote(page, testInfo);
  await closeEditor(page);
  await expect(page.getByTestId('notes-empty')).toBeVisible();

  await openNewNote(page, testInfo);
  const created = page.waitForResponse((r) => r.url().endsWith('/api/notes') && r.request().method() === 'POST');
  await page.keyboard.type('Efímera');
  await created;
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  const removed = page.waitForResponse((r) => r.request().method() === 'DELETE');
  await closeEditor(page);
  expect((await removed).status()).toBe(204);
  await expect(page.getByTestId('notes-empty')).toBeVisible();
});

test('notas en el celular: el «+» flotante abre el editor a pantalla completa', async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo), 'solo en el celular');
  await registerUser(page);
  await page.goto('/notas');
  const fab = page.getByTestId('notes-fab');
  await expect(fab).toBeVisible();
  // El «+» va encima de la barra de navegación de abajo, sin taparla.
  const fabBox = await fab.boundingBox();
  const navBox = await page.getByTestId('nav-notes').boundingBox();
  expect(fabBox.y + fabBox.height).toBeLessThan(navBox.y);

  await fab.click();
  const viewport = page.viewportSize();
  const box = await page.getByTestId('note-editor').locator('section').boundingBox();
  await expect(async () => {
    const now = await page.getByTestId('note-editor').locator('section').boundingBox();
    expect(Math.round(now.x)).toBe(0);
  }).toPass();
  expect(Math.round(box.width)).toBe(viewport.width);
  expect(Math.round(box.height)).toBe(viewport.height);
  await expect(page.getByTestId('note-editor-content')).toBeFocused();
  await page.keyboard.type('Desde el celular');
  await closeEditor(page);
  await expect(card(page, 'Desde el celular')).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
});
