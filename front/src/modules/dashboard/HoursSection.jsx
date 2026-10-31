import { Link } from 'react-router-dom';

import { ColumnChart } from '@/components/charts/ColumnChart.jsx';
import { DataTable } from '@/components/charts/DataTable.jsx';
import { niceMax } from '@/components/charts/scale.js';
import { dayTicks, daysLabel, hoursLabel, hoursValue, monthName, weekLabel } from './format.js';
import { Card, Skeleton } from './Skeleton.jsx';

/**
 * Horas trabajadas del mes: una columna por día y los totales por semana (de lunes a domingo,
 * recortadas al mes) como barras horizontales. Los totales vienen del servidor.
 */
export function HoursSection({ stats, stale, current }) {
  if (!stats) {
    return (
      <Card title="Horas trabajadas">
        <Skeleton className="h-44" />
      </Card>
    );
  }
  const { hours } = stats;
  const month = stats.month;

  if (!hours.worked_days) {
    return (
      <Card title="Horas trabajadas" testId="dash-hours" stale={stale}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-8 text-center" data-testid="dash-hours-empty">
          <p className="text-sm text-text-muted">Sin horas anotadas en {monthName(month)}.</p>
          {current ? (
            <Link to="/objetivos" className="text-sm font-medium text-accent hover:underline">
              Anota las horas de hoy en Objetivos
            </Link>
          ) : null}
        </div>
      </Card>
    );
  }

  const todayDay = stats.today.slice(0, 7) === month ? Number(stats.today.slice(8, 10)) : null;
  const ticksSet = new Set(dayTicks(stats.days_in_month));
  const items = hours.daily.map((d) => ({
    key: d.day,
    label: `${d.day} de ${monthName(month)}`,
    value: hoursValue(d.hours),
    valueLabel: `${hoursLabel(d.hours)} h`,
    strong: d.day === todayDay,
  }));
  const weekMax = niceMax(Math.max(...hours.weeks.map((w) => hoursValue(w.hours))));

  return (
    <Card
      title="Horas trabajadas"
      subtitle={`${hoursLabel(hours.total)} h en ${daysLabel(hours.worked_days)} · ${hoursLabel(hours.average)} h por día trabajado`}
      testId="dash-hours"
      stale={stale}
    >
      <div className="grid gap-5">
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Por día</h3>
          <ColumnChart
            items={items}
            color="var(--chart-hours)"
            tickLabel={(v) => `${String(v).replace('.', ',')}h`}
            axisLabel={(item) => (ticksSet.has(item.key) || item.strong ? item.key : null)}
            ariaLabel={`Horas trabajadas por día de ${monthName(month)}. Usa las flechas para recorrer los días.`}
            testId="dash-hours-chart"
          />
          <DataTable
            caption="Horas por día"
            head={['Día', 'Horas']}
            rows={hours.daily.filter((d) => hoursValue(d.hours) > 0).map((d) => [String(d.day), `${hoursLabel(d.hours)} h`])}
          />
        </div>
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Por semana</h3>
          <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2" data-testid="dash-hours-weeks">
            {hours.weeks.map((w) => {
              const share = weekMax > 0 ? hoursValue(w.hours) / weekMax : 0;
              return (
                <li key={w.from} className="grid grid-cols-[5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs" data-testid="dash-hours-week">
                  <span className="text-text-muted">{weekLabel(w, month)}</span>
                  <span className="block h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    {share > 0 ? (
                      <span className="block h-full rounded-r-[4px]" style={{ width: `${share * 100}%`, background: 'var(--chart-hours)' }} />
                    ) : null}
                  </span>
                  <span className="text-right font-semibold tabular-nums" data-testid="dash-hours-week-total">
                    {hoursLabel(w.hours)} h
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}

export default HoursSection;
