import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayScore, finalScore, maxScore, monthLabel, rowTotal, shiftMonth, todayDay } from './score.js';

const goals = [
  { id: 1, title: 'A', position: 0, checked_days: [1, 2, 5] },
  { id: 2, title: 'B', position: 1, checked_days: [2] },
  { id: 3, title: 'C', position: 2, checked_days: [] },
];

test('rowTotal cuenta las marcas del objetivo', () => {
  assert.equal(rowTotal(goals[0]), 3);
  assert.equal(rowTotal(goals[2]), 0);
  assert.equal(rowTotal({}), 0);
});

test('dayScore cuenta los objetivos marcados ese día', () => {
  assert.equal(dayScore(goals, 2), 2);
  assert.equal(dayScore(goals, 5), 1);
  assert.equal(dayScore(goals, 9), 0);
  assert.equal(dayScore([], 1), 0);
});

test('finalScore suma todas las marcas y maxScore es objetivos × días', () => {
  assert.equal(finalScore(goals), 4);
  assert.equal(finalScore([]), 0);
  assert.equal(maxScore(goals, 30), 90);
  assert.equal(maxScore([], 30), 0);
});

test('monthLabel da el nombre en español con el año', () => {
  assert.equal(monthLabel('2026-11'), 'Noviembre 2026');
  assert.equal(monthLabel('2026-01'), 'Enero 2026');
  assert.equal(monthLabel('2027-12'), 'Diciembre 2027');
});

test('shiftMonth cruza el año hacia los dos lados', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-11', 1), '2026-12');
  assert.equal(shiftMonth('2026-11', -3), '2026-08');
  assert.equal(shiftMonth('2026-11', 0), '2026-11');
});

test('todayDay da el día solo si hoy cae en el mes', () => {
  assert.equal(todayDay('2026-11', '2026-11-03'), 3);
  assert.equal(todayDay('2026-11', '2026-11-30'), 30);
  assert.equal(todayDay('2026-10', '2026-11-03'), null);
  assert.equal(todayDay('2026-11', undefined), null);
});
