/**
 * El punto de pantalla donde va el cursor de un `<input>`, para que el bot (`LoginBot`) mire lo
 * que se escribe. Sin `input` devuelve `'pointer'` (que mire al puntero).
 */
export function caretPoint(input) {
  if (!input) return 'pointer';
  const rect = input.getBoundingClientRect();
  const style = window.getComputedStyle(input);
  const canvas = caretPoint.canvas ?? (caretPoint.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = Math.min(ctx.measureText(input.value).width, rect.width);
  const centered = style.textAlign === 'center';
  const x = centered ? rect.left + rect.width / 2 + width / 2 : rect.left + parseFloat(style.paddingLeft) + width;
  return { x, y: rect.top + rect.height / 2 };
}
