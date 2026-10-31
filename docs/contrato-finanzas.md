# Finanzas (gastos e ingresos)

Módulo `finance`: `back/app/modules/finance/` (modelos, servicio y router; migración `0004`) y
`front/src/modules/finance/` (ruta `/finanzas`). Finanzas es la **libreta de movimientos**: el mes
con ‹ ›, los totales del mes (Ingresos, Gastos, Neto), los filtros, la lista de gastos e ingresos
agrupada por día, el **+**, las categorías y la moneda. Las **estadísticas** (balance de siempre,
dona, porcentajes y los periodos Día | Semana | Mes | Año | Período) viven en el **Dashboard**, que
usa `GET /api/finance/summary` y `GET /api/finance/settings` y lo compartido de
`front/src/components/money/`.

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

**Colores** (`service.COLORS` = `COLOR_KEYS`, tokens `--fin-<clave>` de `components/money/money.css` en claro y
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
| `GET /api/finance/ledger?month=&kind=&category_id=` | `month` = `AAAA-MM` (sin él, el de hoy) | `Ledger` |
| `GET /api/finance/summary?kind=&from=&to=` | sin fechas: el mes de hoy (lo usa el Dashboard) | `Summary` |
| `GET /api/finance/transactions?from&to&kind&category_id` | todos opcionales | `{ items: [Transaction], total, count }` (más recientes primero, hasta 1000) |
| `POST /api/finance/transactions` | `{ kind, category_id, amount, occurred_on?, note? }` (sin fecha: hoy) | 201 `Transaction` |
| `PATCH /api/finance/transactions/{id}` | `{ category_id?, amount?, occurred_on?, note? }` (el `kind` no cambia) | `Transaction` |
| `DELETE /api/finance/transactions/{id}` | | 204 |

`Ledger` (la libreta de Finanzas):
```json
{
  "month": "2026-10", "today": "2026-10-31", "currency": "PEN",
  "totals": { "income": "3750.00", "expense": "1801.29", "net": "1948.71" },
  "days": [
    { "date": "2026-10-31", "income": "0.00", "expense": "271.19", "net": "-271.19",
      "transactions": [ Transaction + { "category": { id, name, icon, color, archived } } ] }
  ]
}
```

- Solo los días con movimientos, del más nuevo al más viejo; dentro del día, del más nuevo (mayor
  `id`) al más viejo. Sin tope de filas.
- `totals` y los de cada día salen de `SUM` en SQL agrupado por día y tipo (`Decimal`, texto con 2
  decimales) y **siguen a los filtros**: con `kind=expense`, `income` es `"0.00"`. El frontend no suma.
- `month` inválido (`2026-13`, `2026-1`, `1999-12`, `2101-01`…) → 422 `VALIDATION_ERROR` con
  `detail.field = "month"`. `category_id` de otro usuario → 404 `CATEGORY_NOT_FOUND`; de otro tipo
  que `kind`, lista vacía.

`Summary` (del Dashboard):
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

- `FinancePage`: `PageHeader` «Finanzas» con el «⋯» (Categorías y Moneda). Una tarjeta con el mes
  («Octubre 2026», ‹ › del 2000-01 al 2100-12) y la franja **Ingresos (+) | Gastos (−) | Neto**
  (`text-success` / `text-danger`, `text-text-muted` en cero). Debajo, los chips **Todos | Gastos |
  Ingresos** y un `<select>` de categoría (las del tipo elegido, también las archivadas).
- URL: `?mes=AAAA-MM` (sin él, el mes de hoy del servidor), `?tipo=gastos|ingresos` y `?cat=<id>`;
  se cambian con `replace`. Al pasar a un tipo, la categoría del otro tipo se quita.
- La lista agrupada por día: «Hoy», «Ayer», «Jueves, 29 de octubre» (con el año si no es el de hoy)
  y el neto del día; cada fila con `CategoryIcon`, la categoría, la nota en gris y el monto con
  signo y color (ingreso `+`, gasto `−`). Tocar una fila abre «Editar gasto/ingreso» con «Borrar».
  Mientras llegan otros filtros se ve la libreta anterior atenuada.
- Vacío: «Sin movimientos en octubre» con «Agregar movimiento»; con filtros, «Nada con estos
  filtros» y «Quitar filtros».
- **+** flotante (`.fin-fab`, sobre la barra del celular) → «Nuevo movimiento» con el selector
  **Gasto | Ingreso** (empieza en el tipo del filtro, o Gasto): monto grande (`inputMode="decimal"`),
  categorías del tipo con «+ Crear», fecha y nota. Al cambiar de tipo se borra la categoría elegida.
  Al editar el tipo no cambia (no hay selector). Uno nuevo con fecha de otro mes lleva a ese mes.
- `Sheet`: hoja desde abajo en < 768 px y modal en PC; Escape cierra la de arriba.
- «Crear nueva categoría»: nombre, Gastos ○ Ingresos, «Símbolos» y «Color». Al editar: Archivar o
  Desarchivar y Borrar. «⋯» › «Categorías»: todas, también las archivadas.
- `ledger.js` (puro, con pruebas `node:test`): `parseMonth`, `shiftMonth`, `monthLabel`,
  `dayHeading`, `signedMoney` (signo `+`/`−` delante del texto formateado, sin sumar) y `netTone`.
  Lo de dinero y categorías (`money.js`, `CategoryIcon`, `palette.js`, `money.css`) es de
  `components/money/`, compartido con el Dashboard.
- Con `prefers-reduced-motion` no hay animaciones de hoja ni transiciones.
