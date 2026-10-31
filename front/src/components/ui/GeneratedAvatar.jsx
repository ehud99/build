import { useMemo } from 'react';

import { Blobatar } from '@blobatar/react';
import {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
} from 'blobatar/expression';
import 'blobatar/motion.css';

/**
 * Las 14 poses de blobatar; la semilla reparte una por cuenta. `thinking` se
 * mueve siempre (con `motion.css`). Agregar o quitar una pose cambia la
 * expresión de parte de las cuentas.
 */
const EXPRESSIONS = [
  idle, happy, sad, mad, surprised, wink, sleepy, smug, unsure, scared, love, shy, sick, thinking,
];

/**
 * FNV-1a sobre la semilla. Blobatar decide forma, tono y ojos con su propio
 * hash; este solo elige la pose, que blobatar no deriva del nombre.
 */
function hashSeed(seed) {
  let h = 2166136261;
  const s = String(seed ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * GeneratedAvatar — blobatar determinístico desde una semilla
 * (https://github.com/Alain00/blobatar, gen2): 10 siluetas, 8 tonos y la
 * pose de `EXPRESSIONS`, sobre un círculo. Sin red ni imágenes: SVG inline,
 * siempre animado (respira, parpadea y mira; `motion.css`), también en el
 * celular; quieto con `prefers-reduced-motion`.
 *
 * Props:
 * - `seed`: string que determina el avatar. Mismo seed → mismo avatar.
 *   Convención: `account.avatar_seed || account.username` (ver `Avatar.jsx`),
 *   estable hasta que la cuenta lo regenere desde su perfil.
 * - `size`: lado en px (default 36).
 * - `className`: opcional, se concatena al SVG (útil para `ring-*`).
 * - `title`: opcional, mostrado como tooltip nativo via `<title>`.
 */
export function GeneratedAvatar({ seed, size = 36, className = '', title }) {
  const name = seed || 'U';
  const expression = useMemo(() => EXPRESSIONS[hashSeed(name) % EXPRESSIONS.length], [name]);

  return (
    <Blobatar
      name={name}
      size={size}
      background="circle"
      expression={expression}
      animate="always"
      title={title}
      className={`flex-shrink-0 ${className}`}
      role="img"
      aria-label={title ?? 'Avatar'}
    />
  );
}

export default GeneratedAvatar;
