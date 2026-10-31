import { expect, test } from '@playwright/test';

/**
 * El recorrido completo contra el backend real (playwright.config.js): registro con la clave de
 * invitación, panel, objetivos del mes (añadir, marcar hoy, puntajes, renombrar, borrar), tema,
 * salir y volver a entrar con el código, y el bloqueo tras 3 fallos.
 */

const INVITE = 'e2e-invite';
const CODE = 'Ab12-!';

const unique = () => `e2e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function typeCode(page, prefix, code) {
  await page.getByTestId(`${prefix}-0`).click();
  await page.keyboard.type(code);
}

async function registerUser(page, username, name = 'Prueba') {
  await page.goto('/registro');
  await page.getByTestId('register-invite').fill(INVITE);
  await page.getByTestId('register-next').click();
  await page.getByTestId('register-name').fill(name);
  await page.getByTestId('register-next').click();
  await page.getByTestId('register-username').fill(username);
  await page.getByTestId('register-next').click();
  await typeCode(page, 'register-code', CODE);
  await page.getByTestId('register-next').click();
  await typeCode(page, 'register-confirm', CODE);
  await page.getByTestId('register-next').click();
  await expect(page).toHaveURL(/\/inicio$/);
}

test('inicio público en desarrollo y enlaces de entrada', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-under-construction')).toBeVisible();
  await page.goto('/login');
  await expect(page.getByTestId('login-bot-message')).toContainText('Bienvenido a Real');
  await page.getByTestId('login-register').click();
  await expect(page).toHaveURL(/\/registro$/);
});

test('el registro pide una clave de invitación válida', async ({ page }) => {
  await page.goto('/registro');
  await page.getByTestId('register-invite').fill('otra-clave');
  await page.getByTestId('register-next').click();
  await page.getByTestId('register-name').fill('Nadie');
  await page.getByTestId('register-next').click();
  await page.getByTestId('register-username').fill(unique());
  await page.getByTestId('register-next').click();
  await typeCode(page, 'register-code', CODE);
  await page.getByTestId('register-next').click();
  await typeCode(page, 'register-confirm', CODE);
  await page.getByTestId('register-next').click();
  await expect(page.getByTestId('register-invite')).toBeVisible();
  await expect(page.getByTestId('register-error')).toContainText(/invitación/i);
});

test('registro, objetivos del mes, tema, salir y volver a entrar', async ({ page }) => {
  const username = unique();
  await registerUser(page, username, 'Luz');
  await expect(page.getByTestId('dashboard-under-construction')).toBeVisible();

  // En PC la barra de módulos va justo debajo del logo, no a media pantalla.
  const rail = page.getByTestId('nav-rail');
  if (await rail.count()) {
    const logo = await page.getByTestId('logo').boundingBox();
    const box = await rail.boundingBox();
    expect(box.y).toBeGreaterThan(logo.y + logo.height);
    expect(box.y - (logo.y + logo.height)).toBeLessThan(32);
  }

  // Objetivos: mes vacío → añadir dos.
  await page.getByTestId('nav-goals').click();
  await expect(page).toHaveURL(/\/objetivos/);
  await expect(page.getByTestId('goals-empty')).toBeVisible();
  await page.getByTestId('goal-add').click();
  // El primer objetivo recomienda «Dormir 8 horas» (o, rara vez, «Tomar agua»).
  await expect(page.getByTestId('goal-add-input')).toHaveAttribute('placeholder', /^(Dormir 8 horas|Tomar agua)$/);
  await page.getByTestId('goal-add-input').fill('Leer 20 min');
  await page.getByTestId('goal-add-input').press('Enter');
  await expect(page.getByTestId('goals-table')).toBeVisible();
  await page.getByTestId('goal-add').click();
  await page.getByTestId('goal-add-input').fill('Correr');
  await page.getByTestId('goal-add-input').press('Enter');
  const rows = page.locator('[data-testid^="goal-row-"]');
  await expect(rows).toHaveCount(2);

  // Marcar hoy en el primero: T, puntaje del día y final.
  const firstId = (await rows.first().getAttribute('data-testid')).replace('goal-row-', '');
  const todayCell = page.locator(`[data-testid^="check-${firstId}-"]:not([disabled])`);
  await expect(todayCell).toHaveCount(1);
  const day = (await todayCell.getAttribute('data-testid')).split('-').pop();
  await todayCell.click();
  await expect(todayCell).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId(`goal-total-${firstId}`)).toHaveText('1');
  await expect(page.getByTestId(`day-score-${day}`)).toHaveText('1');
  await expect(page.getByTestId('final-score')).toContainText('1');

  // Los otros días no se pueden marcar.
  const otherDay = day === '1' ? '2' : '1';
  await expect(page.getByTestId(`check-${firstId}-${otherDay}`)).toBeDisabled();

  // Renombrar el segundo y borrarlo.
  const secondId = (await rows.nth(1).getAttribute('data-testid')).replace('goal-row-', '');
  await page.getByTestId(`goal-title-${secondId}`).fill('Correr 5 km');
  const saved = page.waitForResponse((r) => r.url().includes(`/api/goals/${secondId}`) && r.request().method() === 'PATCH');
  await page.getByTestId(`goal-title-${secondId}`).press('Enter');
  expect((await saved).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId(`goal-title-${secondId}`)).toHaveValue('Correr 5 km');
  await expect(page.locator(`[data-testid="check-${firstId}-${day}"]`)).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId(`goal-delete-${secondId}`).click();
  await expect(rows).toHaveCount(1);

  // Mes siguiente: vacío y se puede copiar.
  await page.getByTestId('month-next').click();
  await expect(page.getByTestId('goals-empty')).toBeVisible();
  await page.getByTestId('goal-copy-previous').click();
  await expect(rows).toHaveCount(1);
  await expect(page.locator('[data-testid^="goal-title-"]').first()).toHaveValue('Leer 20 min');

  // Tema.
  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Salir y volver a entrar con el código.
  await page.getByTestId('account-button').click();
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/objetivos');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-next').click();
  await expect(page.getByTestId('login-who')).toHaveText(username, { ignoreCase: true });
  await typeCode(page, 'login-code', CODE);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/objetivos$/);
  await expect(rows).toHaveCount(1);
});

test('tres códigos malos piden esperar', async ({ page }) => {
  const username = unique();
  await registerUser(page, username);
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-next').click();
  for (let i = 0; i < 3; i += 1) {
    await typeCode(page, 'login-code', 'zzzzzz');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toBeVisible();
  }
  await expect(page.getByTestId('login-error')).toContainText(/Espera/);
  await expect(page.getByTestId('login-submit')).toBeDisabled();
});
