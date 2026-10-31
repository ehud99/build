import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  dayLabel,
  isDay,
  periodLabel,
  periodRange,
  rangeLabel,
  shiftPeriod,
  shortDate,
  switchMode,
  weekStart,
} from './dates.js';

const TODAY = '2026-10-31'; // sábado

test('parseDay rechaza días que no existen', () => {
  assert.equal(isDay('2026-02-29'), false);
  assert.equal(isDay('2028-02-29'), true);
  assert.equal(isDay('2026-13-01'), false);
  assert.equal(isDay('31/10/2026'), false);
});

test('addDays cruza meses y años', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('la semana empieza el lunes', () => {
  assert.equal(weekStart('2026-10-31'), '2026-10-26'); // sábado
  assert.equal(weekStart('2026-11-01'), '2026-10-26'); // domingo
  assert.equal(weekStart('2026-10-26'), '2026-10-26'); // lunes
  assert.deepEqual(periodRange({ mode: 'week', anchor: TODAY }), { from: '2026-10-26', to: '2026-11-01' });
});

test('periodRange de día, mes, año y rango', () => {
  assert.deepEqual(periodRange({ mode: 'day', anchor: TODAY }), { from: TODAY, to: TODAY });
  assert.deepEqual(periodRange({ mode: 'month', anchor: '2028-02-10' }), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(periodRange({ mode: 'year', anchor: TODAY }), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(
    periodRange({ mode: 'range', anchor: TODAY, from: '2026-10-20', to: '2026-10-05' }),
    { from: '2026-10-05', to: '2026-10-20' },
  );
});

test('shiftPeriod mueve un paso del modo', () => {
  assert.equal(shiftPeriod({ mode: 'day', anchor: TODAY }, 1).anchor, '2026-11-01');
  assert.equal(shiftPeriod({ mode: 'week', anchor: TODAY }, -1).anchor, '2026-10-24');
  // 31 de octubre − 1 mes = 30 de septiembre (no se pasa a octubre).
  assert.equal(shiftPeriod({ mode: 'month', anchor: TODAY }, -1).anchor, '2026-09-30');
  assert.equal(shiftPeriod({ mode: 'month', anchor: '2026-12-15' }, 1).anchor, '2027-01-15');
  assert.equal(shiftPeriod({ mode: 'year', anchor: '2028-02-29' }, 1).anchor, '2029-02-28');
  const range = shiftPeriod({ mode: 'range', anchor: '2026-10-01', from: '2026-10-01', to: '2026-10-10' }, 1);
  assert.deepEqual([range.from, range.to], ['2026-10-11', '2026-10-20']);
});

test('switchMode conserva el día y arma el rango desde el periodo de antes', () => {
  const range = switchMode({ mode: 'week', anchor: TODAY }, 'range');
  assert.deepEqual([range.from, range.to], ['2026-10-26', '2026-11-01']);
  assert.deepEqual(switchMode(range, 'month'), { mode: 'month', anchor: '2026-10-26' });
  assert.deepEqual(switchMode({ mode: 'day', anchor: TODAY }, 'year'), { mode: 'year', anchor: TODAY });
});

test('etiquetas del periodo como en la app', () => {
  assert.equal(periodLabel({ mode: 'day', anchor: TODAY }, TODAY), 'Hoy, 31 de octubre');
  assert.equal(periodLabel({ mode: 'day', anchor: '2026-10-30' }, TODAY), 'Ayer, 30 de octubre');
  assert.equal(periodLabel({ mode: 'day', anchor: '2026-11-01' }, TODAY), 'Mañana, 1 de noviembre');
  assert.equal(periodLabel({ mode: 'day', anchor: '2026-10-28' }, TODAY), 'Miércoles, 28 de octubre');
  assert.equal(dayLabel('2025-07-25', TODAY), 'Viernes, 25 de julio de 2025');
  assert.equal(periodLabel({ mode: 'week', anchor: TODAY }, TODAY), '26 oct – 1 nov');
  assert.equal(periodLabel({ mode: 'month', anchor: TODAY }, TODAY), 'Octubre 2026');
  assert.equal(periodLabel({ mode: 'year', anchor: TODAY }, TODAY), '2026');
  assert.equal(rangeLabel('2025-12-29', '2026-01-04', TODAY), '29 dic 2025 – 4 ene 2026');
  assert.equal(rangeLabel('2025-03-01', '2025-03-09', TODAY), '1 mar – 9 mar 2025');
  assert.equal(rangeLabel(TODAY, TODAY, TODAY), 'Hoy, 31 de octubre');
});

test('shortDate de los movimientos', () => {
  assert.equal(shortDate('2026-10-05', TODAY), '5 oct');
  assert.equal(shortDate('2025-10-05', TODAY), '5 oct 2025');
});
