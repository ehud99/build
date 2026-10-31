import { expect } from '@playwright/test';

/** Helpers comunes de las pruebas e2e: usuarios únicos, el código en las 6 casillas y el registro. */

export const INVITE = 'e2e-invite';
export const CODE = 'Ab12-!';

export const unique = () => `e2e_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export async function typeCode(page, prefix, code) {
  await page.getByTestId(`${prefix}-0`).click();
  await page.keyboard.type(code);
}

/** Crea la cuenta por la pantalla de registro y deja la sesión abierta en `/inicio`. */
export async function registerUser(page, username = unique(), name = 'Prueba') {
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
  return username;
}
