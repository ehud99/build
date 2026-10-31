# Contrato de Notas

Módulo `notes`: las notas de cada usuario, en cards tipo **Google Keep** y con un editor tipo
**Notas del iPhone**. Backend en `back/app/modules/notes/` (`models.py`, `content.py`, `service.py`,
`router.py`; migración `0003`), frontend en `front/src/modules/notes/` (ruta `/notas`).

## Modelo

Tabla `notes`: `id`, `user_id` (FK `users` `ON DELETE CASCADE`, índice), `content` JSONB (el documento
de Tiptap ya validado), `plain` TEXT, `title` VARCHAR(200), `preview` JSONB, `color` (clave de la
paleta), `pinned` bool, `created_at`, `updated_at`.

`title`, `plain` y `preview` **se derivan en el servidor** al guardar (`content.derive`):

- `title`: la primera línea con texto, sin saltos ni espacios repetidos, hasta 200 caracteres.
- `plain`: todo el texto, una línea por renglón (es lo que mira el buscador).
- `preview`: `{ "lines": [Line, …], "more": 3 }`: las líneas que siguen al título (las vacías
  seguidas quedan en una y no hay vacías al principio ni al final), hasta 10 y cada una hasta 240
  caracteres; `more` cuenta las que no entran.

`Line` = `{ "kind": "text" | "heading" | "bullet" | "ordered" | "task" | "quote" | "rule", "text": "…",
"depth": 0 }`, más `checked` (task), `n` (ordered) o `level` (heading).

Colores (paleta fija tipo Keep): `default, red, orange, yellow, green, teal, blue, purple, pink,
brown, gray`. Los tonos de claro y oscuro viven en `notes.css` (`--note-*`).

## API

`NoteSummary` = `{ id, title, preview, color, pinned, created_at, updated_at }` ·
`Note` = `NoteSummary` + `content`.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/notes?q=` | | 200 `[NoteSummary]`: fijadas primero, luego `updated_at` desc |
| `POST /api/notes` | `{ content, color?, pinned? }` | 201 `Note` |
| `GET /api/notes/{id}` | | 200 `Note` |
| `PATCH /api/notes/{id}` | `{ content?, color?, pinned? }` | 200 `Note` |
| `DELETE /api/notes/{id}` | | 204 |

- Todas con sesión (`current_user`). La nota de otro usuario: 404 `NOTE_NOT_FOUND`.
- `q` busca sin distinguir mayúsculas en `plain` (`ILIKE`, con `%` y `_` literales; hasta 200).
- La lista no trae `content` (puede pesar); el editor pide la nota completa al abrirla.
- **Solo un cambio de `content` mueve `updated_at`.** Fijar o cambiar el color no cuenta como
  editar (como Keep): no reordena las «Otras» ni cambia la fecha del editor.
- `POST` con un documento sin texto: 422 `VALIDATION_ERROR` (`detail.field = "content"`). `PATCH`
  sí acepta dejarla vacía, pero el editor no lo manda: borra la nota al cerrarla vacía.
- 409 `NOTE_LIMIT` (`detail.max`) al pasar de **2000** notas por usuario.
- 422 `VALIDATION_ERROR` para un color fuera de la paleta.

## Seguridad del contenido

El contenido es solo datos validados, **nunca HTML** (`content.validate`). Lista blanca:

- Nodos: `doc`, `paragraph`, `heading` (`attrs.level` 1–3, obligatorio), `text` (no vacío),
  `hardBreak`, `bulletList`, `orderedList` (`attrs.start` entero, `attrs.type` `1 a A i I` o
  `null`), `listItem`, `taskList`, `taskItem` (`attrs.checked` bool, obligatorio), `blockquote`,
  `horizontalRule`. Cada nodo solo admite los hijos que admite Tiptap (por ejemplo un `bulletList`
  solo `listItem`).
- Marcas: `bold`, `italic`, `underline`, `strike` y `link` con `href` `http(s)` o `mailto`
  (`target`, `rel`, `class`, `title` como texto o `null`).
- Cualquier otra clave, nodo, marca o atributo: 422 `VALIDATION_ERROR` (`detail.field = "content"`).
- Tope de **200 KB** del JSON compacto y de 24 niveles de anidación.

El frontend arma la vista previa de las cards desde `preview` con elementos de React; el editor
solo carga extensiones que coinciden con la lista blanca (sin `code`, `codeBlock` ni
`trailingNode`; enlaces solo `http(s)`/`mailto`). Nunca `dangerouslySetInnerHTML`.

## Frontend

**Lista (`NotesPage`)**: `PageHeader` «Notas» con el buscador «Buscar notas» (300 ms). En PC la
barra «Crear una nota…»; en el celular el «+» flotante encima de la barra de abajo. Cards en
mampostería (`masonry` en `notesLogic.js`: cada card a la columna más corta; 2 a 5 columnas según
el ancho), secciones «Fijadas» y «Otras» (sin títulos si no hay fijadas). Cada card: título,
vista previa (casillas redondas, las marcadas tachadas; «+N» si hay más), su color y, al pasar el
mouse (siempre en pantallas táctiles, al 60 %), fijar, color (paleta de círculos) y eliminar
(con confirmación).

**Editor (`NoteEditor`)**, como Notas del iPhone:

- Pantalla completa en el celular (entra desde la derecha); en PC un panel grande centrado sobre
  un velo (`--note-scrim`). Toma el color de la nota.
- Cabecera: «‹ Notas» (guarda y cierra), lista de verificación, «Aa», «⋯» (Fijar/Desfijar, Color,
  Eliminar con confirmación) y «OK» mientras se escribe (quita el foco).
- La fecha centrada en gris («31 de octubre de 2026, 15:02», `formatNoteDate`).
- **La primera línea es el título** por CSS: el primer bloque, si es un párrafo, se ve grande y en
  negrita (el documento no cambia, y el servidor toma esa línea como `title`). Se eligió así porque
  no obliga a ningún tipo de nodo al principio ni pelea con las listas. «Cuerpo» en la primera
  línea no la achica.
- Panel «Aa»: Título (h1), Encabezado (h2), Subencabezado (h3), Cuerpo; **B** *I* U S; viñetas,
  numerada y lista de verificación. No le quita el foco al texto.
- Casillas redondas (la `label` es el círculo; marcada: círculo de acento con check) y el ítem
  marcado en gris. Enter en un ítem vacío sale de la lista.
- Placeholders «Título» y «Escribe algo…».
- Guardado automático a los 600 ms, en cola (nunca dos escrituras a la vez). Una nota nueva se crea
  recién cuando tiene texto; si se cierra vacía, no queda nada; una existente que queda vacía no se
  guarda vacía y se borra al cerrar. Si falla el guardado, el editor no se cierra y avisa; un
  segundo «‹ Notas» cierra igual.
- Esc cierra (o cierra primero el menú o la confirmación); ⌘/Ctrl+B/I/U.
- Con `prefers-reduced-motion` no hay animaciones.

## Pruebas

- `back/tests/test_notes.py`: CRUD, derivados, orden, búsqueda, paleta, lista blanca, tamaño,
  anidación, tope de notas y aislamiento entre usuarios.
- `front/src/modules/notes/notesLogic.test.js`: paleta, fecha, orden, mampostería, documento vacío.
- `front/e2e/notes.spec.js`: el recorrido completo (crear, buscar, negrita, lista marcada, fijar,
  color, recargar, eliminar), la nota vacía que no queda y el «+» del celular a pantalla completa.
