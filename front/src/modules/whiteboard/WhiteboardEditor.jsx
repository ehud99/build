import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  elementsOverlappingBBox,
  exportToBlob,
  getSceneVersion,
  getVisibleSceneBounds,
  restoreElements,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { AlertCircle, Check, ChevronLeft, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTheme } from '@/contexts/ThemeContext.jsx';
import { apiError } from '@/lib/api.js';
import * as boardsApi from './api.js';
import { track } from './saveQueue.js';
import { cleanName, filesKey, initialAppState, pickAppState, sanitizeScene } from './sceneLogic.js';

const SAVE_MS = 1000;
const NAME_MS = 800;
const RETRY_MS = 5000;
const THUMB_MAX_BYTES = 90 * 1024;

/** Las letras del selector de Excalidraw (dibujo a mano, normal, títulos y código). */
const FONT_FAMILIES = ['Excalifont', 'Nunito', 'Lilita One', 'Comic Shanns'];
const FONT_SAMPLE = 'AaBbÁáÑñ¿?0123';

const UI_OPTIONS = {
  canvasActions: {
    // El guardado es automático: sin «Guardar» en un archivo abierto. Quedan «Abrir» y
    // «Exportar» (.excalidraw, PNG y SVG) como respaldo local.
    saveToActiveFile: false,
    toggleTheme: null,
    export: { saveFileToDisk: true },
    loadScene: true,
    saveAsImage: true,
    clearCanvas: true,
    changeViewBackgroundColor: true,
  },
};

/**
 * Excalidraw registra sus fuentes pero el navegador solo las descarga cuando algo las usa: un texto
 * escrito antes de eso se mide con otra letra y queda cortado al recargar. Se cargan al abrir (son
 * locales, `public/excalidraw/fonts`) y, si algún texto guardado se había medido mal, se vuelve a
 * medir (`refreshDimensions`) sin entrar en el historial de deshacer.
 */
