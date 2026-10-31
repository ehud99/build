import { Lightbulb, Plus, Search, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { apiError } from '@/lib/api.js';
import * as notesApi from './api.js';
import { NoteCard } from './NoteCard.jsx';
import { NoteEditor } from './NoteEditor.jsx';
import { ConfirmDialog } from './NoteParts.jsx';
import { columnCount, masonry, upsertNote } from './notesLogic.js';
import './notes.css';

const SEARCH_MS = 300;

/** Ancho del contenedor (para elegir cuántas columnas caben). */
function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Una sección («Fijadas» u «Otras») con sus cards en mampostería. */
function NoteGrid({ label, notes, columns, testId, ...handlers }) {
  if (!notes.length) return null;
  return (
    <section className="mb-7" data-testid={testId} aria-label={label ?? 'Notas'}>
      {label ? (
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</h2>
      ) : null}
      <div className="flex items-start gap-2 md:gap-3">
        {masonry(notes, columns).map((col, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3">
            {col.map((note) => (
              <NoteCard key={note.id} note={note} {...handlers} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Notas: las cards en mampostería como Google Keep (fijadas arriba), con buscador, la barra
 * «Crear una nota…» en PC y el «+» flotante en el celular. Tocar una card abre el editor
 * (`NoteEditor`, como Notas del iPhone).
 */
export default function NotesPage() {
  const [notes, setNotes] = useState(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const requestId = useRef(0);
  const gridRef = useRef(null);
  const width = useWidth(gridRef);
  const columns = columnCount(width || 1200);

  const load = useCallback((q) => {
    const id = ++requestId.current;
    notesApi
      .fetchNotes(q)
      .then((list) => {
        if (id !== requestId.current) return;
        setError(null);
        setNotes(list);
      })
      .catch((e) => id === requestId.current && setError(apiError(e).message));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), SEARCH_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => load(search), [load, search]);

  const openNew = () => setEditing({ key: `new-${Date.now()}`, note: null });

  const openNote = async (summary) => {
    try {
      const full = await notesApi.fetchNote(summary.id);
      setEditing({ key: `note-${full.id}`, note: full });
    } catch (e) {
      setError(apiError(e).message);
    }
  };

  const patch = async (note, body) => {
    setNotes((list) => upsertNote(list, { ...note, ...body }));
    try {
      const updated = await notesApi.updateNote(note.id, body);
      setNotes((list) => upsertNote(list, updated));
    } catch (e) {
      setError(apiError(e).message);
      load(search);
    }
  };

  const confirmDelete = async () => {
    const note = toDelete;
    setToDelete(null);
    setNotes((list) => list.filter((n) => n.id !== note.id));
    try {
      await notesApi.deleteNote(note.id);
    } catch (e) {
      setError(apiError(e).message);
      load(search);
    }
  };

  const onSaved = useCallback((n) => setNotes((list) => upsertNote(list ?? [], n)), []);
  const onDeleted = useCallback((id) => setNotes((list) => (list ?? []).filter((n) => n.id !== id)), []);
  const onClose = useCallback(() => {
    setEditing(null);
    load(search);
  }, [load, search]);

  const pinned = (notes ?? []).filter((n) => n.pinned);
  const others = (notes ?? []).filter((n) => !n.pinned);
  const handlers = {
    onOpen: openNote,
    onPin: (note) => patch(note, { pinned: !note.pinned }),
    onColor: (note, color) => patch(note, { color }),
    onDelete: (note) => setToDelete(note),
  };

  return (
    <>
      <PageHeader title="Notas">
        <label className="relative block w-[min(320px,calc(100vw-32px))]">
          <span className="sr-only">Buscar notas</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar notas"
            data-testid="notes-search"
            className="h-10 w-full rounded-full border border-border bg-surface pl-9 pr-9 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-surface-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </label>
      </PageHeader>

      <button
        type="button"
        onClick={openNew}
        data-testid="notes-create-bar"
        className="mx-auto mb-7 hidden h-12 w-full max-w-xl items-center rounded-2xl border border-border bg-surface px-4 text-left text-[15px] font-medium text-text-muted shadow-[var(--shadow-md)] hover:text-text focus-visible:outline-2 focus-visible:outline-accent md:flex"
      >
        Crear una nota…
      </button>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div ref={gridRef} data-testid="notes-list">
        {notes === null ? (
          <p className="py-10 text-center text-sm text-text-muted">Cargando…</p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center" data-testid="notes-empty">
            {search ? (
              <>
                <Search className="h-16 w-16 text-text-faint" strokeWidth={1.2} aria-hidden="true" />
                <p className="mt-4 text-[15px] text-text-muted">No hay notas que coincidan con «{search}».</p>
              </>
            ) : (
              <>
                <Lightbulb className="h-20 w-20 text-text-faint" strokeWidth={1.1} aria-hidden="true" />
                <p className="mt-4 text-[15px] text-text-muted">Las notas que escribas aparecerán aquí.</p>
                <button
                  type="button"
                  onClick={openNew}
                  className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
                >
                  Escribir una nota
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <NoteGrid label={pinned.length ? 'Fijadas' : null} notes={pinned} columns={columns} testId="notes-pinned" {...handlers} />
            <NoteGrid label={pinned.length ? 'Otras' : null} notes={others} columns={columns} testId="notes-others" {...handlers} />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={openNew}
        aria-label="Nueva nota"
        data-testid="notes-fab"
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-[var(--shadow-md)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden motion-reduce:active:scale-100"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 98px)' }}
      >
        <Plus className="h-7 w-7" strokeWidth={2.4} aria-hidden="true" />
      </button>

      {editing ? (
        <NoteEditor key={editing.key} note={editing.note} onSaved={onSaved} onDeleted={onDeleted} onClose={onClose} />
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title="¿Eliminar la nota?"
          message={toDelete.title ? `«${toDelete.title}» se borrará para siempre.` : 'Se borrará para siempre.'}
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
