import { useEffect, useState } from 'react';

import { Blobatar } from '@blobatar/react';
import { useGaze } from '@blobatar/react/gaze';
import { happy, idle, sad, sleepy, thinking, unsure } from 'blobatar/expression';
import 'blobatar/motion.css';
import 'blobatar/gaze.css';

/**
 * El bot del login y del registro. Un blobatar fijo que mira lo que
 * se escribe (`target`: un elemento, un punto `{x, y}` o `'pointer'`) y un globo que escribe
 * `message` letra a letra; mientras escribe, la cara «habla» (`.login-bot-talking`). La cara
 * cambia con `mood`. El globo lee el mensaje entero a los lectores de pantalla.
 */

const MOODS = { idle, happy, thinking, unsure, sad, sleepy };

/** Semilla del bot: siempre la misma cara. */
const BOT_SEED = 'real-login-bot';
const TYPE_MS = 26;

const reducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** `message` escrito letra a letra (entero con movimiento reducido). */
function useTyped(message) {
  const text = String(message ?? '');
  const [typed, setTyped] = useState({ text: '', count: 0 });
  const instant = reducedMotion();
  useEffect(() => {
    if (instant) return undefined;
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTyped({ text, count: i });
      if (i >= text.length) window.clearInterval(timer);
    }, TYPE_MS);
    return () => window.clearInterval(timer);
  }, [text, instant]);
  if (instant) return text;
  return typed.text === text ? text.slice(0, typed.count) : '';
}

export function LoginBot({ message, mood = 'idle', target = 'pointer', size = 56 }) {
  const { ref, lookAt } = useGaze({ travel: 3 });
  const shown = useTyped(message);
  const talking = shown.length < String(message ?? '').length;

  useEffect(() => {
    lookAt(target ?? 'rest');
  }, [lookAt, target]);

  return (
    <div className="flex items-center gap-3" data-testid="login-bot" data-mood={mood}>
      <div className={talking ? 'login-bot-talking' : ''}>
        <Blobatar
          ref={ref}
          name={BOT_SEED}
          size={size}
          background="circle"
          expression={MOODS[mood] ?? idle}
          animate="always"
          aria-hidden="true"
        />
      </div>
      <div
        key={message}
        className="login-bot-bubble relative max-w-[16rem] rounded-2xl rounded-bl-md bg-text px-3.5 py-2 text-sm font-medium text-bg shadow-md"
      >
        <span aria-hidden="true">{shown || ' '}</span>
        <span role="status" aria-live="polite" className="sr-only" data-testid="login-bot-message">
          {message}
        </span>
      </div>
    </div>
  );
}

export default LoginBot;
