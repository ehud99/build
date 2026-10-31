/**
 * Lo puro del módulo de notas (sin React ni DOM): la paleta, la fecha del editor, el orden de la
 * lista, el reparto de las cards en columnas (mampostería) y si un documento está vacío.
 */

/** La paleta fija tipo Keep (las claves que acepta la API) con su nombre visible. */
export const COLORS = [
  { key: 'default', label: 'Sin color' },
  { key: 'red', label: 'Rojo' },
  { key: 'orange', label: 'Naranja' },
  { key: 'yellow', label: 'Amarillo' },
  { key: 'green', label: 'Verde' },
  { key: 'teal', label: 'Verde azulado' },
  { key: 'blue', label: 'Azul' },
  { key: 'purple', label: 'Morado' },
  { key: 'pink', label: 'Rosa' },
  { key: 'brown', label: 'Marrón' },
  { key: 'gray', label: 'Gris' },
];

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const pad = (n) => String(n).padStart(2, '0');

/** «31 de octubre de 2026, 15:02» (hora local, 24 h), como la fecha del editor del iPhone. */
export function formatNoteDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Fijadas primero y luego por la última edición (igual que el servidor). */
export function sortNotes(notes) {
  return [...notes].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      String(b.updated_at).localeCompare(String(a.updated_at)) ||
      b.id - a.id,
  );
}

/** Pone o reemplaza una nota en la lista (sin el documento completo) y la deja ordenada. */
export function upsertNote(notes, note) {
  const { content: _content, ...summary } = note;
  const rest = notes.filter((n) => n.id !== note.id);
  return sortNotes([...rest, summary]);
}

/** Columnas de la mampostería según el ancho disponible (2 en el celular, hasta 5 en PC). */
export function columnCount(width) {
  if (width < 560) return 2;
  if (width < 820) return 3;
  if (width < 1100) return 4;
  return 5;
}

/** Alto aproximado de una card (en líneas): sirve para repartirlas en columnas parejas. */
export function estimateHeight(note) {
  const lines = note.preview?.lines ?? [];
  return 2 + (note.title ? 1 : 0) + lines.length + (note.preview?.more ? 1 : 0);
}

/**
 * Reparte las notas en `count` columnas como Keep: cada una va a la columna más corta (a igual
 * alto, la de la izquierda), así el orden se lee de izquierda a derecha y de arriba abajo.
 */
export function masonry(notes, count) {
  const cols = Array.from({ length: Math.max(1, count) }, () => ({ height: 0, items: [] }));
  for (const note of notes) {
    let target = cols[0];
    for (const col of cols) if (col.height < target.height) target = col;
    target.items.push(note);
    target.height += estimateHeight(note);
  }
  return cols.map((c) => c.items);
}

/** `true` si el documento de Tiptap no tiene texto (una nota así no se guarda). */
export function isEmptyDoc(doc) {
  const walk = (node) => {
    if (!node) return false;
    if (node.type === 'text') return Boolean(node.text?.trim());
    return (node.content ?? []).some(walk);
  };
  return !walk(doc);
}
