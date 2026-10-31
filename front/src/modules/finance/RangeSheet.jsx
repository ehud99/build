import { useState } from 'react';

import { isDay } from './dates.js';
import { Sheet } from './Sheet.jsx';

/** «Período»: un rango propio con dos fechas. */
export function RangeSheet({ from, to, onClose, onApply }) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const valid = isDay(start) && isDay(end) && start <= end;

  const input =
    'min-h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent';
  return (
    <Sheet
      title="Elegir período"
      onClose={onClose}
      testId="fin-range-sheet"
      footer={
        <button
          type="button"
          disabled={!valid}
          onClick={() => onApply(start, end)}
          className="min-h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg disabled:opacity-50"
          data-testid="fin-range-apply"
        >
          Aplicar
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Desde</span>
          <input type="date" value={start} min="2000-01-01" max="2100-12-31" onChange={(e) => setStart(e.target.value)} className={input} data-testid="fin-range-from" />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">Hasta</span>
          <input type="date" value={end} min="2000-01-01" max="2100-12-31" onChange={(e) => setEnd(e.target.value)} className={input} data-testid="fin-range-to" />
        </label>
      </div>
      {isDay(start) && isDay(end) && start > end ? (
        <p className="mt-3 text-sm text-danger">La fecha de inicio va antes de la final.</p>
      ) : null}
    </Sheet>
  );
}

export default RangeSheet;
