import { expect, test } from '@playwright/test';

import { registerUser } from './helpers.js';

/**
 * Pizarra (docs/contrato-pizarra.md) contra el backend real: crear una pizarra, dibujar un
 * rectángulo y un texto con el teclado, ver «Guardado», recargar y encontrar lo dibujado (por la
 * API y en la miniatura), renombrar, duplicar y eliminar. En el celular, el editor abre y la barra
 * de Excalidraw no queda tapada por la barra de módulos. Ninguna petición sale a una CDN.
 */

const isMobile = (testInfo) => testInfo.project.name === 'mobile';

/** Junta los pedidos a otros orígenes que no sean las fuentes de la app (Google Fonts). */
function watchExternal(page) {
  const external = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return;
    if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
    external.push(r.url());
  });
  return external;
}

async function openNewBoard(page) {
  await page.getByTestId('nav-whiteboard').click();
  await expect(page).toHaveURL(/\/pizarra$/);
  await expect(page.getByTestId('wb-empty')).toBeVisible();
  await page.getByTestId('wb-new').click();
  await expect(page).toHaveURL(/\/pizarra\?id=\d+$/);
  await expect(page.getByTestId('wb-editor')).toBeVisible();
  const canvas = page.locator('.excalidraw canvas.interactive');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('wb-status')).toHaveAttribute('data-status', 'saved');
  return Number(new URL(page.url()).searchParams.get('id'));
}

