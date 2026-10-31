import { forwardRef } from 'react';

import { FILL_MS, LETTER_STEP_MS } from '@/lib/capsule.js';

/**
 * «Verificar código»: «Verificar código» como la cápsula del video de referencia. Con
 * `phase`:
 * - `idle`: el botón;
 * - `loading`: una barra (el color de marca) lo llena de izquierda a derecha hasta casi el final,
 *   y el texto cambia de color donde pasa la barra;
 * - `filled`: termina de llenarse;
 * - `erased`: el texto se desvanece letra a letra, en desorden, hasta quedar la cápsula sola.
 * El que la usa encadena las fases (`FILL_MS`, `eraseMs(label)` de `capsule.js`) y, al final, deja
 * la cápsula para que el panel crezca desde ella (`lib/capsuleReveal.js`).
 */

/** Orden en que se van las letras: fijo para un texto, salteado como en el video. */
function eraseOrder(length) {
  const order = Array.from({ length }, (_, i) => i);
  let seed = length * 7 + 3;
  for (let i = order.length - 1; i > 0; i -= 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const rank = new Array(length);
  order.forEach((index, position) => {
    rank[index] = position;
  });
  return rank;
}

function Letters({ label, erased }) {
  const rank = eraseOrder(label.length);
  return [...label].map((ch, i) => (
    <span
      key={i}
      className="inline-block whitespace-pre transition-[opacity,filter,transform] duration-200 ease-out"
      style={
        erased
          ? { opacity: 0, filter: 'blur(4px)', transform: 'translateY(-2px)', transitionDelay: `${rank[i] * LETTER_STEP_MS}ms` }
          : undefined
      }
    >
      {ch}
    </span>
  ));
}

export const CapsuleButton = forwardRef(function CapsuleButton(
  { phase = 'idle', label, disabled = false, onClick, type = 'submit', ...props },
  ref,
) {
  const progress = phase === 'loading' ? 88 : phase === 'filled' || phase === 'erased' ? 100 : 0;
  const duration = phase === 'loading' ? 1600 : phase === 'idle' ? 200 : FILL_MS;
  const busy = phase !== 'idle';
  const erased = phase === 'erased';

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      data-phase={phase}
      className="relative h-14 w-full overflow-hidden rounded-full border border-border bg-surface text-base font-semibold text-text shadow-sm outline-none transition-[border-color,box-shadow] hover:border-accent/60 focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-default"
      style={{ '--capsule-fill': 'var(--accent)' }}
      {...props}
    >
      <span className="relative flex h-full items-center justify-center px-6">
        <Letters label={label} erased={erased} />
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-accent px-6 text-accent-fg"
        style={{
          clipPath: `inset(0 ${100 - progress}% 0 0)`,
          transition: `clip-path ${duration}ms ${phase === 'loading' ? 'cubic-bezier(0.2, 0.7, 0.3, 1)' : 'ease-out'}`,
        }}
      >
        <Letters label={label} erased={erased} />
      </span>
    </button>
  );
});

export default CapsuleButton;
