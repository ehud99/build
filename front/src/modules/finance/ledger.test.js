import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayHeading, isDay, monthLabel, monthName, monthOf, netTone, parseMonth, shiftMonth, signedMoney } from './ledger.js';

const TODAY = '2026-10-31'; // sábado

test('isDay rechaza días que no existen', () => {
  assert.equal(isDay('2026-02-29'), false);
  assert.equal(isDay('2028-02-29'), true);
  assert.equal(isDay('2026-10-31'), true);
  assert.equal(isDay('2026-10-1'), false);
  assert.equal(isDay(''), false);
});

test('parseMonth acepta AAAA-MM del 2000 al 2100', () => {
  assert.equal(parseMonth('2026-10'), '2026-10');
  assert.equal(parseMonth('2100-12'), '2100-12');
  for (const bad of ['2026-13', '2026-00', '2026-1', '1999-12', '2101-01', 'abc', '', null, undefined]) {
    assert.equal(parseMonth(bad), null, String(bad));
  }
});

test('shiftMonth cruza los años', () => {
  assert.equal(shiftMonth('2026-10', 1), '2026-11');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-10', -22), '2024-12');
  assert.equal(monthOf('2026-10-31'), '2026-10');
});

test('monthLabel y monthName', () => {
  assert.equal(monthLabel('2026-10'), 'Octubre 2026');
  assert.equal(monthLabel('2027-01'), 'Enero 2027');
  assert.equal(monthName('2026-09'), 'septiembre');
});

test('dayHeading: Hoy, Ayer, Mañana y el día de la semana', () => {
  assert.equal(dayHeading('2026-10-31', TODAY), 'Hoy');
  assert.equal(dayHeading('2026-10-30', TODAY), 'Ayer');
  assert.equal(dayHeading('2026-11-01', TODAY), 'Mañana');
  assert.equal(dayHeading('2026-10-29', TODAY), 'Jueves, 29 de octubre');
  assert.equal(dayHeading('2026-10-26', TODAY), 'Lunes, 26 de octubre');
  assert.equal(dayHeading('2025-12-31', '2026-01-02'), 'Miércoles, 31 de diciembre de 2025');
  assert.equal(dayHeading('2025-12-31', '2026-01-01'), 'Ayer');
});

test('signedMoney pone el signo sin sumar', () => {
  assert.equal(signedMoney('12.50', 'PEN', '+'), '+12,50 S/');
  assert.equal(signedMoney('12.50', 'PEN', '-'), '−12,50 S/');
  assert.equal(signedMoney('-1905.10', 'PEN'), '−1.905,10 S/');
  assert.equal(signedMoney('999.45', 'EUR'), '+999,45 €');
  assert.equal(signedMoney('0.00', 'PEN'), '0,00 S/');
  assert.equal(signedMoney('0.00', 'PEN', '-'), '0,00 S/');
});

test('netTone', () => {
  assert.equal(netTone('10.00'), 'positive');
  assert.equal(netTone('-0.30'), 'negative');
  assert.equal(netTone('0.00'), 'zero');
});