const saved = (page) => expect(page.getByTestId('wb-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 });

test('pizarra: crear, dibujar, guardado automático, recargar, renombrar, duplicar y eliminar', async ({ page }, testInfo) => {
  test.skip(isMobile(testInfo), 'el dibujo con teclado y mouse se prueba en PC');
  const external = watchExternal(page);
  await registerUser(page);
  const id = await openNewBoard(page);

  // El nombre desde la barra del editor (sin botón «Guardar»).
  const renamed = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.request().postData()?.includes('"name"'));
  await page.getByTestId('wb-name').fill('Mi plano');
  await page.getByTestId('wb-name').press('Enter');
  expect((await renamed).status()).toBe(200);

  // Un rectángulo (r y arrastrar) y un texto (t y escribir).
  const canvas = page.locator('.excalidraw canvas.interactive');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: 40, y: box.height - 120 } });
  await page.keyboard.press('r');
  await page.mouse.move(box.x + 250, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 480, box.y + 360, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId('wb-status')).toHaveAttribute('data-status', 'saving');
  await saved(page);

  await page.keyboard.press('t');
  await page.mouse.click(box.x + 260, box.y + 420);
  await page.keyboard.type('Hola pizarra');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('wb-status')).toHaveText(/Guardando…|Guardado/);
  await saved(page);

  const check = async () => {
    const board = await (await page.request.get(`/api/whiteboards/${id}`)).json();
    expect(board.name).toBe('Mi plano');
    expect(board.elements.map((e) => e.type).sort()).toEqual(['rectangle', 'text']);
    expect(board.elements.find((e) => e.type === 'text').text).toBe('Hola pizarra');
    expect(board.thumbnail_url).toMatch(new RegExp(`^/api/whiteboards/${id}/thumbnail\\?v=\\d+$`));
  };
  await check();

  // Recargar: el editor vuelve a abrir la misma pizarra, con lo dibujado.
  await page.reload();
  await expect(page.getByTestId('wb-editor')).toBeVisible();
  await expect(page.getByTestId('wb-name')).toHaveValue('Mi plano');
  await expect(page.locator('.excalidraw canvas.interactive')).toBeVisible();
  await saved(page);
  await check();

  // Volver a la lista: la card con su nombre y la miniatura del dibujo.
  await page.getByTestId('wb-back').click();
  await expect(page).toHaveURL(/\/pizarra$/);
  const card = page.getByTestId('wb-card');
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('wb-card-name')).toHaveText('Mi plano');
  await expect(card.getByTestId('wb-card-date')).toHaveText('Hace un momento');
  const thumb = card.getByTestId('wb-card-thumb');
  await expect(thumb).toBeVisible();
  await expect.poll(() => thumb.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

  // Renombrar desde el menú de la card.
  await card.getByTestId('wb-card-more').click();
  await page.getByTestId('wb-menu-rename').click();
  await page.getByTestId('wb-card-name-input').fill('Plano final');
  await page.getByTestId('wb-card-name-input').press('Enter');
  await expect(card.getByTestId('wb-card-name')).toHaveText('Plano final');

  // Duplicar: la copia queda primera, con su miniatura.
  await card.getByTestId('wb-card-more').click();
  await page.getByTestId('wb-menu-duplicate').click();
  await expect(page.getByTestId('wb-card')).toHaveCount(2);
  const copy = page.getByTestId('wb-card').first();
  await expect(copy.getByTestId('wb-card-name')).toHaveText('Copia de Plano final');
  await expect(copy.getByTestId('wb-card-thumb')).toBeVisible();

  // Eliminar la original (con confirmación) y recargar.
  const original = page.getByTestId('wb-card').filter({ has: page.getByTestId('wb-card-name').getByText('Plano final', { exact: true }) });
  await original.getByTestId('wb-card-more').click();
  await page.getByTestId('wb-menu-delete').click();
  await expect(page.getByTestId('wb-confirm')).toContainText('¿Eliminar la pizarra?');
  await page.getByTestId('wb-confirm-ok').click();
  await expect(page.getByTestId('wb-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId('wb-card')).toHaveCount(1);
  await expect(page.getByTestId('wb-card-name')).toHaveText('Copia de Plano final');
  expect((await page.request.get(`/api/whiteboards/${id}`)).status()).toBe(404);

  // Abrir la copia lleva al editor con el dibujo.
  await page.getByTestId('wb-card-name').click();
  await expect(page.getByTestId('wb-name')).toHaveValue('Copia de Plano final');
  await expect(page.locator('.excalidraw canvas.interactive')).toBeVisible();

  expect(external).toEqual([]);
});

test('pizarra en el celular: el editor abre y su barra no queda tapada', async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo), 'solo en el celular');
  const external = watchExternal(page);
  await registerUser(page);
  const id = await openNewBoard(page);

  // La barra de herramientas de Excalidraw (arriba) y su pie (abajo) se ven por encima de la
  // barra de módulos flotante.
  const nav = await page.getByRole('navigation', { name: 'Módulos' }).locator('.glass-panel').boundingBox();
  const tools = page.locator('.excalidraw .App-toolbar').first();
  await expect(tools).toBeVisible();
  const toolsBox = await tools.boundingBox();
  const footer = page.locator('.excalidraw .App-toolbar-content, .excalidraw .mobile-misc-tools-container, .excalidraw .App-bottom-bar').last();
  await expect(footer).toBeVisible();
  const frame = await page.getByTestId('wb-canvas').boundingBox();
  expect(frame.y + frame.height).toBeLessThanOrEqual(nav.y);
  expect(toolsBox.y + toolsBox.height).toBeLessThanOrEqual(nav.y);
  const bottomBar = await page.locator('.excalidraw .App-bottom-bar').boundingBox();
  if (bottomBar) expect(bottomBar.y + bottomBar.height).toBeLessThanOrEqual(nav.y);

  // Sin scroll horizontal de la página.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  // Dibujar con la herramienta del rectángulo y verlo guardado.
  await page.locator('.excalidraw label:has([data-testid="toolbar-rectangle"])').click();
  const canvas = page.locator('.excalidraw canvas.interactive');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 80, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + 320, { steps: 8 });
  await page.mouse.up();
  await saved(page);
  await expect
    .poll(async () => (await (await page.request.get(`/api/whiteboards/${id}`)).json()).element_count, { timeout: 10_000 })
    .toBe(1);

  await page.getByTestId('wb-back').click();
  await expect(page.getByTestId('wb-card')).toHaveCount(1);
  expect(external).toEqual([]);
});
