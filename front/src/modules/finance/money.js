/**
 * Montos de Finanzas: viajan como texto (`'24855.50'`) y nunca se convierten a número para
 * sumar; los totales los da el servidor. Aquí solo se valida lo que se escribe y se formatea para
 * mostrar (`Intl.NumberFormat` acepta el texto tal cual, sin pasar por `float`).
 */

/** Igual que el servidor: hasta 9 cifras enteras y 2 decimales, con punto. */
export const AMOUNT_RE = /^(0|[1-9]\d{0,8})(\.\d{1,2})?$/;

/**
 * Lo que se va escribiendo en el campo del monto: deja cifras y un solo separador (coma o punto,
 * que se muestra como se escribió), hasta 9 enteras y 2 decimales.
 */
export function sanitizeAmountTyping(raw) {
  const text = String(raw ?? '').replace(/\s/g, '');
  let out = '';
  let sep = false;
  let intDigits = 0;
  let decimals = 0;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      if (sep) {
        if (decimals >= 2) continue;
        decimals += 1;
      } else {
        if (intDigits >= 9) continue;
        intDigits += 1;
      }
      out += ch;
    } else if ((ch === ',' || ch === '.') && !sep) {
      sep = true;
      out += intDigits === 0 ? `0${ch}` : ch;
      if (intDigits === 0) intDigits = 1;
    }
  }
  // Sin ceros a la izquierda («007» → «7»).
  return out.replace(/^0+(?=\d)/, '');
}

/** El texto del campo listo para el servidor (`'12,5'` → `'12.5'`), o `null` si no vale o es 0. */
export function normalizeAmount(raw) {
  const text = String(raw ?? '').trim().replace(',', '.').replace(/\.$/, '');
  if (!AMOUNT_RE.test(text)) return null;
  if (/^0(\.0{0,2})?$/.test(text)) return null;
  return text;
}

/** El monto del servidor para el campo, con coma decimal (`'12.50'` → `'12,50'`). */
export function amountToInput(text) {
  return String(text ?? '').replace('.', ',');
}

/** Símbolo de cada moneda (el de `Intl` en «es» sale como «PEN» o «US$»). */
export const CURRENCY_SYMBOLS = { PEN: 'S/', USD: '$', EUR: '€', MXN: '$', COP: '$', ARS: '$', CLP: '$' };

export const CURRENCY_NAMES = {
  PEN: 'Sol peruano',
  USD: 'Dólar estadounidense',
  EUR: 'Euro',
  MXN: 'Peso mexicano',
  COP: 'Peso colombiano',
  ARS: 'Peso argentino',
  CLP: 'Peso chileno',
};

const formatters = new Map();

function formatter(currency, compact) {
  const key = `${currency}|${compact}`;
  if (!formatters.has(key)) {
    // Los decimales de la moneda (2, o 0 en CLP) los da `Intl` con `style: 'currency'`.
    const digits = new Intl.NumberFormat('es', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits;
    formatters.set(
      key,
      new Intl.NumberFormat(
        'es',
        compact
          ? { notation: 'compact', maximumFractionDigits: 1 }
          : { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' },
      ),
    );
  }
  return formatters.get(key);
}

/**
 * `'24855.50'` → `'24.855,50 S/'` (el texto va directo a `Intl`, sin pasar por `float`).
 * `compact` para la dona con montos grandes (`'1,2 M S/'`).
 */
export function formatMoney(text, currency = 'PEN', { compact = false } = {}) {
  return `${formatter(currency, compact).format(String(text ?? '0'))}\u00a0${currencySymbol(currency)}`;
}

/** El símbolo de la moneda (`'S/'`, `'$'`, `'€'`). */
export function currencySymbol(currency = 'PEN') {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** `true` si el texto es negativo (el balance), sin convertirlo a número. */
export const isNegative = (text) => String(text ?? '').startsWith('-');
