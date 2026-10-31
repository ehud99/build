import { donutSegments } from './donut.js';
import { colorVar } from './palette.js';

import './money.css';

const R = 42;
const STROKE = 13;

/**
 * La dona del periodo: un arco por categoría con su color (fracciones `share` del servidor) y,
 * en el hueco, el total. Sin datos, un anillo gris y el aviso.
 */
export function Donut({ items, total, emptyLabel, caption }) {
  const segments = donutSegments(items);
  const empty = segments.length === 0;
  return (
    <figure className="relative mx-auto aspect-square w-full max-w-[15rem] md:max-w-[17rem]" data-testid="fin-donut">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={empty ? emptyLabel : `${caption}: ${total}`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--fin-ring)" strokeWidth={STROKE} />
        {segments.map((s) =>
          s.length > 0 ? (
            <circle
              key={items[s.index].category.id}
              className="fin-donut-seg"
              cx="50"
              cy="50"
              r={R}
              fill="none"
              pathLength="100"
              stroke={colorVar(items[s.index].category.color)}
              strokeWidth={STROKE}
              strokeDasharray={`${s.length} ${100 - s.length}`}
              strokeDashoffset={-s.start}
              data-testid="fin-donut-seg"
            />
          ) : null,
        )}
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        {empty ? (
          <span className="text-sm text-text-muted" data-testid="fin-empty">
            {emptyLabel}
          </span>
        ) : (
          <>
            <span className="text-xs uppercase tracking-wide text-text-muted">{caption}</span>
            <span className="mt-0.5 max-w-full break-words text-xl font-semibold leading-tight tabular-nums md:text-2xl" data-testid="fin-total">
              {total}
            </span>
          </>
        )}
      </figcaption>
    </figure>
  );
}

export default Donut;