async function ensureFonts(api) {
  await Promise.all(FONT_FAMILIES.map((family) => document.fonts.load(`20px "${family}"`, FONT_SAMPLE).catch(() => [])));
  const current = api.getSceneElementsIncludingDeleted();
  if (!current.some((el) => el.type === 'text' && !el.isDeleted)) return;
  const refreshed = restoreElements(current, null, { refreshDimensions: true, repairBindings: true });
  const changed = refreshed.some((el, i) => {
    const before = current[i];
    return el.type === 'text' && before && (Math.abs(el.width - before.width) > 0.5 || Math.abs(el.height - before.height) > 0.5);
  });
  if (changed) api.updateScene({ elements: refreshed, captureUpdate: CaptureUpdateAction.NEVER });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * La miniatura de la card: el dibujo en WebP (PNG si el navegador no sabe WebP) de hasta 480 px,
 * con fondo transparente y siempre en claro (la lista la invierte en oscuro, como el lienzo). `null` sin elementos; `undefined` si no se pudo.
 */
async function makeThumbnail(elements, files, appState) {
  if (!elements.length) return null;
  for (const [size, quality] of [
    [480, 0.82],
    [320, 0.6],
  ]) {
    try {
      const blob = await exportToBlob({
        elements,
        files,
        appState: { exportBackground: false, viewBackgroundColor: appState.viewBackgroundColor || '#ffffff', exportWithDarkMode: false },
        mimeType: 'image/webp',
        quality,
        maxWidthOrHeight: size,
        exportPadding: 16,
      });
      if (blob.size <= THUMB_MAX_BYTES && (blob.type === 'image/webp' || blob.type === 'image/png')) {
        return await blobToDataUrl(blob);
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Estado del guardado en la barra: «Guardado», «Guardando…» o el error. */
function SaveStatus({ status, message }) {
  if (status === 'error') {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-danger" data-testid="wb-status" data-status="error" title={message}>
        <AlertCircle className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        <span className="truncate">{message || 'No se pudo guardar'}</span>
      </span>
    );
  }
  const saving = status === 'saving';
  return (
    <span className="flex flex-none items-center gap-1.5 text-xs text-text-muted" data-testid="wb-status" data-status={status} role="status">
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />}
      {saving ? 'Guardando…' : 'Guardado'}
    </span>
  );
}

/**
 * El editor de una pizarra: Excalidraw en español con el tema de la app, dentro del panel sin
 * tapar la barra de módulos, y una barra propia con «‹ Pizarras», el nombre editable y el estado.
 *
 * Guardado automático: cada cambio de la escena (o del fondo o la cuadrícula) se guarda 1 s
 * después del último, con el zoom y el desplazamiento de ese momento, de a uno por vez; `files`
 * solo viaja cuando cambia el conjunto de imágenes y la miniatura solo cuando cambian los
 * elementos. Mover o acercar el lienzo no cuenta como edición. Al salir se
 * manda lo pendiente (`saveQueue` hace esperar a la lista) y al cerrar la pestaña, con `keepalive`.
 */
export default function WhiteboardEditor({ id, onClose }) {
  const { theme } = useTheme();
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('saved');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  const pending = useRef(null);
  const baseline = useRef(null);
  const timer = useRef(null);
  const inFlight = useRef(null);
  const sentFiles = useRef('');
  const thumbVersion = useRef(null);
  const savedName = useRef('');
  const nameTimer = useRef(null);
  const mounted = useRef(true);
  const apiRef = useRef(null);
  const flushRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    boardsApi
      .fetchBoard(id)
      .then((b) => {
        if (cancelled) return;
        sentFiles.current = filesKey(b.files);
        savedName.current = b.name;
        setName(b.name);
        setBoard(b);
      })
      .catch((e) => !cancelled && setLoadError(apiError(e)));
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [id]);

  const setUi = useCallback((fn) => {
    if (mounted.current) fn();
  }, []);

  /** Manda lo pendiente (si hay) y devuelve la promesa del guardado. */
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (inFlight.current) return inFlight.current.then(() => (pending.current ? flushRef.current() : undefined));
    const snap = pending.current;
    if (!snap) return Promise.resolve();
    pending.current = null;
    const run = (async () => {
      const { elements, files, dropped } = sanitizeScene(snap.elements, snap.files);
      const body = { elements, app_state: pickAppState(snap.appState) };
      const key = filesKey(files);
      if (key !== sentFiles.current) body.files = files;
      if (snap.version !== thumbVersion.current) {
        const thumb = await makeThumbnail(elements, files, snap.appState);
        if (thumb !== undefined) body.thumbnail = thumb;
      }
      try {
        await boardsApi.updateBoard(id, body);
        sentFiles.current = key;
        if ('thumbnail' in body) thumbVersion.current = snap.version;
        setUi(() => {
          setNotice(dropped ? 'Las imágenes SVG y las páginas incrustadas no se guardan.' : '');
          if (!pending.current) setStatus('saved');
        });
      } catch (e) {
        const err = apiError(e);
        if (!pending.current) pending.current = snap;
        setUi(() => {
          setStatus('error');
          setErrorMessage(err.status === 0 ? 'Sin conexión: se reintentará' : err.message);
        });
        // Sin red se reintenta; un tope o un dato rechazado esperan al próximo cambio.
        if (err.status === 0 && mounted.current) timer.current = setTimeout(() => flushRef.current(), RETRY_MS);
      }
    })();
    inFlight.current = run.finally(() => {
      inFlight.current = null;
    });
    return track(inFlight.current);
  }, [id, setUi]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const onChange = useCallback(
    (elements, appState, files) => {
      const version = getSceneVersion(elements);
      // El zoom y el desplazamiento solos no cuentan como edición (no se guardan ni mueven la
      // fecha); viajan con el próximo guardado.
      const { zoom: _zoom, scrollX: _x, scrollY: _y, ...look } = pickAppState(appState);
      const key = `${version}:${JSON.stringify(look)}:${Object.keys(files).length}`;
      if (baseline.current === null) {
        // El primer aviso es la escena tal como llegó del servidor.
        baseline.current = key;
        thumbVersion.current = version;
        if (apiRef.current) {
          ensureFonts(apiRef.current);
          // El zoom y el desplazamiento guardados pueden venir de otra pantalla (PC → celular): si
          // no queda nada a la vista, se centra el dibujo.
          const alive = elements.filter((el) => !el.isDeleted);
          if (alive.length && !elementsOverlappingBBox({ elements: alive, bounds: getVisibleSceneBounds(appState), type: 'overlap' }).length) {
            apiRef.current.scrollToContent(alive, { fitToContent: true, animate: false });
          }
        }
        return;
      }
      if (key === baseline.current) return;
      baseline.current = key;
      pending.current = { elements, appState, files, version };
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(), SAVE_MS);
    },
    [flush],
  );

  const saveName = useCallback(
    (value) => {
      clearTimeout(nameTimer.current);
      const clean = cleanName(value);
      if (!clean || clean === savedName.current) return Promise.resolve();
      savedName.current = clean;
      setStatus('saving');
      return track(
        boardsApi
          .updateBoard(id, { name: clean })
          .then(() => setUi(() => !pending.current && !inFlight.current && setStatus('saved')))
          .catch((e) =>
            setUi(() => {
              setStatus('error');
              setErrorMessage(apiError(e).message);
            }),
          ),
      );
    },
    [id, setUi],
  );

  // Al salir (otra pantalla del panel o «‹ Pizarras»): lo pendiente se manda igual.
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(
    () => () => {
      saveName(nameRef.current);
      if (pending.current || inFlight.current) flush();
    },
    [flush, saveName],
  );

  // Al cerrar la pestaña o recargar: `keepalive`, sin miniatura (no hay tiempo de generarla).
  useEffect(() => {
    const onHide = () => {
      const snap = pending.current;
      if (!snap) return;
      pending.current = null;
      clearTimeout(timer.current);
      const { elements, files } = sanitizeScene(snap.elements, snap.files);
      const body = { elements, app_state: pickAppState(snap.appState) };
      if (filesKey(files) !== sentFiles.current) body.files = files;
      boardsApi.updateBoardOnExit(id, body);
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [id]);

  const back = async () => {
    await Promise.all([saveName(name), flush()]);
    onClose();
  };

  if (loadError) {
    return (
      <div className="wb-editor-frame flex flex-col items-center justify-center gap-3 p-6 text-center" data-testid="wb-load-error">
        <p className="text-sm text-text-muted">
          {loadError.code === 'WHITEBOARD_NOT_FOUND' ? 'Esta pizarra no existe o fue eliminada.' : loadError.message}
        </p>
        <button type="button" onClick={onClose} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          Volver a mis pizarras
        </button>
      </div>
    );
  }

  return (
    <div className="wb-editor-frame flex flex-col gap-2" data-testid="wb-editor">
      <div className="glass-panel flex h-11 flex-none items-center gap-1 rounded-full py-1 pl-1 pr-3">
        <button
          type="button"
          onClick={back}
          data-testid="wb-back"
          className="flex h-9 flex-none items-center gap-0.5 rounded-full pl-1.5 pr-3 text-sm font-medium text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          Pizarras
        </button>
        <span className="h-5 w-px flex-none bg-border" aria-hidden="true" />
        <input
          value={name}
          maxLength={80}
          disabled={!board}
          aria-label="Nombre de la pizarra"
          data-testid="wb-name"
          onChange={(e) => {
            const value = e.target.value;
            setName(value);
            clearTimeout(nameTimer.current);
            nameTimer.current = setTimeout(() => saveName(value), NAME_MS);
          }}
          onBlur={() => {
            if (!cleanName(name)) setName(savedName.current);
            else saveName(name);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="h-9 min-w-0 flex-1 truncate rounded-full bg-transparent px-2.5 text-[15px] font-semibold text-text placeholder:text-text-faint hover:bg-surface-2 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {notice ? (
          <span className="hidden max-w-[16rem] truncate text-xs text-text-muted lg:block" title={notice}>
            {notice}
          </span>
        ) : null}
        <SaveStatus status={status} message={errorMessage} />
      </div>

      <div className="wb-canvas relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border" data-testid="wb-canvas">
        {board ? (
          <Excalidraw
            initialData={{
              elements: board.elements,
              appState: initialAppState(board.app_state),
              files: board.files,
              scrollToContent: board.app_state.scrollX === undefined && board.elements.length > 0,
            }}
            onChange={onChange}
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            theme={theme}
            langCode="es-ES"
            name={name}
            UIOptions={UI_OPTIONS}
            validateEmbeddable={false}
            aiEnabled={false}
            autoFocus
          >
            <MainMenu>
              <MainMenu.DefaultItems.LoadScene />
              <MainMenu.DefaultItems.Export />
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.Help />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
          </Excalidraw>
        ) : (
          <div className="flex h-full items-center justify-center" role="status" aria-label="Cargando la pizarra">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        )}
      </div>
    </div>
  );
}
