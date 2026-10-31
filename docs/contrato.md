# Contrato de Real (v1)

App personal de cumplimiento de metas para el dueño y sus amigos. Sin empresas, sin
membresías, sin subdominios: cada usuario ve solo lo suyo. Nombre visible: **Real**.

Backend FastAPI + SQLAlchemy + PostgreSQL (`back/`, puerto **8020**), frontend React + Vite +
Tailwind 4 (`front/`, puerto **5200**, `/api` va al backend por el proxy de Vite). Interfaz en
español; identificadores en inglés.

## Errores

Toda respuesta de error tiene la forma de forge:

```json
{ "error_code": "LOGIN_WAIT", "message": "Espera 1 minuto antes de volver a intentarlo.", "detail": { "retry_after": 60 } }
```

`detail` es opcional. 422 `VALIDATION_ERROR` con `detail.field` para datos mal formados.

## Cuentas

- **usuario**: 3 a 24 caracteres, minúsculas, números, `.` y `_`; se guarda en minúsculas y
  sin `@` inicial. Único.
- **nombre**: 1 a 60 caracteres.
- **código de acceso**: exactamente 6 caracteres ASCII visibles (`!`…`~`, sin espacios),
  distingue mayúsculas (igual que forge, `lib/accessCode.js`). Se guarda con bcrypt.
- **sesión**: cookie `httpOnly` `build_rt` (JWT firmado, 30 días, `SameSite=Lax`). No hay token
  en el cuerpo ni en `localStorage`.

`User` = `{ "id": 1, "username": "luz", "name": "Luz", "created_at": "2026-10-31T18:00:00Z" }`

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/auth/register` | `{ invite_code, name, username, access_code }` | 201 `{ user }` y la cookie |
| `GET /api/auth/username-available?username=` | | 200 `{ available: bool }` (usuario mal formado → `false`) |
| `POST /api/auth/login` | `{ username, access_code }` | 200 `{ user }` y la cookie |
| `GET /api/auth/me` | | 200 `{ user }` · 401 `NOT_AUTHENTICATED` |
| `POST /api/auth/logout` | | 204 y borra la cookie |

Registro:
- 403 `REGISTRATION_CLOSED` si el servidor no tiene `INVITE_CODE` (el registro siempre pide clave).
- 403 `INVALID_INVITE` si la clave no coincide.
- 409 `USERNAME_TAKEN`.

Login (como forge AJ3, `code_login.py`):
- 401 `INVALID_CREDENTIALS` con `detail.attempts_left` («Verifica que tu usuario y tu código sean correctos.»).
- Al 3.er fallo seguido: 429 `LOGIN_WAIT` con `detail.retry_after` (60). Mientras dura la espera,
  429 sin mirar el código. Cada fallo después de la espera vuelve a dar 1 minuto.
- Al 8.º fallo: 403 `LOGIN_BLOCKED` («Tu usuario quedó bloqueado. Pide que lo desbloqueen.»),
  hasta `python -m scripts.unlock_user <usuario>`.
- Un usuario que no existe recibe **las mismas respuestas en el mismo orden** (conteo en memoria).
- Un acierto pone el conteo en 0.

## Objetivos (calendario)

Zona horaria de la app: `APP_TIMEZONE` (por defecto `America/Lima`). «Hoy» se calcula en el servidor.

`Goal` = `{ "id": 7, "title": "Leer 20 min", "position": 0, "checked_days": [1, 2, 5] }`

`Month` =
```json
{
  "month": "2026-11",
  "days_in_month": 30,
  "today": "2026-11-03",
  "editable": true,
  "max_goals": 10,
  "goals": [Goal, ...],
  "work_hours": { "5": "8.5", "6": "4" },
  "total_hours": "12.5"
}
```

- `editable`: el mes es el actual o uno futuro (los meses pasados son de solo lectura).
- Solo se marca o desmarca **el día de hoy** (ni futuros ni pasados).

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/goals?month=YYYY-MM` | | 200 `Month` (sin `month`: el actual) |
| `POST /api/goals` | `{ month, title }` | 201 `Goal` |
| `PATCH /api/goals/{id}` | `{ title }` | 200 `Goal` |
| `DELETE /api/goals/{id}` | | 204 |
| `PUT /api/goals/{id}/checks/{day}` | `{ done: bool }` | 200 `Goal` |
| `POST /api/goals/copy-previous` | `{ month }` | 201 `Month` |
| `PUT /api/goals/work-hours/{day}` | `{ hours: "8.5" }` | 200 `{ month, day, hours, total_hours }` |

- Título: 1 a 80 caracteres, sin espacios a los lados.
- 409 `GOAL_LIMIT` al pasar de 10 objetivos en un mes.
- 409 `MONTH_READ_ONLY` al cambiar objetivos de un mes pasado.
- 409 `DAY_NOT_EDITABLE` al marcar un día que no es hoy.
- 404 `GOAL_NOT_FOUND` si el objetivo no existe o es de otro usuario.
- `copy-previous` copia los títulos (no las marcas) del mes anterior, en el mismo orden:
  409 `MONTH_NOT_EMPTY` si el mes ya tiene objetivos, 404 `NOTHING_TO_COPY` si el anterior no tiene.

### Horas trabajadas

La fila «Horas trabajadas» de la hoja (para el dashboard): por día y usuario, no por objetivo
(tabla `work_hours`, `Numeric(4,1)`; migración `0002`). Como las marcas, **solo las de hoy**
(409 `DAY_NOT_EDITABLE`), de 0 a 24 en pasos de media hora (422 `VALIDATION_ERROR`); `0` borra el
día. Las horas viajan como texto (`"8.5"`), nunca `float`; el frontend las suma en medias horas
(`modules/goals/hours.js`). En la hoja se editan con − y + bajo la tabla; en el celular, en «Hoy».
Se guardan cuando se deja de tocar (450 ms).

