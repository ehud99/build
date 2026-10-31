import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hoja desde abajo en el celular y modal centrado en PC (solo CSS: `items-end md:items-center`).
 * Cierra con Escape, con la ✕ y tocando el fondo. `level` sube el z-index de una hoja encima de
 * otra (crear una categoría desde «Nuevo gasto»).
 */
export function Sheet({ title, onClose, children, footer, level = 0, testId, wide = false }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Solo la hoja de más arriba.
      const sheets = document.querySelectorAll('[data-fin-sheet]');
      if (sheets[sheets.length - 1] === panelRef.current) closeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector('[data-autofocus]');
    (first ?? panelRef.current)?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center md:items-center md:p-6" style={{ zIndex: 60 + level * 10 }}>
      <div className="fin-backdrop absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-fin-sheet=""
        data-testid={testId}
        className={`fin-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface text-text shadow-[var(--shadow-md)] outline-none md:rounded-3xl ${
          wide ? 'md:max-w-2xl' : 'md:max-w-lg'
        }`}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border-strong md:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3 md:pt-5">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer ? (
          <div
            className="shrink-0 border-t border-border bg-surface px-5 pt-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default Sheet;
