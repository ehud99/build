import { PenTool, Plus } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { apiError } from '@/lib/api.js';
import * as boardsApi from './api.js';
import { BoardCard, ConfirmDialog } from './BoardCard.jsx';
import { upsertBoard } from './sceneLogic.js';
import { whenSaved } from './saveQueue.js';
import './whiteboard.css';

/**
 * El editor (y con él Excalidraw, sus estilos y sus idiomas) va en su propio chunk: primero se
 * fija `EXCALIDRAW_ASSET_PATH` para que las fuentes salgan de la app y no de una CDN.
 */
const WhiteboardEditor = lazy(() => import('./assetPath.js').then(() => import('./WhiteboardEditor.jsx')));

function EditorFallback() {
  return (
    <div className="wb-editor-frame flex items-center justify-center" role="status" aria-label="Cargando la pizarra">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}

/** La lista de pizarras: cards con la miniatura, el nombre editable, la fecha y el menú. */
function BoardList({ onOpen }) {
  const [boards, setBoards] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    await whenSaved();
    try {
      const list = await boardsApi.fetchBoards();
      if (alive.current) {
        setBoards(list);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(apiError(e).message);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    whenSaved()
      .then(() => boardsApi.fetchBoards())
      .then((list) => alive.current && setBoards(list))
      .catch((e) => alive.current && setError(apiError(e).message));
    return () => {
      alive.current = false;
    };
  }, [load]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const board = await boardsApi.createBoard();
      onOpen(board.id);
    } catch (e) {
      setError(apiError(e).message);
      setCreating(false);
    }
  };

  const rename = async (board, name) => {
    setRenaming(null);
    if (!name) return;
    setBoards((list) => list.map((b) => (b.id === board.id ? { ...b, name } : b)));
    try {
      const saved = await boardsApi.updateBoard(board.id, { name });
      setBoards((list) => upsertBoard(list, saved));
    } catch (e) {
      setError(apiError(e).message);
      load();
    }
  };

  const duplicate = async (board) => {
    try {
      const copy = await boardsApi.duplicateBoard(board.id);
      setBoards((list) => upsertBoard(list, copy));
    } catch (e) {
      setError(apiError(e).message);
    }
  };

  const confirmDelete = async () => {
    const board = toDelete;
    setToDelete(null);
    setBoards((list) => list.filter((b) => b.id !== board.id));
    try {
      await boardsApi.deleteBoard(board.id);
    } catch (e) {
      setError(apiError(e).message);
      load();
    }
  };

  return (
    <>
      <PageHeader title="Pizarra">
        <button
          type="button"
          onClick={create}
          disabled={creating}
          data-testid="wb-new"
          className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva pizarra
        </button>
      </PageHeader>

      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div data-testid="wb-list">
        {boards === null ? (
          <p className="py-10 text-center text-sm text-text-muted">Cargando…</p>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center" data-testid="wb-empty">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-dashed border-border-strong bg-surface text-text-faint">
              <PenTool className="h-10 w-10" strokeWidth={1.2} aria-hidden="true" />
            </div>
            <p className="mt-5 text-[15px] font-medium text-text">Todavía no tienes pizarras</p>
            <p className="mt-1 max-w-xs text-sm text-text-muted">
              Dibuja ideas, diagramas o planos a mano alzada. Se guardan solas mientras dibujas.
            </p>
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="mt-5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
            >
              Crear mi primera pizarra
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                renaming={renaming === board.id}
                onOpen={() => onOpen(board.id)}
                onRename={() => setRenaming(board.id)}
                onRenameDone={(name) => rename(board, name)}
                onDuplicate={() => duplicate(board)}
                onDelete={() => setToDelete(board)}
              />
            ))}
          </div>
        )}
      </div>

      {toDelete ? (
        <ConfirmDialog
          title="¿Eliminar la pizarra?"
          message={`«${toDelete.name}» se borrará para siempre.`}
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Pizarra (docs/contrato-pizarra.md): la lista en `/pizarra` y el editor en `/pizarra?id=12`
 * (el registro declara solo `/pizarra`, así que la pizarra abierta va en la búsqueda).
 */
export default function WhiteboardPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('id');
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const open = useCallback((boardId) => setParams({ id: String(boardId) }), [setParams]);
  const close = useCallback(() => setParams({}), [setParams]);

  if (id === null) return <BoardList onOpen={open} />;
  return (
    <Suspense fallback={<EditorFallback />}>
      <WhiteboardEditor key={id} id={id} onClose={close} />
    </Suspense>
  );
}
