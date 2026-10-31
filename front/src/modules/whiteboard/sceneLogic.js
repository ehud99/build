/**
 * Lo puro de la pizarra (docs/contrato-pizarra.md): qué se guarda de una escena de Excalidraw y
 * cómo se limpia antes de mandarla, con las mismas reglas que valida el servidor (`scene.py`).
 * Sin React ni Excalidraw, para probarlo con `node --test`.
 */

/** Tipos de elemento que acepta el servidor (sin `embeddable` ni `iframe`). */
export const ELEMENT_TYPES = new Set([
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
  'image',
  'frame',
  'magicframe',
]);

/** Imágenes que se guardan (nada de SVG). */
export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const NAME_MAX = 80;
export const DEFAULT_NAME = 'Sin título';

const LINK_RE = /^\s*(https?:|mailto:)/i;

/** `true` si el enlace es `http(s)` o `mailto` (o no hay enlace). */
export function isSafeLink(link) {
  return link == null || link === '' || (typeof link === 'string' && link.length <= 2000 && LINK_RE.test(link));
}

/** Solo lo que vale la pena guardar de la vista: fondo, cuadrícula, zoom y desplazamiento. */
export function pickAppState(appState = {}) {
  const out = {};
  const bg = appState.viewBackgroundColor;
  if (typeof bg === 'string' && /^(#[0-9a-fA-F]{3,8}|transparent)$/.test(bg)) out.viewBackgroundColor = bg;
  if (Number.isInteger(appState.gridSize) && appState.gridSize >= 1 && appState.gridSize <= 100) out.gridSize = appState.gridSize;
  if (Number.isInteger(appState.gridStep) && appState.gridStep >= 1 && appState.gridStep <= 100) out.gridStep = appState.gridStep;
  if (typeof appState.gridModeEnabled === 'boolean') out.gridModeEnabled = appState.gridModeEnabled;
  const zoom = appState.zoom?.value;
  if (Number.isFinite(zoom) && zoom >= 0.05 && zoom <= 40) out.zoom = { value: zoom };
  for (const key of ['scrollX', 'scrollY']) {
    const v = appState[key];
    if (Number.isFinite(v) && Math.abs(v) <= 1e9) out[key] = v;
  }
  return out;
}

/** Lo que se muestra al volver a abrir la pizarra (el resto lo pone Excalidraw por defecto). */
export function initialAppState(saved = {}) {
  const out = { ...saved };
  if (saved.zoom) out.zoom = { value: saved.zoom.value };
  return out;
}

/**
 * La escena lista para el servidor:
 * - sin los borrados ni los tipos fuera de la lista (p. ej. `embeddable`);
 * - los enlaces que no son `http(s)`/`mailto`, quitados;
 * - las imágenes sin archivo o con un tipo que no se guarda (SVG), fuera, y `dropped` las cuenta;
 * - `files`, solo los que usa una imagen de la escena.
 */
export function sanitizeScene(elements = [], files = {}) {
  const out = [];
  let dropped = 0;
  const used = {};
  for (const el of elements) {
    if (!el || el.isDeleted) continue;
    if (!ELEMENT_TYPES.has(el.type)) {
      dropped += 1;
      continue;
    }
    let next = el;
    if (!isSafeLink(el.link)) next = { ...next, link: null };
    if (el.type === 'image') {
      const file = el.fileId ? files[el.fileId] : null;
      if (!file || !IMAGE_TYPES.has(file.mimeType) || typeof file.dataURL !== 'string') {
        // Una imagen que aún no terminó de cargar se guarda sin archivo; la de tipo no permitido, no.
        if (file && !IMAGE_TYPES.has(file.mimeType)) {
          dropped += 1;
          continue;
        }
      } else {
        const { id, mimeType, dataURL, created, lastRetrieved, version } = file;
        used[el.fileId] = { id, mimeType, dataURL, created, lastRetrieved, ...(version != null ? { version } : {}) };
      }
    }
    out.push(next);
  }
  return { elements: out, files: used, dropped };
}

/** Una clave de las imágenes de la escena: si no cambia, no hace falta volver a mandarlas. */
export function filesKey(files = {}) {
  return Object.keys(files).sort().join('|');
}

/** Nombre sin espacios repetidos ni a los lados, hasta 80; vacío → `null` (no se guarda). */
export function cleanName(value) {
  const name = String(value ?? '').split(/\s+/).filter(Boolean).join(' ');
  if (!name) return null;
  return name.slice(0, NAME_MAX);
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/**
 * La fecha de la card: «Hace un momento», «Hace 5 min», «Hoy, 14:05», «Ayer, 09:30», «3 oct» o
 * «3 oct 2025» si es de otro año.
 */
export function formatEdited(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86400000);
  if (days === 0) return `Hoy, ${hhmm}`;
  if (days === 1) return `Ayer, ${hhmm}`;
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Inserta o reemplaza una pizarra en la lista y la deja primera (la más reciente). */
export function upsertBoard(list, board) {
  const rest = (list ?? []).filter((b) => b.id !== board.id);
  return [board, ...rest].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : b.id - a.id));
}
