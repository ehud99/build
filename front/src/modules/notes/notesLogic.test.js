import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COLORS, columnCount, formatNoteDate, isEmptyDoc, masonry, sortNotes, upsertNote } from './notesLogic.js';

test('la paleta tiene las 11 claves de la API, con «default» primero', () => {
  assert.deepEqual(
    COLORS.map((c) => c.key),
    ['default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown', 'gray'],
  );
});

test('formatNoteDate escribe la fecha como el iPhone', () => {
  assert.equal(formatNoteDate(new Date(2026, 9, 31, 15, 2)), '31 de octubre de 2026, 15:02');
  assert.equal(formatNoteDate(new Date(2027, 0, 5, 9, 7)), '5 de enero de 2027, 09:07');
  assert.equal(formatNoteDate('no es fecha'), '');
});

test('sortNotes y upsertNote: fijadas primero y luego la última edición', () => {
  const notes = [
    { id: 1, pinned: false, updated_at: '2026-10-01T10:00:00Z' },
    { id: 2, pinned: true, updated_at: '2026-09-01T10:00:00Z' },
    { id: 3, pinned: false, updated_at: '2026-10-02T10:00:00Z' },
  ];
  assert.deepEqual(sortNotes(notes).map((n) => n.id), [2, 3, 1]);
  const next = upsertNote(notes, { id: 1, pinned: false, updated_at: '2026-10-03T10:00:00Z', content: {} });
  assert.deepEqual(next.map((n) => n.id), [2, 1, 3]);
  assert.equal('content' in next[1], false);
});

test('columnCount y masonry reparten en la columna más corta', () => {
  assert.equal(columnCount(358), 2);
  assert.equal(columnCount(1180), 5);
  const tall = { id: 1, title: 'A', preview: { lines: Array(8).fill({}), more: 0 } };
  const short = (id) => ({ id, title: 'x', preview: { lines: [], more: 0 } });
  const cols = masonry([tall, short(2), short(3), short(4)], 2);
  assert.deepEqual(cols.map((c) => c.map((n) => n.id)), [[1], [2, 3, 4]]);
  assert.deepEqual(masonry([], 3), [[], [], []]);
});

test('isEmptyDoc mira si hay texto', () => {
  assert.equal(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] }), true);
  assert.equal(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ' }] }] }), true);
  assert.equal(
    isEmptyDoc({
      type: 'doc',
      content: [{ type: 'taskList', content: [{ type: 'taskItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] }] }],
    }),
    false,
  );
  assert.equal(isEmptyDoc(null), true);
});
