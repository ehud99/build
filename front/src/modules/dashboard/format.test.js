import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dayTicks,
  daysLabel,
  decimalLabel,
  deltaParts,
  hoursLabel,
  hoursValue,
  monthBounds,
  monthLabel,
  monthName,
  percentLabel,
  shiftMonth,
  streakLevel,
  weekLabel,
} from './format.js';

test('meses', () => {
  assert.equal(monthLabel('2026-10'), 'Octubre 2026');
  assert.equal(monthName('2026-01'), 'enero');
  assert.equal(monthName(null), 'el mes');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.deepEqual(monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthBounds('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(monthBounds('2026-10'), { from: '2026-10-01', to: '2026-10-31' });
});

test('porcentajes y diferencias', () => {
  assert.equal(percentLabel('63.3'), '63,3\u00a0%');
  assert.equal(percentLabel(null), '—');
  assert.equal(decimalLabel('100.0'), '100,0');
  assert.deepEqual(deltaParts('5.2'), { dir: 'up', text: '+5,2' });
  assert.deepEqual(deltaParts('-1.2'), { dir: 'down', text: '−1,2' });
  assert.deepEqual(deltaParts('0.0'), { dir: 'flat', text: '0,0' });
  assert.deepEqual(deltaParts('-0.0'), { dir: 'flat', text: '0,0' });
  assert.equal(deltaParts(null), null);
});

test('horas', () => {
  assert.equal(hoursLabel('15.5'), '15,5');
  assert.equal(hoursLabel(null), '—');
  assert.equal(hoursValue('8.5'), 8.5);
  assert.equal(hoursValue('x'), 0);
  assert.equal(weekLabel({ start_day: 2, end_day: 8 }, '2026-11'), '2–8 nov');
  assert.equal(weekLabel({ start_day: 1, end_day: 1 }, '2026-11'), '1 nov');
  assert.equal(daysLabel(1), '1 día');
  assert.equal(daysLabel(0), '0 días');
});

test('rachas y ejes', () => {
  assert.deepEqual([1, 6, 7, 13, 14, 21, 30, 31].map(streakLevel), [0, 0, 1, 1, 2, 3, 4, 4]);
  assert.deepEqual(dayTicks(30), [1, 5, 10, 15, 20, 25, 30]);
  assert.deepEqual(dayTicks(31), [1, 5, 10, 15, 20, 25, 31]);
  assert.deepEqual(dayTicks(28), [1, 5, 10, 15, 20, 25, 28]);
});
