import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { COLORS } from './notesLogic.js';

/** La paleta de círculos tipo Keep. `onPick(key)` con la clave elegida. */
export function ColorPalette({ value, onPick, className = '' }) {
  return (
    <div role="radiogroup" aria-label="Color de la nota" className={`flex flex-wrap gap-1.5 ${className}`}>
      {COLORS.map((c) => {
        const selected = c.key === value;
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            title={c.label}
            data-testid={`note-color-${c.key}`}
            data-color={c.key}
            data-selected={selected}
            onClick={(e) => {
              e.stopPropagation();
              onPick(c.key);
            }}
            className="note-bg note-swatch flex h-7 w-7 items-center justify-center rounded-full text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Confirmación chica («¿Eliminar la nota?») encima de todo. Esc o tocar fuera la cancelan. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const confirmRef = useRef(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" data-testid="note-confirm">
      <div className="note-backdrop absolute inset-0" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="note-confirm-title"
        className="relative w-full max-w-xs rounded-2xl border border-border bg-surface p-5 text-center shadow-[var(--shadow-md)]"
      >
        <h2 id="note-confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        {message ? <p className="mt-1 text-sm text-text-muted">{message}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-xl bg-surface-2 text-sm font-medium hover:bg-surface-3"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            data-testid="note-confirm-ok"
            onClick={onConfirm}
            className="min-h-10 rounded-xl bg-danger text-sm font-semibold text-accent-fg hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
