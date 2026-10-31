/**
 * Excalidraw 0.18 busca sus fuentes en `window.EXCALIDRAW_ASSET_PATH` y, si no está, en una CDN
 * (esm.sh). Las servimos desde la propia app (`public/excalidraw/fonts`, copiadas del paquete):
 * este módulo se carga antes que el editor (ver `WhiteboardPage.jsx`).
 */
window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';
