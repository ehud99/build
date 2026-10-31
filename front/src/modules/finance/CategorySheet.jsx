import { Check } from 'lucide-react';
import { createElement, useState } from 'react';

import { apiError } from '@/lib/api.js';
import * as financeApi from './api.js';
import { CategoryIcon } from './CategoryIcon.jsx';
import { iconFor } from './icons.js';
import { COLOR_KEYS, COLOR_NAMES, ICON_KEYS, KIND_LABELS, colorVar } from './palette.js';
import { Sheet } from './Sheet.jsx';

/**
 * «Crear nueva categoría» o editarla: nombre, Gastos ○ Ingresos, la grilla de «Símbolos» y los
 * colores. Al editar: archivar o desarchivar y borrar (si tiene movimientos, ofrece archivarla).
 */
export function CategorySheet({ category, defaultKind = 'expense', lockKind = false, onClose, onSaved, onDeleted, level = 0 }) {
  const editing = Boolean(category);
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState(category?.kind ?? defaultKind);
  const [icon, setIcon] = useState(category?.icon ?? 'cart');
  const [color, setColor] = useState(category?.color ?? 'blue');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const save = (e) => {
    e?.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError({ message: 'Escribe un nombre.' });
      return;
    }
    run(async () => {
      const body = { name: clean, kind, icon, color };
      const saved = editing
        ? await financeApi.updateCategory(category.id, body)
        : await financeApi.createCategory(body);
      onSaved?.(saved);
    });
  };

  const setArchived = (archived) =>
    run(async () => onSaved?.(await financeApi.updateCategory(category.id, { archived })));

  const remove = () =>
    run(async () => {
      if (!window.confirm(`¿Borrar la categoría «${category.name}»?`)) return;
      try {
        await financeApi.deleteCategory(category.id);
        onDeleted?.(category);
      } catch (e) {
        const err = apiError(e);
        if (err.code !== 'CATEGORY_IN_USE') throw e;
        const n = err.detail?.count ?? 0;
        const label = n === 1 ? '1 movimiento' : `${n} movimientos`;
        if (window.confirm(`Tiene ${label}: no se puede borrar. ¿Archivarla? Dejará de salir al agregar, pero sus movimientos se quedan.`)) {
          onSaved?.(await financeApi.updateCategory(category.id, { archived: true }));
        }
      }
    });

  const footer = (
    <div className="flex flex-wrap items-center gap-2">
      {editing ? (
        <>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-full px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2 disabled:opacity-50"
            data-testid="fin-cat-delete"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={() => setArchived(!category.archived)}
            disabled={busy}
            className="rounded-full px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
            data-testid="fin-cat-archive"
          >
            {category.archived ? 'Desarchivar' : 'Archivar'}
          </button>
        </>
      ) : null}
      <button
        type="submit"
        form="fin-cat-form"
        disabled={busy}
        className="ml-auto min-h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-50"
        data-testid="fin-cat-save"
      >
        {editing ? 'Guardar' : 'Crear categoría'}
      </button>
    </div>
  );

  return (
    <Sheet
      title={editing ? 'Editar categoría' : 'Crear nueva categoría'}
      onClose={onClose}
      footer={footer}
      level={level}
      testId="fin-category-sheet"
    >
      <form id="fin-cat-form" onSubmit={save} className="space-y-5">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <label className="min-w-0 flex-1">
            <span className="sr-only">Nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Nombre de la categoría"
              data-autofocus=""
              data-testid="fin-cat-name"
              className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-base outline-none placeholder:text-text-faint focus:border-accent"
            />
          </label>
        </div>

        <fieldset className="flex gap-2" disabled={lockKind}>
          <legend className="sr-only">Tipo</legend>
          {['expense', 'income'].map((k) => (
            <label
              key={k}
              className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors ${
                kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-border text-text-muted hover:bg-surface-2'
              } ${lockKind && kind !== k ? 'opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="fin-kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
                data-testid={`fin-cat-kind-${k}`}
              />
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${kind === k ? 'border-accent' : 'border-border-strong'}`}
                aria-hidden="true"
              >
                {kind === k ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
              </span>
              {KIND_LABELS[k]}
            </label>
          ))}
        </fieldset>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Símbolos</h3>
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Símbolos">
            {ICON_KEYS.map((key) => {
              const selected = key === icon;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={key}
                  onClick={() => setIcon(key)}
                  data-testid={`fin-icon-${key}`}
                  className={`flex aspect-square items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    selected ? '' : 'bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text'
                  }`}
                  style={selected ? { background: colorVar(color), color: 'var(--fin-on)' } : undefined}
                >
                  {createElement(iconFor(key), { className: 'h-5 w-5', 'aria-hidden': true })}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Color</h3>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Color">
            {COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === color}
                aria-label={COLOR_NAMES[key]}
                title={COLOR_NAMES[key]}
                onClick={() => setColor(key)}
                data-testid={`fin-color-${key}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-shadow focus-visible:outline-2 focus-visible:outline-accent ${
                  key === color ? 'ring-2 ring-text' : ''
                }`}
                style={{ background: colorVar(key), color: 'var(--fin-on)' }}
              >
                {key === color ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <p className="text-sm text-danger" role="alert" data-testid="fin-cat-error">
            {error.message}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

export default CategorySheet;
