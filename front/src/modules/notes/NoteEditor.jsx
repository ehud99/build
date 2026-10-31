import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  ChevronLeft,
  Ellipsis,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Pin,
  PinOff,
  Strikethrough,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiError } from '@/lib/api.js';
import * as notesApi from './api.js';
import { ColorPalette, ConfirmDialog } from './NoteParts.jsx';
import { formatNoteDate, isEmptyDoc } from './notesLogic.js';
import { useDismiss } from './useDismiss.js';

const SAVE_MS = 600;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** Las extensiones: exactamente lo que acepta la lista blanca del servidor (docs/contrato-notas.md). */
const EXTENSIONS = [
  StarterKit.configure({
    code: false,
    codeBlock: false,
    trailingNode: false,
    heading: { levels: [1, 2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      isAllowedUri: (url, ctx) => SAFE_LINK.test(url) && ctx.defaultValidate(url),
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
    // La vista de Tiptap no pone `data-type` en el `li`; lo usan los estilos (notes.css).
    HTMLAttributes: { 'data-type': 'taskItem' },
    a11y: { checkboxLabel: (node, checked) => `${checked ? 'Desmarcar' : 'Marcar'} ${node.textContent || 'ítem vacío'}` },
  }),
  Placeholder.configure({
    placeholder: ({ pos }) => (pos === 0 ? 'Título' : 'Escribe algo…'),
  }),
];

/** Botón de la cabecera, en el color de acento como el iPhone. */
function HeaderButton({ label, onClick, children, testId, pressed, className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-testid={testId}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      {children}
    </button>
  );
}

/** Botón del panel «Aa» (no le quita el foco al texto). */
function Tool({ label, active, onClick, children, testId, className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={Boolean(active)}
      data-testid={testId}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`note-tool flex min-h-10 items-center justify-center rounded-xl px-2 text-text focus-visible:outline-2 focus-visible:outline-accent ${className}`}
    >
      {children}
    </button>
  );
}

/** Panel «Aa» como el del iPhone: estilos de párrafo, B I U S y las listas. */
function FormatPanel({ editor, onClose }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      body: e.isActive('paragraph') && !e.isActive('heading'),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
    }),
  });
  const run = (fn) => () => fn(editor.chain().focus()).run();
  return (
    <div
      className="note-format-panel note-panel-bg absolute inset-x-0 bottom-0 z-10 rounded-t-3xl border-t border-border px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-[var(--shadow-md)] md:rounded-b-3xl"
      data-testid="note-format-panel"
      role="toolbar"
      aria-label="Formato"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-semibold">Formato</span>
        <button
          type="button"
          aria-label="Cerrar formato"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-text-muted"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Tool label="Título" active={s.h1} testId="fmt-title" className="flex-none px-3 text-lg font-bold" onClick={run((c) => c.setHeading({ level: 1 }))}>
          Título
        </Tool>
        <Tool label="Encabezado" active={s.h2} testId="fmt-heading" className="flex-none px-3 font-bold" onClick={run((c) => c.setHeading({ level: 2 }))}>
          Encabezado
        </Tool>
        <Tool label="Subencabezado" active={s.h3} testId="fmt-subheading" className="flex-none px-3 text-sm font-semibold" onClick={run((c) => c.setHeading({ level: 3 }))}>
          Subencabezado
        </Tool>
        <Tool label="Cuerpo" active={s.body} testId="fmt-body" className="flex-none px-3 text-sm" onClick={run((c) => c.setParagraph())}>
          Cuerpo
        </Tool>
      </div>
      <div className="mt-2 grid grid-cols-[repeat(4,1fr)_8px_repeat(3,1fr)] gap-1.5">
        <Tool label="Negrita" active={s.bold} testId="fmt-bold" onClick={run((c) => c.toggleBold())}>
          <Bold className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden="true" />
        </Tool>
        <Tool label="Cursiva" active={s.italic} testId="fmt-italic" onClick={run((c) => c.toggleItalic())}>
          <Italic className="h-[18px] w-[18px]" aria-hidden="true" />
        </Tool>
        <Tool label="Subrayado" active={s.underline} testId="fmt-underline" onClick={run((c) => c.toggleUnderline())}>
          <Underline className="h-[18px] w-[18px]" aria-hidden="true" />
        </Tool>
        <Tool label="Tachado" active={s.strike} testId="fmt-strike" onClick={run((c) => c.toggleStrike())}>
          <Strikethrough className="h-[18px] w-[18px]" aria-hidden="true" />
        </Tool>
        <span aria-hidden="true" />
        <Tool label="Lista con viñetas" active={s.bullet} testId="fmt-bullet" onClick={run((c) => c.toggleBulletList())}>
          <List className="h-[18px] w-[18px]" aria-hidden="true" />
        </Tool>
        <Tool label="Lista numerada" active={s.ordered} testId="fmt-ordered" onClick={run((c) => c.toggleOrderedList())}>
          <ListOrdered className="h-[18px] w-[18px]" aria-hidden="true" />
        </Tool>
        <Tool label="Lista de verificación" active={s.task} testId="fmt-checklist" onClick={run((c) => c.toggleTaskList())}>
          <ListChecks className="h-[18px] w-[18px]" aria-hidden="true" />
        </Tool>
      </div>
    </div>
  );
}

