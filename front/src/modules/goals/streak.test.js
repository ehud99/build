import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_PLACEHOLDER,
  RARE_CHANCE,
  RARE_PLACEHOLDER,
  SUGGESTIONS,
  goalPlaceholder,
} from './placeholders.js';
import { currentStreak, fullMonth, streakLevel, streaksByDay } from './score.js';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test('streaksByDay cuenta los días seguidos que terminan en cada marca', () => {
  assert.deepEqual(streaksByDay([1, 2, 3, 5, 6, 9]), { 1: 1, 2: 2, 3: 3, 5: 1, 6: 2, 9: 1 });
  assert.deepEqual(streaksByDay([3, 1, 2, 2]), { 1: 1, 2: 2, 3: 3 });
  assert.deepEqual(streaksByDay([]), {});
  assert.deepEqual(streaksByDay(undefined), {});
});

test('streakLevel: 1 no resalta, 7 un poco, hasta 30', () => {
  assert.equal(streakLevel(1), 0);
  assert.equal(streakLevel(6), 0);
  assert.equal(streakLevel(7), 1);
  assert.equal(streakLevel(13), 1);
  assert.equal(streakLevel(14), 2);
  assert.equal(streakLevel(21), 3);
  assert.equal(streakLevel(29), 3);
  assert.equal(streakLevel(30), 4);
  assert.equal(streakLevel(31), 4);
});

test('currentStreak sigue viva si hoy aún no se marcó', () => {
  const goal = { checked_days: [1, 2, 3, 4] };
  assert.equal(currentStreak(goal, 4), 4);
  assert.equal(currentStreak(goal, 5), 4);
  assert.equal(currentStreak(goal, 6), 0);
  assert.equal(currentStreak(goal, null), 0);
  assert.equal(currentStreak({ checked_days: [] }, 1), 0);
});

test('fullMonth: todos los días del mes marcados', () => {
  assert.equal(fullMonth({ checked_days: range(1, 30) }, 30), true);
  assert.equal(fullMonth({ checked_days: range(1, 29) }, 30), false);
  assert.equal(fullMonth({ checked_days: range(1, 28) }, 28), true);
  assert.equal(fullMonth({ checked_days: [] }, 0), false);
});

test('goalPlaceholder: tres recomendaciones, luego «Nuevo objetivo», y rara vez el especial', () => {
  const common = () => 0.5;
  assert.equal(goalPlaceholder(0, common), SUGGESTIONS[0]);
  assert.equal(goalPlaceholder(1, common), 'Hacer ejercicios');
  assert.equal(goalPlaceholder(2, common), 'Menos horas en redes sociales que ayer');
  assert.equal(goalPlaceholder(3, common), DEFAULT_PLACEHOLDER);
  assert.equal(goalPlaceholder(9, common), DEFAULT_PLACEHOLDER);
  assert.equal(goalPlaceholder(0, () => RARE_CHANCE / 2), RARE_PLACEHOLDER);
  assert.equal(goalPlaceholder(5, () => RARE_CHANCE), DEFAULT_PLACEHOLDER);
});
