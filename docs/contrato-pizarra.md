# Contrato de Pizarra

Módulo `whiteboard`: pizarras a mano alzada con **Excalidraw** (`@excalidraw/excalidraw@0.18.1`).
Backend en `back/app/modules/whiteboard/` (`models.py`, `scene.py`, `service.py`, `router.py`;
migración `0005`), frontend en `front/src/modules/whiteboard/` (ruta `/pizarra`).

## Modelo

Tabla `whiteboards`: `id`, `user_id` (FK `users` `ON DELETE CASCADE`, índice), `name` VARCHAR(80)
(«Sin título» por defecto), `elements` JSONB, `app_state` JSONB, `files` JSONB, `element_count`,
`size_bytes`, `thumbnail` BYTEA (nulo), `thumbnail_type` (`image/png` o `image/webp`), `created_at`,
`updated_at`.

- `elements`: los elementos vivos de Excalidraw (los `isDeleted` se descartan al guardar).
- `app_state`: solo `viewBackgroundColor`, `gridSize`, `gridStep`, `gridModeEnabled`,
  `zoom: {value}`, `scrollX`, `scrollY`. El tema no se guarda: sigue al de la app.
- `files`: las imágenes `{id: {id, mimeType, dataURL, created, lastRetrieved?, version?}}`; se
  guardan solo las que usa algún elemento `image` de la escena.
- `element_count` y `size_bytes` (JSON compacto de `elements` + `files`) se calculan al guardar.

## API

`WhiteboardSummary` = `{ id, name, element_count, size_bytes, thumbnail_url, created_at, updated_at }` ·
`Whiteboard` = `WhiteboardSummary` + `{ elements, app_state, files }`.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/whiteboards` | | 200 `[WhiteboardSummary]`, de la última editada a la primera |
| `POST /api/whiteboards` | `{ name?, elements?, app_state?, files? }` | 201 `Whiteboard` |
| `GET /api/whiteboards/{id}` | | 200 `Whiteboard` |
| `GET /api/whiteboards/{id}/thumbnail?v=` | | 200 la imagen (PNG o WebP) · 404 `THUMBNAIL_NOT_FOUND` |
| `PATCH /api/whiteboards/{id}` | `{ name?, elements?, app_state?, files?, thumbnail? }` | 200 `Whiteboard` |
| `POST /api/whiteboards/{id}/duplicate` | | 201 `Whiteboard` («Copia de …», hasta 80) |
| `DELETE /api/whiteboards/{id}` | | 204 |

- Todas con sesión (`current_user`). La pizarra de otro usuario: 404 `WHITEBOARD_NOT_FOUND`
  (también su miniatura).
- La lista no trae la escena. `thumbnail_url` es `null` o `/api/whiteboards/{id}/thumbnail?v=<ms>`
  (cambia con cada edición, así se puede guardar en caché para siempre).
- `PATCH` cambia solo lo que viene. Sin `files`, se conservan las imágenes que siga usando la
  escena; sin `elements`, los `files` nuevos se recortan a los que usa la escena guardada.
  `thumbnail: null` la borra. **Todo cambio mueve `updated_at`.**
- Nombre: 1 a 80 caracteres sin espacios repetidos ni a los lados (422, `field = "name"`).
- La miniatura se sirve con `X-Content-Type-Options: nosniff` y `Content-Security-Policy: default-src 'none'`.

## Seguridad del contenido (`scene.py`)

El contenido es solo datos validados, **nunca HTML**. Excalidraw dibuja en un canvas, pero:

- **Tipos de elemento**: `rectangle, diamond, ellipse, arrow, line, freedraw, text, image, frame,
  magicframe`. **`embeddable` e `iframe` se rechazan** (cargarían páginas ajenas), igual que
  cualquier otro tipo.
- **Enlaces** (`link` de cualquier elemento): solo `http(s)` o `mailto`, hasta 2000 caracteres.
- **Imágenes** (`files`): solo `image/png, image/jpeg, image/webp, image/gif` como
  `data:<tipo>;base64,…`; la firma de los bytes debe coincidir con el tipo. Nada de SVG.
- **Miniatura**: PNG o WebP (por su firma), hasta 96 KB.
- Cada elemento: `id` de texto (1–100, sin repetir), `x/y/width/height` numéricos, claves con forma
  de identificador, números finitos, textos hasta 100 000 caracteres y hasta 6 niveles de anidación.
- `app_state`: solo las claves de arriba, con su tipo y rango (color `#rgb…#rrggbbaa` o
  `transparent`); cualquier otra: 422.

Errores: 422 `VALIDATION_ERROR` con `detail.field` (`elements`, `app_state`, `files`, `thumbnail` o
`name`). Topes (409):

