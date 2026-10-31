import { Copy, MoreVertical, PenTool, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cleanName, formatEdited } from './sceneLogic.js';
import { useDismiss } from './useDismiss.js';

/** Menú «⋮» de la card: renombrar, duplicar y eliminar. */
function CardMenu({ onRename, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const item = (label, Icon, action, testId, danger) => (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      onClick={() => {
        setOpen(false);
        action();
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-2 ${danger ? 'text-danger' : 'text-text'}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="wb-card-more"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          data-testid="wb-card-menu"
          className="absolute bottom-full right-0 z-30 mb-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-[var(--shadow-md)]"
        >
          {item('Renombrar', Pencil, onRename, 'wb-menu-rename')}
          {item('Duplicar', Copy, onDuplicate, 'wb-menu-duplicate')}
          {item('Eliminar', Trash2, onDelete, 'wb-menu-delete', true)}
        </div>
      ) : null}
    </div>
  );
}

/** El campo para renombrar: Enter o salir guardan, Esc cancela. */
function RenameInput({ initial, onDone }) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.select();
  }, []);
  const finish = (save) => {
    const name = cleanName(value);
    onDone(save && name && name !== initial ? name : null);
  };
  return (
    <input
      ref={inputRef}
      value={value}
      maxLength={80}
      aria-label="Nombre de la pizarra"
      data-testid="wb-card-name-input"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') {
          e.stopPropagation();
          finish(false);
        }
      }}
      className="h-8 w-full min-w-0 rounded-lg border border-accent bg-surface px-2 text-[15px] font-medium text-text focus:outline-none"
    />
  );
}

/** El nombre de la card: un botón que abre la pizarra o, al renombrar, el campo. */
function CardName({ board, editing, onDone, onOpen }) {
  if (editing) return <RenameInput initial={board.name} onDone={onDone} />;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="wb-card-name"
      className="block max-w-full min-w-0 truncate text-left text-[15px] font-medium text-text hover:underline"
      title={board.name}
    >
      {board.name}
    </button>
  );
}

/**
 * Card de una pizarra: la miniatura del dibujo (PNG o WebP que guardó el editor; en oscuro se
 * invierte como hace Excalidraw), el nombre editable, la fecha de la última edición y el menú.
 */
export function BoardCard({ board, renaming, onOpen, onRename, onRenameDone, onDuplicate, onDelete }) {
  return (
    <article
      data-testid="wb-card"
      data-id={board.id}
      className="wb-card group relative flex min-w-0 flex-col rounded-2xl border border-border bg-surface"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir la pizarra ${board.name}`}
        className="wb-thumb-box relative block aspect-[4/3] w-full overflow-hidden rounded-t-2xl border-b border-border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        {board.thumbnail_url ? (
          <img
            src={board.thumbnail_url}
            alt=""
            data-testid="wb-card-thumb"
            loading="lazy"
            draggable={false}
            className="wb-thumb h-full w-full object-contain p-3"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-text-faint" data-testid="wb-card-blank">
            <PenTool className="h-8 w-8" strokeWidth={1.3} aria-hidden="true" />
          </span>
        )}
      </button>
      <div className="flex items-center gap-1 py-2 pl-3 pr-1.5">
        <div className="min-w-0 flex-1">
          <CardName board={board} editing={renaming} onDone={onRenameDone} onOpen={onOpen} />
          <p className="mt-0.5 truncate text-xs text-text-muted" data-testid="wb-card-date">
            {formatEdited(board.updated_at)}
          </p>
        </div>
        <CardMenu onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </article>
  );
}

/** Confirmación chica («¿Eliminar la pizarra?») encima de todo. Esc o tocar fuera la cancelan. */
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" data-testid="wb-confirm">
      <div className="wb-scrim absolute inset-0" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wb-confirm-title"
        className="relative w-full max-w-xs rounded-2xl border border-border bg-surface p-5 text-center shadow-[var(--shadow-md)]"
      >
        <h2 id="wb-confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        {message ? <p className="mt-1 text-sm text-text-muted">{message}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="min-h-10 rounded-xl bg-surface-2 text-sm font-medium hover:bg-surface-3">
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            data-testid="wb-confirm-ok"
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
