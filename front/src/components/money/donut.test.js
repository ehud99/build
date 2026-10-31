import assert from 'node:assert/strict';
import { test } from 'node:test';

import { donutSegments } from './donut.js';

test('sin datos no hay tramos', () => {
  assert.deepEqual(donutSegments([]), []);
  assert.deepEqual(donutSegments([{ share: '0' }]), []);
});

test('un solo tramo cierra el anillo sin hueco', () => {
  assert.deepEqual(donutSegments([{ share: '1.000000' }]), [{ index: 0, start: 0, length: 100 }]);
});

test('los tramos siguen el orden, con hueco, y el último llega a 100', () => {
  const segs = donutSegments([{ share: '0.5' }, { share: '0.3' }, { share: '0.2' }], 1);
  assert.deepEqual(segs.map((s) => Math.round(s.start)), [0, 50, 80]);
  assert.deepEqual(segs.map((s) => Math.round(s.length)), [49, 29, 19]);
  // Fracciones redondeadas que suman 0.999999 también cierran.
  const thirds = donutSegments([{ share: '0.333333' }, { share: '0.333333' }, { share: '0.333333' }], 0);
  assert.ok(Math.abs(thirds[2].start + thirds[2].length - 100) < 1e-9);
});

test('un tramo diminuto sigue visible', () => {
  const segs = donutSegments([{ share: '0.999' }, { share: '0.001' }], 0.8);
  assert.ok(segs[1].length > 0);
});