| Tope | Código |
|---|---|
| 200 pizarras por usuario (`POST` y duplicar) | `WHITEBOARD_LIMIT` (`detail.max`) |
| 5 MB de `elements` + `files` | `WHITEBOARD_TOO_LARGE` (`detail.max_bytes`) |
| 10 000 elementos | `WHITEBOARD_TOO_MANY_ELEMENTS` (`detail.max`) |

## Frontend

**Lista (`/pizarra`)**: `PageHeader` «Pizarra» con «Nueva pizarra» (la crea y abre el editor).
Grilla de cards (2 a 5 columnas): la miniatura sobre un punteado, el nombre (tocarlo abre la
pizarra) y la fecha («Hace un momento», «Hoy, 14:05», «Ayer, …», «3 oct»). Menú «⋮»: Renombrar (el
nombre pasa a un campo; Enter o salir guardan, Esc cancela), Duplicar y Eliminar (con
confirmación). Estado vacío con «Crear mi primera pizarra».

**Miniatura**: la arma el navegador al guardar (`exportToBlob`, WebP de hasta 480 px, fondo
transparente, siempre en claro) y viaja como data URL que el servidor comprueba; en oscuro la card
la invierte con el mismo filtro que Excalidraw usa para el lienzo. Se eligió así (y no un SVG ni
dibujarla en la lista) porque un PNG/WebP comprobado por su firma no puede llevar código, la lista
no tiene que cargar Excalidraw ni las escenas, y se sirve aparte con caché.

**Editor (`/pizarra?id=12`)**: el registro declara solo `/pizarra`, así que la pizarra abierta va
en la búsqueda (sin tocar `App.jsx`). Excalidraw en español (`langCode="es-ES"`) con el tema de la
app (`useTheme`) y el acento de la app en sus controles. Ocupa el alto disponible del panel en un
marco fijo (`.wb-editor-frame`): a la derecha de la barra de módulos en PC y encima de la barra
flotante en el celular. Barra propia de vidrio: «‹ Pizarras», el nombre editable y «Guardado» /
«Guardando…» (o el error).

- **Guardado automático**: 1 s después del último cambio de la escena, el fondo o la cuadrícula,
  de a uno por vez, con el zoom y el desplazamiento de ese momento (moverse por el lienzo solo no
  cuenta como edición). `files` viaja solo si cambió el conjunto de imágenes y la miniatura solo si
  cambiaron los elementos. Al salir del editor se manda lo pendiente (la lista espera ese guardado,
  `saveQueue.js`); al cerrar la pestaña, con `fetch` `keepalive`. Sin botón «Guardar».
- Antes de mandar la escena, `sanitizeScene` (`sceneLogic.js`) aplica las mismas reglas que el
  servidor: quita borrados, `embeddable`/`iframe`, enlaces que no son `http(s)`/`mailto` e imágenes
  SVG (con un aviso en la barra). `validateEmbeddable={false}`: pegar un enlace no crea una página
  incrustada, y su herramienta no se muestra.
- Menú principal: Abrir (`.excalidraw`), Guardar en… (`.excalidraw` en el disco), Exportar imagen
  (PNG o SVG), Ayuda, Limpiar lienzo y Fondo del lienzo. Sin «Guardar» en un archivo abierto, sin
  cambio de tema, sin colaboración ni IA (`aiEnabled={false}`).
- Si el zoom y el desplazamiento guardados no dejan nada a la vista (p. ej. de PC a celular), se
  centra el dibujo.

**Recursos**: Excalidraw (y sus estilos e idiomas) va en su propio chunk perezoso
(`WhiteboardEditor`), que no entra en el principal. Las fuentes se sirven desde la app
(`front/public/excalidraw/fonts`, copiadas de `node_modules/@excalidraw/excalidraw/dist/prod/fonts`;
`window.EXCALIDRAW_ASSET_PATH = '/excalidraw/'` en `assetPath.js`, cargado antes del editor). Al
abrir se cargan las cuatro letras del selector y, si un texto guardado se había medido con otra
letra, se vuelve a medir (si no, quedaría cortado). Al actualizar Excalidraw hay que volver a
copiar las fuentes.

## Pruebas

- `back/tests/test_whiteboard.py`: CRUD, lista liviana y orden, nombres, lista blanca de tipos,
  `embeddable`/`iframe` rechazados, enlaces, `app_state`, archivos (tipos, firmas, SVG, recorte de
  los que no se usan), miniatura, topes, duplicar y aislamiento entre usuarios.
- `front/src/modules/whiteboard/sceneLogic.test.js`: `pickAppState`, `sanitizeScene`, enlaces,
  nombres y fechas.
- `front/e2e/whiteboard.spec.js`: crear, dibujar un rectángulo y un texto con el teclado,
  «Guardado», recargar, miniatura, renombrar, duplicar y eliminar (PC); en el celular, el editor y
  su barra por encima de la barra de módulos. En las dos, ningún pedido a una CDN.
