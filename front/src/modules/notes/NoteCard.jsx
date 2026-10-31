import { Check, Palette, Pin, PinOff, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { ColorPalette } from './NoteParts.jsx';
import { useDismiss } from './useDismiss.js';

/** Una línea de la vista previa (`preview.lines` del servidor), armada con elementos de React. */
function PreviewLine({ line }) {
  const indent = line.depth ? { paddingLeft: `${Math.min(line.depth, 4) * 0.9}rem` } : undefined;
  if (line.kind === 'rule') return <hr className="my-1.5 border-0 border-t border-current opacity-20" />;
  if (line.kind === 'task') {
    return (
      <div className="flex items-start gap-1.5" style={indent} data-testid="note-preview-task" data-checked={line.checked}>
        <span
          className="note-check mt-[3px] flex h-3.5 w-3.5 flex-none items-center justify-center"
          data-checked={line.checked}
          aria-hidden="true"
        >
          {line.checked ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
        </span>
        <span className={`min-w-0 break-words ${line.checked ? 'note-faint line-through' : ''}`}>{line.text}</span>
      </div>
    );
  }
  if (!line.text) return <div className="h-2" aria-hidden="true" />;
  if (line.kind === 'bullet' || line.kind === 'ordered') {
    return (
      <div className="flex gap-1.5" style={indent}>
        <span className="note-soft flex-none tabular-nums">{line.kind === 'bullet' ? '•' : `${line.n}.`}</span>
        <span className="min-w-0 break-words">{line.text}</span>
      </div>
    );
  }
  if (line.kind === 'heading') {
    return (
      <div className="break-words font-semibold" style={indent}>
        {line.text}
      </div>
    );
  }
  if (line.kind === 'quote') {
    return (
      <div className="note-soft break-words border-l-2 border-current pl-2" style={indent}>
        {line.text}
      </div>
    );
  }
  return (
    <div className="break-words" style={indent}>
      {line.text}
    </div>
  );
}

/** Botón redondo de las acciones de la card. */
function CardAction({ label, onClick, children, testId, pressed }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="note-soft note-hover-bg flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

/**
 * Card de una nota como Keep: título en negrita, la vista previa (las casillas de las listas de
 * verificación, las marcadas tachadas; «+N» si hay más) sobre el color de la nota, y las acciones
 * (fijar, color y eliminar) al pasar el mouse o, en pantallas táctiles, siempre y discretas.
 */
export function NoteCard({ note, onOpen, onPin, onColor, onDelete }) {
  const [palette, setPalette] = useState(false);
  const paletteRef = useRef(null);
  const closePalette = useCallback(() => setPalette(false), []);
  useDismiss(paletteRef, palette, closePalette);
  const lines = note.preview?.lines ?? [];
  const more = note.preview?.more ?? 0;
  const empty = !note.title && lines.length === 0;

  return (
    <article
      data-testid="note-card"
      data-note-id={note.id}
      data-color={note.color}
      className="note-card note-bg group relative rounded-2xl text-text transition-shadow"
    >
      <button
        type="button"
        onClick={() => onOpen(note)}
        aria-label={`Abrir la nota ${note.title || 'sin título'}`}
        className="block w-full rounded-2xl px-4 pb-11 pt-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {note.title ? (
          <h3 className="break-words pr-7 text-[15px] font-semibold leading-snug" data-testid="note-card-title">
            {note.title}
          </h3>
        ) : null}
        {lines.length ? (
          <div className={`space-y-0.5 text-sm leading-snug ${note.title ? 'mt-1.5' : 'pr-7'}`} data-testid="note-card-preview">
            {lines.map((line, i) => (
              <PreviewLine key={i} line={line} />
            ))}
          </div>
        ) : null}
        {more ? (
          <p className="note-faint mt-1.5 text-xs font-medium" data-testid="note-card-more">
            +{more}
          </p>
        ) : null}
        {empty ? <p className="note-faint text-sm">Nota vacía</p> : null}
      </button>

      <div className="note-actions absolute right-1.5 top-1.5" data-open={palette}>
        <CardAction
          label={note.pinned ? 'Desfijar nota' : 'Fijar nota'}
          pressed={note.pinned}
          testId="note-card-pin"
          onClick={() => onPin(note)}
        >
          {note.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
        </CardAction>
      </div>

      <div ref={paletteRef} className="note-actions absolute inset-x-1.5 bottom-1.5" data-open={palette}>
        <div className="flex items-center gap-0.5">
          <CardAction label="Color" testId="note-card-color" onClick={() => setPalette((v) => !v)} pressed={palette}>
            <Palette className="h-4 w-4" aria-hidden="true" />
          </CardAction>
          <CardAction label="Eliminar nota" testId="note-card-delete" onClick={() => onDelete(note)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </CardAction>
        </div>
        {palette ? (
          <div
            className="absolute inset-x-0 top-full z-20 mt-1 rounded-2xl border border-border bg-surface p-2 shadow-[var(--shadow-md)]"
            data-testid="note-card-palette"
          >
            <ColorPalette
              value={note.color}
              onPick={(key) => {
                setPalette(false);
                onColor(note, key);
              }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
