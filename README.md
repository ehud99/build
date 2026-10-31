# Real

App personal de cumplimiento de metas para mí y mis amigos: cada uno crea su cuenta con una
clave de invitación, entra con su usuario y un código de 6 caracteres, y en su panel lleva los
objetivos del mes en una hoja (marca el día de hoy, ve el puntaje del día y el final).

- `back/`: FastAPI + SQLAlchemy + PostgreSQL + Alembic (puerto 8020).
- `front/`: React + Vite + Tailwind (puerto 5200; `/api` va al backend por el proxy de Vite).
- `docs/contrato.md`: el contrato de la API, las rutas y las reglas.

## Correr en local

1. Base de datos (PostgreSQL 16 en el puerto 5434):

   ```bash
   docker compose up -d db
   ```

2. Backend:

   ```bash
   cd back
   python -m venv .venv
   .venv/bin/pip install -r requirements.txt     # Windows: .venv\Scripts\pip
   cp .env.example .env                          # y ajustar INVITE_CODE
   .venv/bin/alembic upgrade head
   .venv/bin/uvicorn app.main:app --port 8020 --reload
   ```

3. Frontend:

   ```bash
   cd front
   npm install
   npm run dev
   ```

   Abrir http://127.0.0.1:5200 y crear la cuenta en «Crear cuenta» con la clave de `INVITE_CODE`.

## Pruebas

- Backend (contra PostgreSQL, base `build_test`; `TEST_DATABASE_URL` la cambia):
  `cd back && .venv/bin/pytest`
- Frontend, funciones puras: `cd front && npm test`
- Integración (Playwright; levanta su propio backend en 8030 con la base `build_e2e` y un Vite en
  5201; `E2E_DATABASE_URL` cambia la base): `cd front && npm run e2e`

Las bases `build_test` y `build_e2e` se crean una vez:
`createdb build_test` y `createdb build_e2e` (o con `psql`).

## Usuarios bloqueados

Tras 3 códigos malos seguidos hay que esperar 1 minuto antes de cada intento; al 8.º el usuario
queda bloqueado. Para desbloquearlo:

```bash
cd back && .venv/bin/python -m scripts.unlock_user <usuario>
```
