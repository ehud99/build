import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HEAT_LEGEND, heatDateLabel, heatLevel, heatValue, moveCell, weekdayMon, yearGrid } from './heatmap.js';
import { bandLayout, barPath, columnPath, niceMax, stepIndex, ticks } from './scale.js';

test('niceMax y ticks', () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(7), 8);
  assert.equal(niceMax(10), 10);
  assert.equal(niceMax(13), 15);
  assert.equal(niceMax(9.5), 10);
  assert.equal(niceMax(2, 4), 4);
  assert.deepEqual(ticks(8), [0, 2, 4, 6, 8]);
  assert.deepEqual(ticks(100), [0, 25, 50, 75, 100]);
  assert.deepEqual(ticks(3), [0, 1, 2, 3]);
  assert.deepEqual(ticks(1), [0, 0.5, 1]);
  assert.deepEqual(ticks(15), [0, 5, 10, 15]);
  assert.deepEqual(ticks(10), [0, 2.5, 5, 7.5, 10]);
  assert.deepEqual(ticks(10, 4, { integer: true }), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(ticks(7, 4, { integer: true }), [0, 2, 4, 6]);
  assert.deepEqual(ticks(5, 4, { integer: true }), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(ticks(1, 4, { integer: true }), [0, 1]);
  assert.deepEqual(ticks(40, 4, { integer: true }), [0, 10, 20, 30, 40]);
});

test('bandas y caminos', () => {
  const band = bandLayout(10, 400);
  assert.equal(band.slot, 40);
  assert.equal(band.bar, 24);
  assert.equal(band.x(0), 8);
  const tight = bandLayout(31, 310);
  assert.ok(tight.bar <= tight.slot - 2);
  assert.equal(columnPath(0, 100, 10, 0), '');
  assert.match(columnPath(0, 100, 10, 50), /^M0,100V54Q0,50 4,50H6Q10,50 10,54V100Z$/);
  // Poca altura: el radio no pasa de la altura.
  assert.match(columnPath(0, 100, 10, 2), /V100Z$/);
  assert.equal(barPath(0, 0, 0, 8), '');
  assert.match(barPath(0, 0, 50, 8), /^M0,0H46/);
});

test('teclado', () => {
  assert.equal(stepIndex(-1, 'ArrowRight', 5), 0);
  assert.equal(stepIndex(-1, 'ArrowLeft', 5), 4);
  assert.equal(stepIndex(4, 'ArrowRight', 5), 4);
  assert.equal(stepIndex(2, 'Home', 5), 0);
  assert.equal(stepIndex(2, 'End', 5), 4);
  assert.equal(stepIndex(2, 'a', 5), 2);
  assert.equal(moveCell(-1, 'ArrowDown', 365), 0);
  assert.equal(moveCell(10, 'ArrowRight', 365), 17);
  assert.equal(moveCell(2, 'ArrowLeft', 365), 2);
  assert.equal(moveCell(10, 'ArrowUp', 365), 9);
});

test('niveles del mapa de calor', () => {
  assert.equal(heatLevel(0, 4), 0);
  assert.equal(heatLevel(1, 4), 1);
  assert.equal(heatLevel(2, 4), 2);
  assert.equal(heatLevel(3, 4), 3);
  assert.equal(heatLevel(4, 4), 4);
  assert.equal(heatLevel(1, 3), 2); // 33 %
  assert.equal(heatLevel(2, 3), 3); // 67 %
  assert.equal(heatLevel(1, 0), 0);
  assert.equal(HEAT_LEGEND.length, 5);
  assert.equal(heatValue({ data: { done: 2, goals: 3 } }), '2 de 3 · 67\u00a0%');
  assert.equal(heatValue({ data: null }), 'Sin objetivos');
});

test('cuadrícula del año', () => {
  // 2026 empieza en jueves: la primera columna tiene lunes a miércoles vacíos.
  assert.equal(weekdayMon('2026-01-01'), 3);
  assert.equal(weekdayMon('2026-11-15'), 6);
  const grid = yearGrid(2026, [{ date: '2026-11-15', done: 2, goals: 2 }]);
  assert.equal(grid.cells.length, 365);
  assert.deepEqual(grid.cells[0], { date: '2026-01-01', col: 0, row: 3, data: null });
  assert.equal(grid.cells[364].date, '2026-12-31');
  assert.equal(grid.weeks, grid.cells[364].col + 1);
  assert.equal(grid.weeks, 53);
  assert.equal(grid.months.length, 12);
  assert.deepEqual(grid.months[0], { label: 'ene', col: 0 });
  const nov15 = grid.cells.find((c) => c.date === '2026-11-15');
  assert.deepEqual(nov15.data, { date: '2026-11-15', done: 2, goals: 2 });
  assert.equal(yearGrid(2028).cells.length, 366);
  assert.equal(heatDateLabel('2026-11-15'), 'dom 15 nov 2026');
});
