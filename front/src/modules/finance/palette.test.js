import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COLOR_KEYS, COLOR_NAMES, ICON_KEYS, colorVar } from './palette.js';

test('listas blancas sin repetidos', () => {
  assert.equal(new Set(ICON_KEYS).size, ICON_KEYS.length);
  assert.ok(ICON_KEYS.length >= 40);
  assert.equal(new Set(COLOR_KEYS).size, COLOR_KEYS.length);
  assert.deepEqual(Object.keys(COLOR_NAMES).sort(), [...COLOR_KEYS].sort());
});

test('colorVar usa el token y cae en el gris', () => {
  assert.equal(colorVar('red'), 'var(--fin-red)');
  assert.equal(colorVar('#fff'), 'var(--fin-gray)');
});
