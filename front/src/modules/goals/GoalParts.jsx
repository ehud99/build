import { Flame } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { goalPlaceholder } from './placeholders.js';
import { streakLevel } from './score.js';

/** Piezas comunes de la hoja del mes y de la vista de hoy. */

/** Título de un objetivo: se edita en el sitio y guarda al salir si cambió. */
export function GoalTitleInput({ goal, disabled, onCommit, testId }) {
  const [value, setValue] = useState(goal.title);

  const commit = () => {
    const next = value.trim();
    if (!next || next === goal.title) {
      setValue(goal.title);
      return;
    }
    onCommit(goal, next);
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(goal.title);
          e.currentTarget.blur();
        }
      }}
      readOnly={disabled}
      maxLength={80}
      size={1}
      title={value}
      aria-label={`Título del objetivo ${goal.position + 1}`}
      data-testid={testId ?? `goal-title-${goal.id}`}
      className="min-w-0 flex-1 truncate rounded bg-transparent px-1 py-0.5 text-sm text-text outline-none focus:bg-surface-2 focus:ring-1 focus:ring-accent read-only:cursor-default"
    />
  );
}

/**
 * Fila para escribir un objetivo nuevo: Enter guarda, Escape cancela. El placeholder recomienda
 * un objetivo según cuántos hay (`count`, `placeholders.js`); se elige una vez al abrirse.
 */
export function AddGoalInput({ count, onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [placeholder] = useState(() => goalPlaceholder(count));
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex w-full max-w-sm flex-col gap-1">
    <input
      ref={ref}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const t = title.trim();
          if (t) onSubmit(t);
        } else if (e.key === 'Escape') onCancel();
      }}
      maxLength={80}
      placeholder={placeholder}
      aria-label="Nuevo objetivo"
      data-testid="goal-add-input"
      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
    />
    <p className="px-1 text-left text-xs text-text-faint">Enter para guardar · Esc para cancelar</p>
    </div>
  );
}

/** Contador de la racha junto al título: la llama y los días seguidos. */
export function StreakBadge({ goal, days, onFire }) {
  if (days < 2 && !onFire) return null;
  const label = onFire ? `¡Mes completo! Racha de ${days} días` : `Racha de ${days} días`;
  return (
    <span
      className="streak-badge inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums"
      data-level={streakLevel(days)}
      title={label}
      aria-label={label}
      data-testid={`goal-streak-${goal.id}`}
    >
      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
      {days}
    </span>
  );
}
