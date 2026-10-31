import './charts.css';

const R = 42;
const STROKE = 10;

/**
 * Anillo de un solo valor contra su tope (un medidor): el arco lleno es `done / total` y la pista
 * es un paso más claro del mismo tono. En el centro, `children` (el % grande).
 */
export function Ring({ done, total, label, children, color = 'var(--chart-goal)', className = '' }) {
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const length = share * 100;
  return (
    <figure className={`relative aspect-square shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={label}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--chart-track)" strokeWidth={STROKE} />
        {length > 0 ? (
          <circle
            className="chart-ring-fill"
            cx="50"
            cy="50"
            r={R}
            fill="none"
            pathLength="100"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap={length < 100 ? 'round' : 'butt'}
            strokeDasharray={`${length} ${100 - length}`}
          />
        ) : null}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</figcaption>
    </figure>
  );
}

export default Ring;
