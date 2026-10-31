/**
 * Claves de los íconos y los colores de las categorías: las mismas listas blancas que el servidor
 * (`back/app/modules/finance/service.py`). El ícono de cada clave está en `icons.js` y cada color
 * es un token `--fin-<clave>` de `finance.css` (claro y oscuro).
 */
export const ICON_KEYS = [
  'cart', 'bag', 'home', 'rent', 'car', 'taxi', 'bus', 'train', 'bike', 'fuel',
  'plane', 'travel', 'food', 'pizza', 'coffee', 'health', 'pill', 'gift', 'party', 'game',
  'movie', 'music', 'education', 'book', 'pet', 'clothes', 'beauty', 'baby', 'gym', 'sport',
  'wifi', 'phone', 'laptop', 'tv', 'electricity', 'water', 'gas', 'tools', 'insurance', 'tax',
  'card', 'bank', 'salary', 'cash', 'coins', 'savings', 'investment', 'other',
];

export const COLOR_KEYS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan',
  'blue', 'indigo', 'violet', 'pink', 'brown', 'gray',
];

export const COLOR_NAMES = {
  red: 'Rojo', orange: 'Naranja', amber: 'Ámbar', yellow: 'Amarillo', lime: 'Lima', green: 'Verde',
  teal: 'Verde azulado', cyan: 'Cian', blue: 'Azul', indigo: 'Índigo', violet: 'Violeta',
  pink: 'Rosa', brown: 'Marrón', gray: 'Gris',
};

/** `var(--fin-red)`; una clave desconocida cae en el gris. */
export const colorVar = (key) => `var(--fin-${COLOR_KEYS.includes(key) ? key : 'gray'})`;

export const KIND_LABELS = { expense: 'Gastos', income: 'Ingresos' };
