import { useState } from 'react';

import './charts.css';

import { ChartTooltip } from './ChartTooltip.jsx';
import { bandLayout, columnPath, niceMax, stepIndex, ticks } from './scale.js';
import { useWidth } from './useWidth.js';

const LEFT = 30;
const TOP = 10;
const AXIS = 22;

/**
 * Columnas de una sola serie (SVG a mano): barras de hasta 24 px con el extremo redondeado,
 * cuadradas en la base, líneas de guía finas y el eje Y a la izquierda.
 *
 * - `items`: `[{key, label, value, valueLabel, muted?, strong?}]`. `value` es solo geometría;
 *   `valueLabel` es lo que se lee (texto del servidor). `muted`: aún no pasó (sin barra).
 *   `strong`: la etiqueta del eje va resaltada (hoy).
 * - `axisLabel(item, i)`: la etiqueta del eje X o `null` para no poner ninguna.
 * - `max`: el tope del eje (si no, uno redondo sobre el máximo); `tickLabel(v)` formatea el eje Y
 *   e `integerTicks` deja solo marcas enteras (objetivos, no medios).
 *
 * Interacción: cada franja es la zona del globo (más ancha que la barra); con el teclado, el
 * gráfico se enfoca y las flechas recorren las barras.
 */
export function ColumnChart({
  items,
  color = 'var(--chart-goal)',
  height = 168,
  max,
  tickLabel = (v) => String(v).replace('.', ','),
  axisLabel = (item) => item.label,
  integerTicks = false,
  ariaLabel,
  testId,
}) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(-1);
  const top = max ?? niceMax(Math.max(0, ...items.map((i) => i.value)));
  const plotW = Math.max(40, width - LEFT);
  const plotH = height - TOP - AXIS;
  const base = TOP + plotH;
  const band = bandLayout(items.length, plotW);
  const y = (v) => (top > 0 ? (v / top) * plotH : 0);
  const current = items[active];

  const onKey = (e) => {
    const next = stepIndex(active, e.key, items.length);
    if (next !== active) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === 'Escape') setActive(-1);
  };

  return (
    <div ref={ref} className="relative w-full" data-testid={testId}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(-1)}
        onPointerLeave={() => setActive(-1)}
        className={`block overflow-visible rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${active >= 0 ? 'chart-dim' : ''}`}
      >
        {ticks(top, 4, { integer: integerTicks }).map((t) => (
          <g key={t}>
            <line
              x1={LEFT}
              x2={width}
              y1={base - y(t)}
              y2={base - y(t)}
              stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
            <text x={LEFT - 6} y={base - y(t)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[10px] tabular-nums">
              {tickLabel(t)}
            </text>
          </g>
        ))}
        {items.map((item, i) => {
          const x = LEFT + band.x(i);
          const label = axisLabel(item, i);
          return (
            <g key={item.key}>
              {item.muted ? null : (
                <path
                  className="chart-mark"
                  data-active={i === active || undefined}
                  d={columnPath(x, base, band.bar, y(item.value))}
                  fill={color}
                />
              )}
              {label != null ? (
                <text
                  x={x + band.bar / 2}
                  y={base + 14}
                  textAnchor="middle"
                  className={`text-[10px] tabular-nums ${item.strong ? 'fill-text font-semibold' : 'fill-text-muted'}`}
                >
                  {label}
                </text>
              ) : null}
              <rect
                x={LEFT + i * band.slot}
                y={TOP}
                width={band.slot}
                height={plotH + AXIS}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
            </g>
          );
        })}
      </svg>
      {current ? (
        <ChartTooltip
          x={LEFT + band.x(active) + band.bar / 2}
          y={base - (current.muted ? 0 : y(current.value))}
          width={width}
          value={current.valueLabel}
          label={current.label}
          color={current.muted ? null : color}
          testId={testId ? `${testId}-tooltip` : undefined}
        />
      ) : null}
    </div>
  );
}

export default ColumnChart;