### Puntaje (lo calcula el frontend)

- **T** (fila): días marcados del objetivo.
- **Puntaje del día** (columna): objetivos marcados ese día.
- **Puntaje final**: suma de todas las marcas `/` objetivos × días del mes.

### Rachas (las calcula el frontend, `modules/goals/score.js`)

- La racha de una casilla marcada son los días seguidos marcados que terminan en ella (el primer
  día vale 1). Cuentan dentro del mes de cada objetivo: «Copiar mes anterior» empieza de cero.
- Nivel de la casilla (`streakLevel`): 1–6 días → 0 (la marca normal); 7 → 1 (un halo suave);
  14 → 2 (dorado); 21 → 3 (rojo que parpadea); 30 → 4 (fuego rojo y azul).
- Junto al título, la llama con la racha viva (la que termina hoy o, si hoy aún no se marcó,
  ayer), desde 2 días, del color de su nivel.
- **Mes completo** (todos los días marcados): la fila entera arde en rojo y azul.
- Los colores son tokens (`--fire-red`, `--fire-blue`, `--fire-gold`) en claro y oscuro; con
  `prefers-reduced-motion` no parpadean.

### Recomendaciones del objetivo nuevo (`modules/goals/placeholders.js`)

El placeholder del campo depende de cuántos objetivos tiene el mes: «Dormir 8 horas», «Hacer
ejercicios», «Menos horas en redes sociales que ayer» y, desde el cuarto, «Nuevo objetivo». Con
una probabilidad de 5 % sale «Tomar agua». Se elige una vez al abrir el campo.

## Rutas del frontend

| Ruta | Pantalla |
|---|---|
| `/` | Inicio público: «Real» y «En desarrollo»; arriba a la derecha «Iniciar sesión» (o «Ir al panel» con sesión) |
| `/login` | Login de dos pantallas como forge (AJ2). Arriba a la derecha «Ir al inicio». Pantalla 1: bot, «USUARIO», «Iniciar sesión» y debajo «Crear cuenta». Pantalla 2: usuario, llave, bot, 6 casillas (4 – 2), «Verificar código» (cápsula), «Cambiar usuario» e «Ir al inicio» |
| `/registro` | Registro guiado por el mismo bot: clave de invitación, nombre, usuario, código y confirmación |
| `/inicio` | Panel › Dashboard: «En desarrollo» |
| `/objetivos` | Panel › Objetivos: el calendario del mes (`?mes=YYYY-MM`). En el celular (< 768 px) el mes actual abre en **Hoy** (`TodayView`: solo los objetivos con la casilla de hoy grande, su racha y su T, y las horas de hoy) y **Mes** muestra la hoja. **Exportar**: Excel (CSV con `;`, coma decimal y BOM, `objetivos-YYYY-MM.csv`) o «Imprimir o PDF» (la hoja completa, horizontal y siempre en claro) |
| `/notas` | Panel › Notas: cards tipo Google Keep y editor tipo Notas del iPhone (`docs/contrato-notas.md`) |
| `/finanzas` | Panel › Finanzas: gastos e ingresos como «Gestor de gastos» (`docs/contrato-finanzas.md`) |
| `/pizarra` | Panel › Pizarra: pizarras con Excalidraw; el editor en `/pizarra?id=N` (`docs/contrato-pizarra.md`) |

Panel: barra de íconos de vidrio a la izquierda en PC, justo debajo del logo como en forge
(Inicio `House`, Objetivos `CalendarDays`, Notas `NotebookPen`, Finanzas `Wallet`, Pizarra `PenTool`), y abajo en el celular; arriba el logo «Real» y el selector «Claro | Oscuro»; abajo a la
izquierda el blobatar de la cuenta con su menú (nombre, @usuario, «Cerrar sesión»).

## Cambio de tema con glitch

`runGlitchTransition(commit)` en `front/src/lib/glitch.js` (lo puro en `glitchFrames.js`):
`commit` cambia el tema en el DOM de forma síncrona dentro de `document.startViewTransition`, y
las fotos vieja y nueva se animan con la Web Animations API: 14 cuadros en 650 ms (`GLITCH_MS`),
a saltos (`steps(1, end)`), precalculados una vez.

1. **RGB split**: un filtro SVG por foto y por cuadro que separa los canales (`feColorMatrix`) y
   corre el rojo y el azul a los lados (`feOffset`).
2. **Franjas desplazadas**: en el mismo filtro, un mapa de franjas con `feDisplacementMap` corre
   bandas horizontales de la imagen; además el tema nuevo aparece por bandas con cortes
   (`clip-path: polygon()`) y las dos fotos saltan con `translateX`.
3. **Ruido**: un `div.glitch-noise` a pantalla completa con estática pintada una vez en un
   `<canvas>` y su propio `view-transition-name`; parpadea y se mueve a saltos.

Mientras dura, `html.glitch-vt` apaga el fundido por defecto. Sin la API o con
`prefers-reduced-motion`: cambio inmediato. Un segundo cambio a mitad salta el primero y lo limpia.

## Módulos

Cada módulo vive en `back/app/modules/<clave>/` y `front/src/modules/<clave>/`; la barra sale
de `front/src/modules/registry.js`. Próximos: notas, tareas, finanzas, dashboard con datos.
