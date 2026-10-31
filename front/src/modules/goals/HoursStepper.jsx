import { Minus, Plus } from 'lucide-react';

import { MAX_HALVES, fromHalves, toHalves } from './hours.js';

/**
 * Horas trabajadas de hoy con − y + de a media hora (0 a 24). Controlado: `value` es el texto del
 * servidor (`'8.5'`) y `onChange(texto)` el nuevo. `size` 'md' (bajo la tabla) o 'lg' (vista de hoy).
 */
export function HoursStepper({ value, onChange, disabled = false, size = 'md', label = 'Horas trabajadas hoy' }) {
  const halves = toHalves(value);
  const big = size === 'lg';
  const button = `flex ${big ? 'h-11 w-11' : 'h-8 w-8'} items-center justify-center rounded-full bg-surface-2 text-text transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40`;
  const shown = fromHalves(halves).replace('.', ',');

  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(fromHalves(halves - 1))}
        disabled={disabled || halves <= 0}
        aria-label="Media hora menos"
        data-testid="hours-minus"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <output
        className={`${big ? 'min-w-16 text-2xl' : 'min-w-12 text-base'} text-center font-semibold tabular-nums`}
        aria-live="polite"
        data-testid="hours-today"
      >
        {shown} h
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(fromHalves(halves + 1))}
        disabled={disabled || halves >= MAX_HALVES}
        aria-label="Media hora más"
        data-testid="hours-plus"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default HoursStepper;