/**
 * Editor de una nota como el de Notas del iPhone: pantalla completa en el celular (entra desde la
 * derecha) y un panel grande centrado en PC. La primera línea es el título. Se guarda solo (600 ms
 * después de dejar de escribir) y al cerrar: una nota nueva se crea recién cuando tiene texto, y una
 * que queda vacía se borra al cerrar.
 *
 * - `note`: la nota completa (con `content`) o `null` para una nueva.
 * - `onSaved(note)`, `onDeleted(id)`, `onClose()`.
 */
export function NoteEditor({ note: initial, onSaved, onDeleted, onClose }) {
  const noteRef = useRef(initial);
  const [meta, setMeta] = useState({ color: initial?.color ?? 'default', pinned: initial?.pinned ?? false });
  const metaRef = useRef(meta);
  const [stamp, setStamp] = useState(() => initial?.updated_at ?? new Date().toISOString());
  const [focused, setFocused] = useState(false);
  const [format, setFormat] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(null);
  const errorRef = useRef(false);
  const timer = useRef(null);
  const dirty = useRef(false);
  const queue = useRef(Promise.resolve());
  const docRef = useRef(initial?.content ?? null);
  const closing = useRef(false);
  const menuRef = useRef(null);
  const callbacks = useRef({ onSaved, onDeleted, onClose });
  useEffect(() => {
    callbacks.current = { onSaved, onDeleted, onClose };
  });

  /** Encola una escritura: nunca dos a la vez (así no se crean dos notas al escribir rápido). */
  const enqueue = useCallback((task) => {
    const next = queue.current.then(task);
    queue.current = next.catch(() => {});
    return next;
  }, []);

  const fail = useCallback((e) => {
    errorRef.current = true;
    setError(`${apiError(e).message} Tus cambios siguen aquí.`);
  }, []);

  const saved = useCallback((n) => {
    noteRef.current = n;
    errorRef.current = false;
    setError(null);
    setStamp(n.updated_at);
    callbacks.current.onSaved(n);
  }, []);

  /** Guarda lo pendiente (si hay). Una nota vacía no se crea ni se guarda vacía. */
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return queue.current;
    dirty.current = false;
    const doc = docRef.current;
    return enqueue(async () => {
      if (isEmptyDoc(doc)) return;
      const current = noteRef.current;
      const n = current
        ? await notesApi.updateNote(current.id, { content: doc })
        : await notesApi.createNote({ content: doc, ...metaRef.current });
      saved(n);
    }).catch((e) => {
      dirty.current = true;
      fail(e);
      throw e;
    });
  }, [enqueue, fail, saved]);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initial?.content ?? '',
    autofocus: initial ? false : 'end',
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { 'aria-label': 'Texto de la nota', 'data-testid': 'note-editor-content', spellcheck: 'true' },
    },
    onUpdate: ({ editor: e }) => {
      docRef.current = e.getJSON();
      dirty.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flush().catch(() => {}), SAVE_MS);
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  });

  /** Borra la nota del servidor si ya existe; devuelve su `id` (o `null`). */
  const deleteCurrent = useCallback(async () => {
    const current = noteRef.current;
    if (!current) return null;
    await notesApi.deleteNote(current.id);
    noteRef.current = null;
    return current.id;
  }, []);

  const close = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    const force = errorRef.current;
    try {
      await flush();
      await queue.current;
      if (isEmptyDoc(docRef.current)) {
        const id = await enqueue(deleteCurrent);
        if (id) callbacks.current.onDeleted(id);
      }
    } catch (e) {
      if (!force) {
        closing.current = false;
        fail(e);
        return;
      }
    }
    callbacks.current.onClose();
  }, [deleteCurrent, enqueue, fail, flush]);

  // Si el editor se desmonta sin cerrar (otra ruta), guarda lo pendiente igual.
  useEffect(
    () => () => {
      if (!closing.current && dirty.current) flush().catch(() => {});
    },
    [flush],
  );

  // Esc cierra; el fondo no se desplaza mientras el editor está abierto.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  const closeMenu = useCallback(() => setMenu(false), []);
  useDismiss(menuRef, menu, closeMenu);

  /** Fijar o pintar: en una nota guardada va al servidor ya; en una nueva, con la creación. */
  const changeMeta = (patch) => {
    const next = { ...metaRef.current, ...patch };
    metaRef.current = next;
    setMeta(next);
    // Se lee la nota al correr: si la creación aún está en camino, el cambio va después de ella.
    enqueue(async () => {
      const current = noteRef.current;
      return current ? notesApi.updateNote(current.id, patch) : null;
    })
      .then((n) => {
        if (!n) return;
        noteRef.current = n;
        callbacks.current.onSaved(n);
      })
      .catch(fail);
  };

  const remove = async () => {
    setConfirm(false);
    closing.current = true;
    clearTimeout(timer.current);
    dirty.current = false;
    try {
      const id = await enqueue(deleteCurrent);
      if (id) callbacks.current.onDeleted(id);
    } catch (e) {
      closing.current = false;
      fail(e);
      return;
    }
    callbacks.current.onClose();
  };

  const focusEnd = (e) => {
    if (e.target === e.currentTarget) editor?.commands.focus('end');
  };

  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center md:p-6" data-testid="note-editor">
      <div className="note-backdrop absolute inset-0 hidden md:block" onClick={close} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={initial ? 'Nota' : 'Nota nueva'}
        data-color={meta.color}
        className="note-editor-shell note-bg relative flex h-dvh w-full flex-col overflow-hidden text-text md:h-[min(86dvh,820px)] md:max-w-3xl md:rounded-3xl md:border md:border-border md:shadow-[var(--shadow-md)]"
      >
        <header className="flex flex-none items-center justify-between gap-2 px-1.5 pb-1 pt-[calc(env(safe-area-inset-top)+6px)] md:px-3 md:pt-3">
          <button
            type="button"
            onClick={close}
            data-testid="note-back"
            className="flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[17px] text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
            Notas
          </button>
          <div className="flex items-center gap-0.5">
            <HeaderButton
              label="Lista de verificación"
              testId="note-checklist"
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <ListChecks className="h-[22px] w-[22px]" aria-hidden="true" />
            </HeaderButton>
            <HeaderButton
              label="Formato"
              testId="note-format"
              pressed={format}
              onClick={() => {
                setFormat((v) => !v);
                setMenu(false);
              }}
              className="text-[17px] font-semibold"
            >
              Aa
            </HeaderButton>
            <div className="relative" ref={menuRef}>
              <HeaderButton label="Más opciones" testId="note-more" pressed={menu} onClick={() => setMenu((v) => !v)}>
                <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full border-[1.8px] border-current">
                  <Ellipsis className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
                </span>
              </HeaderButton>
              {menu ? (
                <div
                  role="menu"
                  data-testid="note-menu"
                  className="absolute right-0 top-full z-20 mt-1 w-[min(264px,calc(100vw-24px))] rounded-2xl border border-border bg-surface p-1.5 text-text shadow-[var(--shadow-md)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="note-menu-pin"
                    onClick={() => {
                      setMenu(false);
                      changeMeta({ pinned: !metaRef.current.pinned });
                    }}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[15px] hover:bg-surface-2"
                  >
                    {meta.pinned ? 'Desfijar' : 'Fijar'}
                    {meta.pinned ? <PinOff className="h-[18px] w-[18px] text-text-muted" aria-hidden="true" /> : <Pin className="h-[18px] w-[18px] text-text-muted" aria-hidden="true" />}
                  </button>
                  <div className="px-3 pb-2 pt-1.5">
                    <p className="mb-2 text-xs font-medium text-text-muted">Color</p>
                    <ColorPalette value={meta.color} onPick={(key) => changeMeta({ color: key })} />
                  </div>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="note-menu-delete"
                    onClick={() => {
                      setMenu(false);
                      setConfirm(true);
                    }}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[15px] text-danger hover:bg-surface-2"
                  >
                    Eliminar
                    <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
            {focused ? (
              <HeaderButton
                label="OK"
                testId="note-done"
                onClick={() => editor?.commands.blur()}
                className="text-[17px] font-semibold"
              >
                OK
              </HeaderButton>
            ) : null}
          </div>
        </header>

        {error ? (
          <p role="alert" data-testid="note-error" className="mx-4 mb-1 rounded-xl bg-surface-2 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 md:px-12" onClick={focusEnd}>
          <p className="note-faint py-2 text-center text-[13px]" data-testid="note-date">
            {formatNoteDate(stamp)}
          </p>
          <EditorContent editor={editor} className="note-prose" />
        </div>

        {format && editor ? <FormatPanel editor={editor} onClose={() => setFormat(false)} /> : null}
      </section>

      {confirm ? (
        <ConfirmDialog
          title="¿Eliminar la nota?"
          message="No se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={remove}
          onCancel={() => setConfirm(false)}
        />
      ) : null}
    </div>
  );
}
