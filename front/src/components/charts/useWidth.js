import { useLayoutEffect, useRef, useState } from 'react';

/** Ancho del contenedor (para dibujar el SVG a tamaño real y no estirar el texto). */
export function useWidth(initial = 600) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(Math.max(120, Math.floor(el.clientWidth)));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
