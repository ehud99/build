# Finanzas (gastos e ingresos)

Módulo `finance`: `back/app/modules/finance/` (modelos, servicio y router; migración `0004`) y
`front/src/modules/finance/` (ruta `/finanzas`). Como la app «Gestor de gastos, ingresos»: arriba
el **balance** y las pestañas **Gastos | Ingresos**; en la hoja, **Día | Semana | Mes | Año |
Período** con ‹ ›, la **dona** por categorías y su lista; el **+** agrega un movimiento.

## Dinero

- **Nunca `float`.** Los montos son `Numeric(12, 2)` en la base, `Decimal` en Python y **texto**
  en el JSON (`"24855.50"`, siempre con 2 decimales en las respuestas).
- Al enviar: texto con punto, hasta 9 cifras enteras y 2 decimales, mayor que 0 y como mucho
  `999999999.99` (regex `^(0|[1-9]\d{0,8})(\.\d{1,2})?$`). Un número JSON, coma, signo o exponente
  → 422 `VALIDATION_ERROR` con `detail.field = "amount"`.
- Totales, balance y porcentajes los calcula el servidor (`SUM` en SQL y `Decimal`). El frontend
  solo formatea el texto (`money.js`: `Intl.NumberFormat('es')` con el texto directo y el símbolo
  de la moneda detrás, `24.855,50 S/`); el campo del monto acepta coma o punto.

## Tablas

| Tabla | Columnas |
|---|---|
| `finance_settings` | `user_id` (PK), `currency` (`PEN` por defecto). Su fila marca que ya se sembró. |
| `finance_categories` | `user_id`, `kind` (`expense`\|`income`), `name` (1–40), `icon`, `color`, `position`, `archived` |
| `finance_transactions` | `user_id`, `kind`, `category_id` (RESTRICT), `amount` `Numeric(12,2)` > 0, `occurred_on`, `note` (0–200), `created_at` |

**Siembra** (idempotente): al primer acceso a cualquier ruta se inserta `finance_settings` con
`ON CONFLICT DO NOTHING`; solo quien la inserta crea las categorías de fábrica.
Gastos: Alimentación, Transporte, Compras, Casa, Salud, Ocio, Educación, Servicios, Regalos, Otros.
Ingresos: Sueldo, Extras, Regalos, Inversiones, Otros.

**Íconos** (lista blanca, `service.ICONS` = `palette.js` `ICON_KEYS`; `icons.js` los lleva a
lucide): cart, bag, home, rent, car, taxi, bus, train, bike, fuel, plane, travel, food, pizza,
coffee, health, pill, gift, party, game, movie, music, education, book, pet, clothes, beauty, baby,
gym, sport, wifi, phone, laptop, tv, electricity, water, gas, tools, insurance, tax, card, bank,
salary, cash, coins, savings, investment, other.

**Colores** (`service.COLORS` = `COLOR_KEYS`, tokens `--fin-<clave>` de `finance.css` en claro y
oscuro): red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, pink, brown, gray.

**Monedas**: PEN, USD, EUR, MXN, COP, ARS, CLP.

## API

Todas con sesión (`current_user`); un recurso de otro usuario responde 404.

`Category` = `{ id, kind, name, icon, color, position, archived }`
`Transaction` = `{ id, kind, category_id, amount: "12.50", occurred_on: "2026-10-31", note, created_at }`

