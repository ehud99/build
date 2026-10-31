import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amountToInput, currencySymbol, formatMoney, isNegative, normalizeAmount, sanitizeAmountTyping } from './money.js';

test('sanitizeAmountTyping deja cifras, un separador y 2 decimales', () => {
  assert.equal(sanitizeAmountTyping('12,345'), '12,34');
  assert.equal(sanitizeAmountTyping('12.5.6'), '12.56');
  assert.equal(sanitizeAmountTyping(',5'), '0,5');
  assert.equal(sanitizeAmountTyping('007'), '7');
  assert.equal(sanitizeAmountTyping('00,5'), '0,5');
  assert.equal(sanitizeAmountTyping('-1e3 $'), '13');
  assert.equal(sanitizeAmountTyping('1234567890'), '123456789');
  assert.equal(sanitizeAmountTyping(''), '');
});

test('normalizeAmount da el texto del servidor o null', () => {
  assert.equal(normalizeAmount('12,5'), '12.5');
  assert.equal(normalizeAmount('12.50'), '12.50');
  assert.equal(normalizeAmount('12,'), '12');
  assert.equal(normalizeAmount('0'), null);
  assert.equal(normalizeAmount('0,00'), null);
  assert.equal(normalizeAmount(''), null);
  assert.equal(normalizeAmount('1,234'), null);
  assert.equal(normalizeAmount('1000000000'), null);
  assert.equal(normalizeAmount('0,01'), '0.01');
  assert.equal(amountToInput('12.50'), '12,50');
});

test('formatMoney formatea el texto sin perder centavos', () => {
  // Más cifras de las que un float guarda exactas.
  assert.match(formatMoney('12345678901234567.15', 'USD'), /12\.345\.678\.901\.234\.567,15/);
  assert.match(formatMoney('24855.50', 'PEN'), /24\.855,50/);
  assert.match(formatMoney('-12.00', 'EUR'), /-12,00/);
  assert.equal(currencySymbol('PEN'), 'S/');
  assert.equal(currencySymbol('USD'), '$');
  assert.equal(currencySymbol('EUR'), '€');
  assert.equal(isNegative('-1.00'), true);
  assert.equal(isNegative('1.00'), false);
});
