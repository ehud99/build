import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CLIP_BANDS,
  GLITCH_FRAMES,
  POINTS_PER_BAND,
  bandsPolygon,
  glitchFilterMarkup,
  glitchFrames,
  maxShift,
  mulberry32,
  splitRange,
} from './glitchFrames.js';

/** Puntos `[x, y]` de un `polygon(…)`. */
function points(clip) {
  const m = /^polygon\((.*)\)$/.exec(clip);
  assert.ok(m, `no es un polygon: ${clip.slice(0, 40)}`);
  return m[1].split(', ').map((p) => p.split(' ').map((n) => Number.parseFloat(n)));
}

/** ¿El punto está dentro del polígono con la regla nonzero? */
function inside([px, py], pts) {
  let winding = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const cross = (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);
    if (y1 <= py && y2 > py && cross > 0) winding += 1;
    else if (y1 > py && y2 <= py && cross < 0) winding -= 1;
  }
  return winding !== 0;
}

test('mulberry32 es determinístico y queda en [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const sa = Array.from({ length: 200 }, a);
  assert.deepEqual(sa, Array.from({ length: 200 }, b));
  assert.notDeepEqual(sa.slice(0, 5), Array.from({ length: 5 }, c));
  assert.ok(sa.every((x) => x >= 0 && x < 1));
});

test('splitRange cubre el rango sin huecos', () => {
  const rand = mulberry32(7);
  for (let k = 0; k < 20; k += 1) {
    const parts = splitRange(900, 12, rand);
    assert.equal(parts.length, 12);
    assert.equal(parts[0].y, 0);
    for (let i = 1; i < parts.length; i += 1) assert.equal(parts[i].y, parts[i - 1].y + parts[i - 1].h);
    assert.equal(parts.at(-1).y + parts.at(-1).h, 900);
    assert.ok(parts.every((p) => p.h >= 0));
  }
});

test('bandsPolygon muestra solo las franjas, con sus cortes', () => {
  const pts = points(
    bandsPolygon([
      { l: 100, r: 500, a: 0, b: 50 },
      { l: 0, r: 0, a: 50, b: 50 },
      { l: 0, r: 800, a: 200, b: 300 },
    ]),
  );
  assert.equal(pts.length, 3 * POINTS_PER_BAND);
  assert.ok(inside([300, 25], pts));
  assert.ok(!inside([50, 25], pts), 'a la izquierda del corte');
  assert.ok(!inside([600, 25], pts), 'a la derecha del corte');
  assert.ok(!inside([300, 100], pts), 'entre franjas');
  assert.ok(inside([10, 250], pts));
  assert.ok(inside([790, 250], pts));
  assert.ok(!inside([300, 350], pts), 'debajo de la última');
});

test('glitchFrames: todos los polígonos tienen los mismos puntos', () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const frames = glitchFrames(1280, 800, mulberry32(seed));
    assert.equal(frames.length, GLITCH_FRAMES);
    for (const f of frames) assert.equal(points(f.clip).length, CLIP_BANDS * POINTS_PER_BAND);
  }
});

test('glitchFrames: el primero no muestra el tema nuevo y el último lo muestra todo, limpio', () => {
  const W = 1280;
  const H = 800;
  const frames = glitchFrames(W, H, mulberry32(5));
  const first = points(frames[0].clip);
  const last = frames.at(-1);
  const lastPts = points(last.clip);
  for (let x = 1; x < W; x += 97) {
    for (let y = 1; y < H; y += 61) {
      assert.ok(!inside([x, y], first), `primero muestra ${x},${y}`);
      assert.ok(inside([x, y], lastPts), `último no cubre ${x},${y}`);
    }
  }
  assert.equal(last.newX, 0);
  assert.equal(last.oldX, 0);
  assert.equal(last.newFx, null);
  assert.equal(last.oldFx, null);
  assert.equal(last.noise.opacity, 0);
});

test('glitchFrames: hay split, franjas desplazadas, saltos y ruido a mitad del efecto', () => {
  for (const seed of [11, 22, 33, 44]) {
    const frames = glitchFrames(1440, 900, mulberry32(seed));
    const mid = frames.slice(1, -1);
    const fx = mid.flatMap((f) => [f.newFx, f.oldFx]).filter(Boolean);
    assert.ok(fx.some((x) => x.split !== 0), 'sin RGB split');
    assert.ok(fx.some((x) => x.bands.length > 0), 'sin franjas desplazadas');
    assert.ok(mid.some((f) => f.newX !== 0 || f.oldX !== 0), 'sin saltos');
    assert.ok(mid.filter((f) => f.noise.opacity > 0).length >= 2, 'sin destellos de ruido');
    const limit = maxShift(1440);
    for (const x of fx) for (const b of x.bands) assert.ok(Math.abs(b.dx) <= limit);
  }
});

test('glitchFrames es determinístico con la misma semilla', () => {
  assert.deepEqual(glitchFrames(1024, 768, mulberry32(77)), glitchFrames(1024, 768, mulberry32(77)));
  assert.notDeepEqual(glitchFrames(1024, 768, mulberry32(77)), glitchFrames(1024, 768, mulberry32(78)));
});

test('glitchFilterMarkup arma el mapa y la separación de canales', () => {
  const W = 1000;
  const scale = maxShift(W) * 2;
  const svg = glitchFilterMarkup('g1', { split: 6, bands: [{ y: 100, h: 40, dx: maxShift(W) }] }, W, 600);
  assert.match(svg, /^<filter id="g1"/);
  assert.match(svg, /color-interpolation-filters="sRGB"/);
  assert.match(svg, new RegExp(`feDisplacementMap[^>]*scale="${scale}"`));
  // dx = máximo → rojo 128 + 127,5 ≈ 255 en la franja.
  assert.match(svg, /flood-color="rgb\(255,128,128\)" x="0" y="100" width="1000" height="40"/);
  assert.match(svg, /<feOffset in="r" dx="6"/);
  assert.match(svg, /<feOffset in="b" dx="-6"/);

  const onlySplit = glitchFilterMarkup('g2', { split: -4, bands: [] }, W, 600);
  assert.doesNotMatch(onlySplit, /feDisplacementMap/);
  assert.match(onlySplit, /<feColorMatrix in="SourceGraphic"/);
});