| Método y ruta | Cuerpo / parámetros | Respuesta |
|---|---|---|
| `GET /api/finance/settings` | | `{ currency, currencies, today }` |
| `PUT /api/finance/settings` | `{ currency }` | lo mismo |
| `GET /api/finance/categories?kind=` | | `[Category]` (también las archivadas), por `kind`, `position` |
| `POST /api/finance/categories` | `{ kind, name, icon, color }` | 201 `Category` (al final) |
| `PATCH /api/finance/categories/{id}` | `{ kind?, name?, icon?, color?, archived?, position? }` | `Category` |
| `DELETE /api/finance/categories/{id}` | | 204 |
| `GET /api/finance/summary?kind=&from=&to=` | sin fechas: el mes de hoy | `Summary` |
| `GET /api/finance/transactions?from&to&kind&category_id` | todos opcionales | `{ items: [Transaction], total, count }` (más recientes primero, hasta 1000) |
| `POST /api/finance/transactions` | `{ kind, category_id, amount, occurred_on?, note? }` (sin fecha: hoy) | 201 `Transaction` |
| `PATCH /api/finance/transactions/{id}` | `{ category_id?, amount?, occurred_on?, note? }` (el `kind` no cambia) | `Transaction` |
| `DELETE /api/finance/transactions/{id}` | | 204 |

`Summary`:
```json
{
  "kind": "expense", "from": "2026-10-01", "to": "2026-10-31", "today": "2026-10-31",
  "balance": "2519.05", "total": "2330.95", "currency": "PEN",
  "categories": [
    { "category": Category, "total": "1200.00", "share": "0.514812", "percent": "51.5", "count": 1 }
  ]
}
```

- `balance`: ingresos − gastos **de todo el tiempo** (puede ser negativo).
- `categories`: solo las que tienen movimientos en el periodo, de mayor a menor. `share` es la
  fracción (6 decimales, para la dona) y `percent` el porcentaje con 1 decimal (redondeo
  `ROUND_HALF_UP`; pueden no sumar 100,0).
- Fechas `from`/`to` incluidas, del 2000 al 2100; las dos o ninguna; `from` ≤ `to` (si no, 422
  `VALIDATION_ERROR` con `detail.field`). «Hoy» se calcula en `APP_TIMEZONE`.

Errores:
- 404 `CATEGORY_NOT_FOUND`, `TRANSACTION_NOT_FOUND`.
- 422 `CATEGORY_KIND_MISMATCH`: la categoría es del otro tipo.
- 409 `CATEGORY_ARCHIVED`: no se agregan movimientos a una archivada (sigue en el resumen).
- 409 `CATEGORY_IN_USE` (`detail.count`): borrar una categoría con movimientos (se ofrece
  archivarla) o cambiarle el tipo.
- 409 `CATEGORY_NAME_TAKEN`: otro nombre igual (sin mayúsculas) activo del mismo tipo.
- 409 `CATEGORY_LIMIT`: más de 50 categorías de un tipo.

## Frontend

- `dates.js` (puro, con pruebas): días como `YYYY-MM-DD` en UTC, semana desde el lunes,
  `periodRange`, `shiftPeriod` (un rango propio se corre su largo), `switchMode` y las etiquetas
  «Hoy, 31 de octubre», «Ayer, …», «Miércoles, 28 de octubre», «26 oct – 1 nov», «Octubre 2026»,
  «2026». «Hoy» viene del servidor.
- `money.js`, `donut.js` (tramos con `pathLength="100"` y un hueco entre ellos), `palette.js`:
  puros, con pruebas `node:test`.
- Bloque del balance `.fin-hero` (degradado del acento con `text-accent-fg`), hoja `bg-surface`.
- Dona SVG a mano; sin datos, anillo `--fin-ring` y «Sin gastos en este periodo».
- Tocar una categoría abre sus movimientos del periodo (editar y borrar) y «Editar categoría».
- **+** flotante (`.fin-fab`, sobre la barra del celular) → «Nuevo gasto» / «Nuevo ingreso» según
  la pestaña: monto grande (`inputMode="decimal"`), categorías con «+ Crear», fecha y nota.
  `Sheet`: hoja desde abajo en < 768 px y modal en PC; Escape cierra la de arriba.
- «Crear nueva categoría»: nombre, Gastos ○ Ingresos, «Símbolos» y «Color». Al editar: Archivar o
  Desarchivar y Borrar.
- «⋯» de la cabecera: «Categorías» (todas, también las archivadas) y la moneda.
- Con `prefers-reduced-motion` no hay animaciones de hoja ni de la dona.
