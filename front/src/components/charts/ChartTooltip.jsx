import './charts.css';

/**
 * El globo de un gráfico: el valor primero (fuerte) y la etiqueta después (secundaria), con una
 * rayita del color de la serie. Se coloca sobre el punto `x`, `y` del contenedor (relativo), sin
 * salirse de sus bordes. Con `below`, va debajo del punto (para no cortarse arriba).
 */
export function ChartTooltip({ x, y, width, value, label, color, testId, below = false }) {
  const left = Math.max(56, Math.min(width - 56, x));
  return (
    <div className="chart-tooltip" style={{ left, top: y, transform: below ? 'translate(-50%, 6px)' : undefined }} role="status" data-testid={testId}>
      <div className="flex items-center gap-1.5">
        {color ? <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} /> : null}
        <span className="font-semibold text-text tabular-nums">{value}</span>
      </div>
      <div className="mt-0.5 text-text-muted">{label}</div>
    </div>
  );
}

export default ChartTooltip;
