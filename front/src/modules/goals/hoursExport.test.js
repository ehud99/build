import assert from 'node:assert/strict';
import { test } from 'node:test';

import { csvFileName, monthCsv } from './exportMonth.js';
import { formatHours, fromHalves, halvesText, toHalves } from './hours.js';

test('horas en medias horas, sin decimales al sumar', () => {
  assert.equal(toHalves('8.5'), 17);
  assert.equal(toHalves('8,5'), 17);
  assert.equal(toHalves('8'), 16);
  assert.equal(toHalves(''), 0);
  assert.equal(toHalves(undefined), 0);
  assert.equal(toHalves('-2'), 0);
  assert.equal(fromHalves(17), '8.5');
  assert.equal(fromHalves(16), '8');
  assert.equal(fromHalves(0), '0');
  assert.equal(fromHalves(-3), '0');
  assert.equal(fromHalves(60), '24');
  assert.equal(formatHours('7.5'), '7,5');
  assert.equal(formatHours('0'), '');
  assert.equal(formatHours(undefined), '');
  // Los totales del mes pasan de 24.
  assert.equal(formatHours('128.5'), '128,5');
  assert.equal(halvesText(257), '128.5');
});

test('monthCsv arma la hoja para Excel', () => {
  const csv = monthCsv({
    month: '2026-02',
    days_in_month: 3,
    goals: [
      { id: 1, title: 'Leer; mucho', position: 0, checked_days: [1, 3] },
      { id: 2, title: 'Dormir "bien"', position: 1, checked_days: [3] },
    ],
    work_hours: { 1: '8.5', 3: '4' },
    total_hours: '12.5',
  });
  assert.ok(csv.startsWith('\uFEFF'));
  const lines = csv.slice(1).trimEnd().split('\r\n');
  assert.deepEqual(lines, [
    'Objetivos · Febrero 2026',
    'Objetivo;1;2;3;T',
    '"1. Leer; mucho";1;;1;2',
    '"2. Dormir ""bien""";;;1;1',
    'Horas trabajadas;8,5;;4;12,5',
    'Puntaje del día;1;0;2;3',
    '',
    'Puntaje final;3 / 6',
  ]);
  assert.equal(csvFileName('2026-02'), 'objetivos-2026-02.csv');
});
