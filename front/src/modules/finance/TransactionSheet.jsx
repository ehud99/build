import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { apiError } from '@/lib/api.js';
import * as financeApi from './api.js';
import { CategoryIcon } from './CategoryIcon.jsx';
import { CategorySheet } from './CategorySheet.jsx';
import { isDay } from './dates.js';
import { amountToInput, currencySymbol, normalizeAmount, sanitizeAmountTyping } from './money.js';
import { colorVar } from './palette.js';
import { Sheet } from './Sheet.jsx';

const TITLES = {
  expense: ['Nuevo gasto', 'Editar gasto'],
  income: ['Nuevo ingreso', 'Editar ingreso'],
};

/**
 * «Nuevo gasto» / «Nuevo ingreso» (o editar uno): el monto grande con la moneda (teclado numérico
 * en el celular, coma o punto), la grilla de categorías con «+ Crear», la fecha (hoy) y la nota.
 */
export function TransactionSheet({
  kind,
  transaction,
  categories,
  currency,
  today,
  onClose,
  onSaved,
  onDeleted,
  onCategoryCreated,
}) {
  const editing = Boolean(transaction);
  const [amount, setAmount] = useState(editing ? amountToInput(transaction.amount) : '');
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? null);
  const [day, setDay] = useState(transaction?.occurred_on ?? today);
  const [note, setNote] = useState(transaction?.note ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  // Las activas de este tipo; al editar, también la archivada del movimiento.
  const options = useMemo(
    () => categories.filter((c) => c.kind === kind && (!c.archived || c.id === transaction?.category_id)),
    [categories, kind, transaction],
  );

  const save = async (e) => {
    e?.preventDefault();
    const value = normalizeAmount(amount);
    if (!value) return setError('Escribe un monto mayor que 0.');
    if (!categoryId) return setError('Elige una categoría.');
    if (!isDay(day)) return setError('Elige una fecha.');
    setBusy(true);
    setError(null);
    try {
      const body = { category_id: categoryId, amount: value, occurred_on: day, note: note.trim() };
      const saved = editing
        ? await financeApi.updateTransaction(transaction.id, body)
        : await financeApi.createTransaction({ kind, ...body });
      onSaved?.(saved);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('¿Borrar este movimiento?')) return;
    setBusy(true);
    try {
      await financeApi.deleteTransaction(transaction.id);
      onDeleted?.(transaction);
    } catch (err) {
      setError(apiError(err).message);
      setBusy(false);
    }
  };

  const footer = (
    <div className="flex items-center gap-2">
      {editing ? (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-full px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2 disabled:opacity-50"
          data-testid="fin-tx-delete"
        >
          Borrar
        </button>
      ) : null}
      <button
        type="submit"
        form="fin-tx-form"
        disabled={busy}
        className="ml-auto min-h-11 flex-1 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-50 md:flex-none"
        data-testid="fin-tx-save"
      >
        Guardar
      </button>
    </div>
  );

  return (
    <>
      <Sheet title={TITLES[kind][editing ? 1 : 0]} onClose={onClose} footer={footer} testId="fin-tx-sheet">
        <form id="fin-tx-form" onSubmit={save} className="space-y-5">
          <label className="flex items-baseline justify-center gap-2 rounded-3xl bg-surface-2 px-4 py-5">
            <span className="sr-only">Monto</span>
            <input
              value={amount}
              onChange={(e) => setAmount(sanitizeAmountTyping(e.target.value))}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              data-autofocus=""
              data-testid="fin-tx-amount"
              className="w-0 min-w-0 flex-1 bg-transparent text-right text-4xl font-semibold tabular-nums outline-none placeholder:text-text-faint"
              style={{ color: kind === 'income' ? 'var(--fin-income)' : undefined }}
            />
            <span className="flex-1 text-2xl font-medium text-text-muted">{currencySymbol(currency)}</span>
          </label>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Categorías</h3>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5" role="radiogroup" aria-label="Categoría">
              {options.map((c) => {
                const selected = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCategoryId(c.id)}
                    data-testid="fin-tx-category"
                    data-name={c.name}
                    className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span
                      className="rounded-full p-0.5 transition-shadow"
                      style={{ boxShadow: selected ? `0 0 0 2px var(--surface), 0 0 0 4px ${colorVar(c.color)}` : 'none' }}
                    >
                      <CategoryIcon icon={c.icon} color={c.color} size="lg" className={selected ? '' : 'opacity-85'} />
                    </span>
                    <span className={`w-full truncate text-center text-xs ${selected ? 'font-semibold text-text' : 'text-text-muted'}`}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCreating(true)}
                data-testid="fin-tx-new-category"
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl p-1 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="p-0.5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-text-muted">
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </span>
                </span>
                <span className="w-full truncate text-center text-xs text-text-muted">Crear</span>
              </button>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Fecha</span>
              <input
                type="date"
                value={day}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(e) => setDay(e.target.value)}
                data-testid="fin-tx-date"
                className="min-h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Nota</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="Opcional"
                data-testid="fin-tx-note"
                className="min-h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-base outline-none placeholder:text-text-faint focus:border-accent"
              />
            </label>
          </div>

          {error ? (
            <p className="text-sm text-danger" role="alert" data-testid="fin-tx-error">
              {error}
            </p>
          ) : null}
        </form>
      </Sheet>
      {creating ? (
        <CategorySheet
          defaultKind={kind}
          lockKind
          level={1}
          onClose={() => setCreating(false)}
          onSaved={(c) => {
            setCreating(false);
            onCategoryCreated?.(c);
            setCategoryId(c.id);
          }}
        />
      ) : null}
    </>
  );
}

export default TransactionSheet;
