# Contrato del Dashboard (Inicio, `/inicio`)

El Inicio del panel muestra **un mes a la vez** (‹ Octubre 2026 ›, `?mes=YYYY-MM`; sin parámetro,
el mes de hoy del servidor). El mismo mes vale para los objetivos, las horas y las finanzas; el
mapa de calor es del año de ese mes. Reemplaza el «En desarrollo» de v1. El gráfico y las
categorías de gastos que antes estaban en Finanzas viven aquí.

Backend: rutas nuevas del módulo `goals` (`back/app/modules/goals/stats.py`, sin migraciones).
Frontend: `front/src/modules/dashboard/` y los gráficos reutilizables en
`front/src/components/charts/` (SVG a mano, sin librerías). Finanzas se lee con sus rutas de
siempre (`/finance/summary`, `/finance/settings`); el Dashboard no importa otros módulos.

## Reglas de cálculo (servidor)

Todo en enteros y `Decimal`; los decimales viajan como **texto**.

- **Días transcurridos** (`elapsed_days`): en el mes actual, hasta hoy incluido (`APP_TIMEZONE`);
  en uno pasado, todos; en uno futuro, 0.
- **Puntaje** (`score`): marcas del mes en los días transcurridos. **Máximo** (`max_score`):
  objetivos × días del mes (el «puntaje final» de la hoja).
- **Compromiso** (`commitment`): `score / (objetivos × días transcurridos)` en %, 1 decimal,
  `ROUND_HALF_UP` (`"61.9"`); `null` si la base es 0. Es el «71 % Compromiso» de la hoja de papel,
  pero sobre los días que ya pasaron.
- **Mes anterior** (`previous`): lo mismo para el mes anterior; `commitment_delta` es la diferencia
  en puntos (`"13.6"`, `"-1.2"`), `null` si falta alguno de los dos.
- **Por día de la semana**: lunes (0) a domingo (6) sobre los días transcurridos; `possible` =
  objetivos × días de ese tipo, `done` = marcas esos días.
- **Por objetivo**: `done`, `possible` (= días transcurridos), `percent`, `current_streak`,
  `best_streak`, `full_month`. Rachas con las reglas de `modules/goals/score.js`: días seguidos
  dentro del mes; la actual termina hoy o ayer y solo existe en el mes actual.
- **Más y menos cumplido** (`best_goal_id`, `worst_goal_id`): por marcas, con 2 o más objetivos y si
  no todos empatan; en empate gana el primero de la hoja. Si no, `null`.
- **Rachas**: `active` = objetivos con racha actual ≥ 2; `best_current` = la racha actual más larga;
  `best` = la mejor racha del mes (`{goal_id, title, days}`) o `null`.
- **Horas**: `total`, `worked_days` (días con horas), `average` = total / días trabajados (1
  decimal, `ROUND_HALF_UP`, `null` sin días), `daily` (todos los días del mes, `"0"` sin horas) y
  `weeks` (lunes a domingo, recortadas al mes: `{from, to, start_day, end_day, hours, worked_days}`).
- **Mapa de calor**: por día del año, hasta hoy, solo de los meses con objetivos: marcas de ese día y
  objetivos de su mes.

## API

Ambas con `Depends(current_user)`: cada usuario ve solo lo suyo.

| Método y ruta | Respuesta |
|---|---|
| `GET /api/goals/stats?month=YYYY-MM` | `Stats` (sin `month`: el actual). 422 `VALIDATION_ERROR` `field: "month"` |
| `GET /api/goals/heatmap?year=YYYY` | `Heatmap` (sin `year`: el actual; 2000–2100, si no 422 `field: "year"`) |

`Stats`:
```json
{
  "month": "2026-10", "today": "2026-10-31", "days_in_month": 31, "elapsed_days": 31,
  "goals_count": 5, "score": 96, "max_score": 155, "possible": 155, "commitment": "61.9",
  "previous": { "month": "2026-09", "days_in_month": 30, "elapsed_days": 30, "goals_count": 6,
                "score": 87, "max_score": 180, "possible": 180, "commitment": "48.3" },
  "commitment_delta": "13.6",
  "daily": [{ "day": 1, "score": 4, "elapsed": true }],
  "weekdays": [{ "weekday": 0, "done": 14, "possible": 20, "percent": "70.0" }],
  "goals": [{ "id": 7, "title": "Dormir 8 horas", "position": 0, "done": 27, "possible": 31,
              "percent": "87.1", "current_streak": 5, "best_streak": 19, "full_month": false }],
  "best_goal_id": 7, "worst_goal_id": 10,
  "streaks": { "active": 2, "best_current": 5, "best": { "goal_id": 7, "title": "Dormir 8 horas", "days": 19 } },
  "hours": { "total": "156.5", "worked_days": 20, "average": "7.8",
             "daily": [{ "day": 1, "hours": "8" }],
             "weeks": [{ "from": "2026-10-01", "to": "2026-10-04", "start_day": 1, "end_day": 4,
                         "hours": "16.5", "worked_days": 2 }] }
}
```

