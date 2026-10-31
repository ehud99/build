# CLAUDE.md

**Real**: app personal de cumplimiento de metas y seguimiento de proyectos para el dueño y sus
amigos. Repositorio `ehud99/build`. Nació de **forge** (`ehud99/forge`), del que copia el login de
dos pantallas con el bot de blobatar, el código de acceso de 6 caracteres, el bloqueo por intentos
y los tokens del tema. **Sin empresas, membresías, subdominios ni RLS**: cada usuario ve solo lo
suyo (`user_id`). Backend **FastAPI + SQLAlchemy + PostgreSQL + Alembic** en `back/`, frontend
**React + Vite + Tailwind** en `front/`. Interfaz en español; identificadores en inglés.

## Documentos

| Archivo | Contenido |
|---|---|
| [`docs/contrato.md`](docs/contrato.md) | API, errores, reglas de cuentas y objetivos, rutas del frontend, glitch, módulos |
| [`README.md`](README.md) | Cómo correr y probar en local |

## Estado

v1: inicio público y Dashboard «En desarrollo»; registro con clave de invitación; login de dos
pantallas; Objetivos del mes (hasta 10, solo se marca hoy, meses pasados de solo lectura, «Copiar
mes anterior», rachas por casilla y la fila en llamas del mes completo, recomendaciones en el
campo del objetivo nuevo); tema claro y oscuro con efecto glitch (`front/src/lib/glitch.js`).

## Skills del proyecto

- `/frmecommit`: commit, versión de `front/package.json` y push en un paso (`.claude/skills/frmecommit/`).
- `/real-suite`: la suite completa (pytest, unitarias, lint y Playwright) antes de desplegar
  (`.claude/skills/real-suite/`).

Próximos módulos: notas, tareas (probablemente junto al calendario), finanzas y un dashboard con
los datos de todo.

## Reglas

1. **Un módulo por carpeta**: `back/app/modules/<clave>/` (router y servicio) y
   `front/src/modules/<clave>/`; la barra del panel sale de `front/src/modules/registry.js` y los
   routers se incluyen en `back/app/main.py`. Un módulo no importa a otro.
2. **Toda ruta con datos de un usuario usa `Depends(current_user)`** y filtra por `user_id`; un
   recurso de otro responde 404, como si no existiera.
3. **Cambios de base con Alembic** (`.venv/bin/alembic revision --autogenerate`), nunca a mano.
4. **Errores con la forma de forge**: `ApiError(status, message, error_code, detail)`.
5. **Solo tokens de color** (`bg-surface`, `text-text-muted`, `bg-accent`…), nunca colores fijos:
   todo debe verse bien en claro y en oscuro.
6. **Nunca `float` para dinero** (para cuando llegue finanzas): `Decimal` y `Numeric`.
7. **forge es solo lectura** desde este proyecto: se copia de ahí, no se modifica.
8. Antes de cada commit: `cd back && .venv/bin/pytest`, `cd front && npm test && npm run lint && npm run e2e`.
   Commits con `/frmecommit` (Conventional Commits en español, sin trailers).
