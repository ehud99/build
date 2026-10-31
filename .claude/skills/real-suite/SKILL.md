---
name: real-suite
description: Corre la suite completa de Real (pytest + unitarias del front + lint + build + Playwright en PC y celular) y reporta. Usar SOLO cuando el usuario la pida ("corre la suite completa", "/real-suite"), normalmente después de varios cambios y antes de desplegar.
---

# real-suite — suite completa de Real, a pedido

Adaptación de `forge-suite` (de forge) a este repo. Valida **todo el aplicativo** de una vez,
antes de desplegar. Nunca despliega ni hace commit por su cuenta.

Real es chico: no hace falta partir en tandas como en forge. Si algún día una tanda pasa de
10 minutos, se parte por archivos (`pytest tests/test_x.py`, `npx playwright test e2e/x.spec.js`).

## Antes de empezar

- Repo: la raíz de `ehud99/build` (en la PC del usuario, su carpeta local de `build`).
- Las pruebas usan sus propias bases y puertos:
  - pytest: base `build_test` (`TEST_DATABASE_URL` la cambia);
  - Playwright: backend en 8030 con la base `build_e2e` (`E2E_DATABASE_URL`) y Vite en 5201.
  No toques la base de desarrollo (`build_dev`) ni los servidores del usuario (8020 / 5200).
- PostgreSQL tiene que estar arriba (`docker compose up -d db` en la PC; en la nube,
  `service postgresql start`). Si faltan las bases de prueba: `createdb build_test` y `createdb build_e2e`.
- No corras otra cosa pesada en paralelo (otro pytest u otro Playwright comparten bases y puertos).

## Pasos

Corre cada uno **en primer plano** (Bash con `timeout: 600000`), uno por llamada, en este orden.
Nunca `run_in_background`.

1. `cd back && .venv/bin/pytest -q`
2. `cd front && npm test`
3. `cd front && npm run lint`
4. `cd front && npx vite build` (y borra `front/dist` al terminar)
5. `cd front && npx playwright test` (proyectos `desktop` y `mobile`)

- Si un fallo parece intermitente (un timeout de UI, un servidor que se cayó en medio), re-corre
  solo ese archivo una vez. Si pasa, anótalo como intermitente; si falla otra vez, es un fallo real.
- Con fallos reales: lee la salida (en Playwright, `test-results/…/error-context.md`; en pytest, la
  sección `FAILURES`), ubica qué cambio reciente lo causó por los archivos tocados y decide: prueba
  desactualizada → se corrige la prueba; código mal → se corrige el código. Re-corre lo afectado.
  Si el arreglo no es obvio o cambia comportamiento, pregunta antes.
- Al terminar, borra `front/test-results` y `front/playwright-report`.

## Reporte al usuario (en español, corto)

- Totales por suite: pytest N pasan; unitarias N; lint ok; build ok; Playwright N (PC y celular).
- Fallos encontrados, causa y qué se corrigió (prueba o código), y los intermitentes.
- Si quedó todo en verde: "Listo para desplegar" y pregunta si despliega (desplegar requiere su pedido).
