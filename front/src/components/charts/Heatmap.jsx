import { useEffect, useMemo, useRef, useState } from 'react';


import './charts.css';

import { ChartTooltip } from './ChartTooltip.jsx';
import { useWidth } from './useWidth.js';
import { HEAT_LEGEND, heatDateLabel, heatLevel, heatValue, moveCell, yearGrid } from './heatmap.js';

const GAP = 3;
const MIN_CELL = 11;
const MAX_CELL = 16;
const LEFT = 26;
const TOP = 18;
const ROW_LABELS = { 0: 'lun', 2: 'mié', 4: 'vie' };

const fill = (cell) => (cell.data ? `var(--heat-${heatLevel(cell.data.done, cell.data.goals)})` : 'var(--heat-none)');

/**
 * Mapa de calor del año tipo GitHub: semanas en columnas (de lunes a domingo), un cuadrito por
 * día con la intensidad del % de objetivos cumplidos (`heatLevel`), los meses arriba y la leyenda
 * abajo. La caja se desplaza a lo ancho si no cabe y abre mostrando `focusMonth` (`'2026-11'`).
 * Con el teclado: ←/→ una semana, ↑/↓ un día.
 */
export function Heatmap({ year, days, today, focusMonth, testId }) {
  const grid = useMemo(() => yearGrid(year, days), [year, days]);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const [frame, frameWidth] = useWidth();
  // Cuadros de 11 a 16 px: llenan el ancho en PC; en el celular la caja se desplaza.
  const CELL = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((frameWidth - LEFT) / grid.weeks) - GAP));
  const STEP = CELL + GAP;
  const width = grid.weeks * STEP;
  const height = TOP + 7 * STEP;
  const current = grid.cells[active];

  useEffect(() => {
    const el = box.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const target = grid.cells.find((c) => c.date.startsWith(focusMonth ?? '')) ?? grid.cells[0];
    el.scrollLeft = Math.max(0, (target.col + 5) * STEP - el.clientWidth / 2);
  }, [grid, focusMonth, STEP]);

  const onKey = (e) => {
    const start = active < 0 ? Math.max(0, grid.cells.findIndex((c) => c.date === today)) : active;
    const next = active < 0 && e.key.startsWith('Arrow') ? start : moveCell(active, e.key, grid.cells.length);
    if (next !== active) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === 'Escape') setActive(-1);
  };

  const withData = days.length;
  const summary = withData
    ? `Mapa de calor ${year}: ${withData} días con objetivos.`
    : `Mapa de calor ${year}: sin días con objetivos.`;

  return (
    <div ref={frame} data-testid={testId}>
      <div className="flex">
      {/* Los días de la semana quedan fijos a la izquierda mientras la caja se desplaza. */}
      <svg width={LEFT} height={height} aria-hidden="true" className="shrink-0">
        {Object.entries(ROW_LABELS).map(([row, label]) => (
          <text key={row} x={0} y={TOP + Number(row) * STEP + CELL - 2} className="fill-text-muted text-[10px]">
            {label}
          </text>
        ))}
      </svg>
      <div ref={box} className="relative min-w-0 flex-1 overflow-x-auto pb-1">
        <div className="relative" style={{ width }}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={current ? `${heatDateLabel(current.date)}: ${heatValue(current)}` : summary}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setActive(-1)}
            onPointerLeave={() => setActive(-1)}
            className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {grid.months.map((m) => (
              <text key={m.label} x={m.col * STEP} y={10} className="fill-text-muted text-[10px]">
                {m.label}
              </text>
            ))}
            {grid.cells.map((cell, i) => (
              <rect
                key={cell.date}
                x={cell.col * STEP}
                y={TOP + cell.row * STEP}
                width={CELL}
                height={CELL}
                rx={2.5}
                fill={fill(cell)}
                stroke={i === active ? 'var(--text)' : cell.date === today ? 'var(--text-muted)' : 'none'}
                strokeWidth={i === active || cell.date === today ? 1.5 : 0}
                data-date={cell.date}
                data-level={cell.data ? heatLevel(cell.data.done, cell.data.goals) : undefined}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
            ))}
          </svg>
          {current ? (
            <ChartTooltip
              x={current.col * STEP + CELL / 2}
              y={current.row < 3 ? TOP + (current.row + 1) * STEP : TOP + current.row * STEP}
              below={current.row < 3}
              width={width}
              value={heatValue(current)}
              label={heatDateLabel(current.date)}
              testId={testId ? `${testId}-tooltip` : undefined}
            />
          ) : null}
        </div>
      </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted" aria-label="Leyenda">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-[11px] w-[11px] rounded-[3px]" style={{ background: 'var(--heat-none)', boxShadow: 'inset 0 0 0 1px var(--border)' }} />
          Sin objetivos
        </span>
        <span className="inline-flex items-center gap-1">
          <span>Menos</span>
          {HEAT_LEGEND.map((l) => (
            <span
              key={l.level}
              title={l.label}
              aria-label={l.label}
              role="img"
              className="h-[11px] w-[11px] rounded-[3px]"
              style={{ background: `var(--heat-${l.level})` }}
            />
          ))}
          <span>Más</span>
        </span>
      </div>
    </div>
  );
}

export default Heatmap;
