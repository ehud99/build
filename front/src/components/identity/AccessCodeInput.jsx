import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { ACCESS_CODE_GROUPS, ACCESS_CODE_LENGTH, cleanAccessCode, isAccessCodeChar } from '@/lib/accessCode.js';

/**
 * Código de acceso: el código de acceso en 6 casillas (4 – 2), ocultas hasta
 * «Mostrar». Escribir avanza, borrar retrocede, las flechas mueven y pegar reparte el código
 * desde la casilla enfocada. Controlado: `value` es el texto (hasta 6) y `onChange(texto)`.
 *
 * Props: `label`, `error`, `helperText`, `disabled`, `autoFocus`, `name` (prefijo de los
 * `data-testid`: `${name}-0`…), `size` ('md' | 'lg'), `shake` (cambia de valor para temblar),
 * `onComplete(texto)` al llenar la sexta.
 *
 * `ref.focus()` enfoca la primera casilla vacía; `ref.clear()` vacía y enfoca la primera.
 */
export const AccessCodeInput = forwardRef(function AccessCodeInput(
  {
    value = '',
    onChange,
    onComplete,
    label,
    error,
    helperText,
    disabled = false,
    autoFocus = false,
    name = 'access-code',
    size = 'md',
    shake = 0,
    className = '',
  },
  ref,
) {
  const [reveal, setReveal] = useState(false);
  const cells = useRef([]);
  const labelId = useId();
  const chars = [...String(value ?? '')].slice(0, ACCESS_CODE_LENGTH);

  const focusAt = (i) => {
    const el = cells.current[Math.max(0, Math.min(ACCESS_CODE_LENGTH - 1, i))];
    el?.focus();
    el?.select?.();
  };

  useImperativeHandle(ref, () => ({
    focus: () => focusAt(Math.min(chars.length, ACCESS_CODE_LENGTH - 1)),
    clear: () => {
      onChange?.('');
      window.requestAnimationFrame(() => focusAt(0));
    },
  }));

  const emit = (next) => {
    const text = next.join('').slice(0, ACCESS_CODE_LENGTH);
    onChange?.(text);
    if (text.length === ACCESS_CODE_LENGTH) onComplete?.(text);
  };

  /** Escribe `text` desde la casilla `i` (una tecla o un pegado). */
  const writeFrom = (i, text) => {
    const clean = cleanAccessCode(text);
    if (!clean) return;
    const next = [...chars];
    // Las casillas se llenan en orden: no deja huecos antes de `i`.
    let at = Math.min(i, next.length);
    for (const ch of clean) {
      if (at >= ACCESS_CODE_LENGTH) break;
      next[at] = ch;
      at += 1;
    }
    emit(next);
    focusAt(at);
  };

  const handleKeyDown = (i) => (e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...chars];
      if (i < next.length) {
        next.splice(i, 1);
        emit(next);
        focusAt(i);
      } else if (i > 0) {
        next.splice(i - 1, 1);
        emit(next);
        focusAt(i - 1);
      }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      if (i < chars.length) {
        const next = [...chars];
        next.splice(i, 1);
        emit(next);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(Math.min(i + 1, chars.length));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (isAccessCodeChar(e.key)) writeFrom(i, e.key);
    }
  };

  // Teclados del celular (sin `keydown` útil) y autocompletar: llega por `input`.
  const handleInput = (i) => (e) => {
    const typed = e.target.value;
    e.target.value = chars[i] ?? '';
    if (typed) writeFrom(i, typed.length > 1 && chars[i] && typed.startsWith(chars[i]) ? typed.slice(1) : typed);
  };

  const handlePaste = (i) => (e) => {
    e.preventDefault();
    writeFrom(i, e.clipboardData.getData('text'));
  };

  const big = size === 'lg';
  const cellClass = `
    ${big ? 'h-14 w-11 text-2xl sm:h-16 sm:w-13' : 'h-11 w-9 text-lg sm:w-10'}
    rounded-xl border bg-surface text-center font-mono font-semibold text-text outline-none
    transition-[border-color,box-shadow] duration-150 caret-accent
    disabled:opacity-60
    ${error ? 'border-danger focus:ring-2 focus:ring-danger/20' : 'border-border focus:border-accent focus:ring-4 focus:ring-accent/22'}
  `;

  let index = 0;
  const groups = ACCESS_CODE_GROUPS.map((count, g) => {
    const group = [];
    for (let k = 0; k < count; k += 1) {
      const i = index;
      index += 1;
      group.push(
        <input
          key={i}
          ref={(el) => {
            cells.current[i] = el;
          }}
          type={reveal ? 'text' : 'password'}
          inputMode="text"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={ACCESS_CODE_LENGTH}
          value={chars[i] ?? ''}
          onChange={() => {}}
          onInput={handleInput(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste(i)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Carácter ${i + 1} de ${ACCESS_CODE_LENGTH}`}
          aria-describedby={label ? labelId : undefined}
          data-testid={`${name}-${i}`}
          className={cellClass}
        />,
      );
    }
    return (
      <div key={g} className="flex gap-1.5 sm:gap-2">
        {group}
      </div>
    );
  });

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div id={labelId} className="mb-1.5 block text-sm font-medium text-text-muted">
          {label}
        </div>
      )}
      <div
        key={shake}
        className={`flex items-center gap-2 ${big ? 'justify-center' : ''} ${shake ? 'animate-code-shake' : ''}`}
        role="group"
        aria-label={label ?? 'Código de acceso'}
      >
        {groups.reduce((acc, node, g) => {
          if (g > 0) {
            acc.push(
              <span key={`sep-${g}`} aria-hidden="true" className="text-text-faint">
                –
              </span>,
            );
          }
          acc.push(node);
          return acc;
        }, [])}
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="ml-1 rounded-lg p-2 text-text-faint hover:text-text"
          aria-label={reveal ? 'Ocultar código' : 'Mostrar código'}
          aria-pressed={reveal}
          data-testid={`${name}-reveal`}
          disabled={disabled}
        >
          {reveal ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-danger" data-testid={`${name}-error`}>
          {error}
        </p>
      ) : helperText ? (
        <p className="mt-1.5 text-sm text-text-faint">{helperText}</p>
      ) : null}
    </div>
  );
});

export default AccessCodeInput;
