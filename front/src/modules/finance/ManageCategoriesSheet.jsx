import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';

import { CategoryIcon } from './CategoryIcon.jsx';
import { KIND_LABELS } from './palette.js';
import { Sheet } from './Sheet.jsx';

/** Todas las categorías de un tipo (también las archivadas) para editarlas o crear una. */
export function ManageCategoriesSheet({ categories, initialKind, onClose, onEdit, onCreate }) {
  const [kind, setKind] = useState(initialKind);
  const list = categories.filter((c) => c.kind === kind);
  return (
    <Sheet title="Categorías" onClose={onClose} testId="fin-manage-sheet">
      <div className="mb-3 flex gap-1 rounded-full bg-surface-2 p-1" role="tablist">
        {['expense', 'income'].map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-9 flex-1 rounded-full text-sm font-medium ${kind === k ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onEdit(c)}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2"
              data-testid="fin-manage-row"
              data-name={c.name}
            >
              <CategoryIcon icon={c.icon} color={c.color} size="md" className={c.archived ? 'opacity-50' : ''} />
              <span className={`min-w-0 flex-1 truncate ${c.archived ? 'text-text-muted' : ''}`}>{c.name}</span>
              {c.archived ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">Archivada</span> : null}
              <ChevronRight className="h-4 w-4 text-text-faint" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onCreate(kind)}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-border-strong text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text"
        data-testid="fin-manage-new"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Crear categoría
      </button>
    </Sheet>
  );
}

export default ManageCategoriesSheet;