`Heatmap` = `{ "year": 2026, "today": "2026-10-31", "days": [{ "date": "2026-10-01", "done": 4, "goals": 5 }] }`

## Pantalla

- Cabecera «Inicio» con ‹ mes › (`dash-month-prev`, `dash-month-label`, `dash-month-next`).
- **Indicadores**: Compromiso (anillo con el %, `score / possible` y el puntaje final si el mes no
  ha terminado), vs. mes anterior (± puntos con flecha y «Subió / Bajó» para el lector, verde o rojo
  con ícono), Rachas activas (con la mejor del mes y su llama del color de su nivel, `.streak-badge`
  y los tokens `--fire-*`) y Horas del mes (con el promedio por día trabajado).
- **Objetivos**: puntaje por día (columnas; los días que aún no llegan no tienen barra), por día de
  la semana (L M M J V S D, % de 0 a 100) y la lista por objetivo con su barra, %, racha actual
  (desde 2 días, como en Objetivos) y mejor; el más y el menos cumplido van marcados con texto e ícono.
- **Año**: mapa de calor tipo GitHub (semanas en columnas de lunes a domingo, cuadros de 11 a 16 px
  según el ancho; en el celular la caja se desplaza y abre en el mes elegido, con los días de la
  semana fijos). Niveles por % del día: 0 %, hasta 25, 50, 75 y más (`heatLevel`, en enteros);
  «Sin objetivos» aparte. Hoy lleva borde.
- **Horas trabajadas**: columnas por día y totales por semana.
- **Finanzas**: Balance (de todo el tiempo), Gastos e Ingresos del mes, «Gastos | Ingresos» con la
  dona y la lista de categorías (`components/money`: `Donut`, `CategoryIcon`, `formatMoney`) y
  «Ir a Finanzas». **Sin «Neto»**: el resumen no lo trae y el navegador no suma dinero.
- Estados vacíos con enlace: «Crea tus objetivos del mes» (mes actual o futuro), «Anota las horas
  de hoy en Objetivos», «Registra tu primer gasto».
- Carga en paralelo (estadísticas, mapa y finanzas por separado), cada sección con su esqueleto; al
  cambiar de mes se conserva lo anterior atenuado hasta que llega lo nuevo (`useLoad`).

## Gráficos (`components/charts/`)

Hechos con la skill `dataviz`: una serie por gráfico (sin leyenda; el título la nombra), columnas de
hasta 24 px con el extremo redondeado de 4 px y la base cuadrada, guías finas sólidas, texto con
tokens de texto. Colores validados con `validate_palette.js` en claro (`#fff`) y oscuro (`#1f1d17`):
`--chart-goal` y `--chart-hours` (banda, croma, CVD y contraste ≥ 3:1) y la rampa ordinal del mapa
`--heat-1…4` (un tono, el del acento; extremo tenue ≥ 2:1), en `charts.css`.

- `ColumnChart`: globo por franja (más ancha que la barra) al pasar el mouse o tocar; enfocable,
  con ←/→, Inicio y Fin recorre las barras.
- `Heatmap`: globo por cuadro; enfocable, ←/→ una semana, ↑/↓ un día (la primera flecha va a hoy).
- `Ring`: medidor con la pista del mismo tono, más clara.
- `DataTable`: «Ver datos», la tabla gemela de cada gráfico.
- Puros con pruebas (`node --test`): `scale.js` (`niceMax`, `ticks`, `bandLayout`, `columnPath`,
  `stepIndex`), `heatmap.js` (`yearGrid`, `heatLevel`, `moveCell`, `heatValue`) y
  `modules/dashboard/format.js`.
- Con `prefers-reduced-motion`, sin transiciones ni esqueletos que laten.

## Pruebas

- `back/tests/test_goals_stats.py`: compromiso, mes anterior, por día y día de la semana, rachas
  (hoy, ayer, empates), mes pasado y futuro, horas por semana y promedio, mapa de calor y aislamiento.
- `front/e2e/dashboard.spec.js`: estado vacío de un usuario nuevo; con objetivos, marca, horas, un
  gasto y un ingreso, los números de cada sección, el teclado en los gráficos y el cambio de mes.
