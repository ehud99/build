import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { apiError } from '@/lib/api.js';
import * as financeApi from './api.js';
import { CategoryIcon } from './CategoryIcon.jsx';
import { shortDate } from './dates.js';
import { formatMoney } from './money.js';
import { Sheet } from './Sheet.jsx';

/**
 * Los movimientos de una categoría en el periodo, con editar y borrar. `version` cambia cuando la
 * pantalla guardó algo, para volver a pedirlos.
 */
export function CategoryDetailSheet({ item, range, periodText, currency, today, version, onClose, onEdit, onEditCategory, onChanged }) {
  const { category } = item;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    () =>
      financeApi
        .fetchTransactions({ from: range.from, to: range.to, category_id: category.id })
        .then(setData, (e) => setError(apiError(e).message)),
    [range.from, range.to, category.id],
  );

  useEffect(() => {
    load();
  }, [load, version]);

  const remove = async (t) => {
    if (!window.confirm('¿Borrar este movimiento?')) return;
    try {
      await financeApi.deleteTransaction(t.id);
      onChanged?.();
    } catch (e) {
      setError(apiError(e).message);
    }
  };

  const items = data?.items ?? [];
  return (
    <Sheet title={category.name} onClose={onClose} testId="fin-detail-sheet">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <CategoryIcon icon={category.icon} color={category.color} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-muted">{periodText}</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="fin-detail-total">
            {formatMoney(data?.total ?? item.total, currency)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEditCategory?.(category)}
          className="rounded-full px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
          data-testid="fin-detail-edit-category"
        >
          Editar categoría
        </button>
      </div>
      {error ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {data && items.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">Sin movimientos en este periodo.</p> : null}
      <ul className="divide-y divide-border" data-testid="fin-detail-list">
        {items.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5" data-testid="fin-detail-row">
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm ${t.note ? 'text-text' : 'text-text-faint'}`}>{t.note || 'Sin nota'}</p>
              <p className="text-xs text-text-muted">{shortDate(t.occurred_on, today)}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums" data-testid="fin-detail-amount">
              {formatMoney(t.amount, currency)}
            </span>
            <button
              type="button"
              onClick={() => onEdit?.(t)}
              aria-label="Editar movimiento"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
              data-testid="fin-detail-edit"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label="Borrar movimiento"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-danger"
              data-testid="fin-detail-delete"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export default CategoryDetailSheet;
