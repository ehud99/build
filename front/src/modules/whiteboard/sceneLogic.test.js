import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanName, filesKey, formatEdited, isSafeLink, pickAppState, sanitizeScene, upsertBoard } from './sceneLogic.js';

const png = { id: 'f1', mimeType: 'image/png', dataURL: 'data:image/png;base64,AAAA', created: 1, lastRetrieved: 2 };

test('pickAppState guarda solo fondo, cuadrícula, zoom y desplazamiento', () => {
  const state = pickAppState({
    viewBackgroundColor: '#ffffff',
    gridSize: 20,
    gridStep: 5,
    gridModeEnabled: true,
    zoom: { value: 1.25 },
    scrollX: -10,
    scrollY: 3.5,
    theme: 'dark',
    selectedElementIds: { a: true },
    openMenu: 'canvas',
  });
  assert.deepEqual(state, {
    viewBackgroundColor: '#ffffff',
    gridSize: 20,
    gridStep: 5,
    gridModeEnabled: true,
    zoom: { value: 1.25 },
    scrollX: -10,
    scrollY: 3.5,
  });
  assert.deepEqual(pickAppState({ viewBackgroundColor: 'url(x)', gridSize: null, zoom: { value: NaN }, scrollX: Infinity }), {});
});

test('isSafeLink acepta solo http(s) y mailto', () => {
  for (const ok of [null, undefined, '', 'https://a.b', 'HTTP://x', 'mailto:a@b.co']) assert.equal(isSafeLink(ok), true, ok);
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///x', 5, `https://x/${'a'.repeat(2000)}`]) {
    assert.equal(isSafeLink(bad), false, String(bad));
  }
});

test('sanitizeScene quita borrados, embeddables, enlaces raros, SVG y archivos sin usar', () => {
  const elements = [
    { id: 'a', type: 'rectangle', link: 'javascript:alert(1)' },
    { id: 'b', type: 'ellipse', isDeleted: true },
    { id: 'c', type: 'embeddable', link: 'https://youtube.com' },
    { id: 'd', type: 'iframe' },
    { id: 'e', type: 'image', fileId: 'f1' },
    { id: 'f', type: 'image', fileId: 'svg' },
    { id: 'g', type: 'image', fileId: 'pending' },
    { id: 'h', type: 'text', text: 'Hola', link: 'https://ok.com' },
  ];
  const files = {
    f1: { ...png, extra: 'x' },
    svg: { id: 'svg', mimeType: 'image/svg+xml', dataURL: 'data:image/svg+xml;base64,AAAA' },
    unused: { ...png, id: 'unused' },
  };
  const out = sanitizeScene(elements, files);
  assert.deepEqual(
    out.elements.map((e) => e.id),
    ['a', 'e', 'g', 'h'],
  );
  assert.equal(out.elements[0].link, null);
  assert.equal(elements[0].link, 'javascript:alert(1)'); // no muta la escena de Excalidraw
  assert.equal(out.elements[3].link, 'https://ok.com');
  assert.deepEqual(Object.keys(out.files), ['f1']);
  assert.deepEqual(out.files.f1, png);
  assert.equal(out.dropped, 3);
});

test('filesKey no depende del orden', () => {
  assert.equal(filesKey({ b: 1, a: 2 }), filesKey({ a: 2, b: 1 }));
  assert.equal(filesKey({}), '');
});

test('cleanName recorta y deja null si queda vacío', () => {
  assert.equal(cleanName('  Mi   plano '), 'Mi plano');
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName('x'.repeat(100)).length, 80);
});

test('formatEdited', () => {
  const now = new Date(2026, 9, 31, 15, 0);
  assert.equal(formatEdited(new Date(2026, 9, 31, 14, 59, 30).toISOString(), now), 'Hace un momento');
  assert.equal(formatEdited(new Date(2026, 9, 31, 14, 50).toISOString(), now), 'Hace 10 min');
  assert.equal(formatEdited(new Date(2026, 9, 31, 9, 5).toISOString(), now), 'Hoy, 09:05');
  assert.equal(formatEdited(new Date(2026, 9, 30, 23, 15).toISOString(), now), 'Ayer, 23:15');
  assert.equal(formatEdited(new Date(2026, 9, 3, 10, 0).toISOString(), now), '3 oct');
  assert.equal(formatEdited(new Date(2025, 0, 3, 10, 0).toISOString(), now), '3 ene 2025');
  assert.equal(formatEdited('nada', now), '');
});

test('upsertBoard la deja primera por fecha', () => {
  const list = [
    { id: 1, updated_at: '2026-10-31T10:00:00Z' },
    { id: 2, updated_at: '2026-10-30T10:00:00Z' },
  ];
  const next = upsertBoard(list, { id: 2, updated_at: '2026-10-31T11:00:00Z' });
  assert.deepEqual(
    next.map((b) => b.id),
    [2, 1],
  );
  assert.equal(next.length, 2);
});
