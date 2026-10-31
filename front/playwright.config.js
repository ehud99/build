import { existsSync } from 'node:fs';
import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de integración contra el backend real: un uvicorn en 8030 con la base `build_e2e`
 * (migrada con Alembic al arrancar) y un Vite en 5201 que apunta a él. Cada prueba crea sus
 * usuarios con un nombre único, así no hace falta vaciar la base.
 *
 * Requisitos: PostgreSQL en `E2E_DATABASE_URL` (por defecto el local de `docker-compose.yml`) y
 * el entorno de Python en `back/.venv`.
 */
const API_PORT = 8030;
const WEB_PORT = 5201;
export const E2E_INVITE = 'e2e-invite';
const DATABASE_URL =
  process.env.E2E_DATABASE_URL || 'postgresql+psycopg2://postgres:postgres@localhost:5432/build_e2e';

// En la nube de Claude Code el Chromium viene preinstalado aquí.
const CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : existsSync(CHROMIUM)
    ? { executablePath: CHROMIUM }
    : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    launchOptions,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `.venv/bin/alembic upgrade head && .venv/bin/uvicorn app.main:app --port ${API_PORT}`,
      cwd: '../back',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: { DATABASE_URL, INVITE_CODE: E2E_INVITE, SECRET_KEY: 'e2e-secret' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite',
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { VITE_API_TARGET: `http://127.0.0.1:${API_PORT}`, VITE_PORT: String(WEB_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
