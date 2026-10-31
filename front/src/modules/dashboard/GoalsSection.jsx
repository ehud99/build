import { Flame, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ColumnChart } from '@/components/charts/ColumnChart.jsx';
import { DataTable } from '@/components/charts/DataTable.jsx';
import { dayTicks, daysLabel, monthName, percentLabel, streakLevel, WEEKDAY_NAMES, WEEKDAY_SHORT } from './format.js';
import { Card, Skeleton } from './Skeleton.jsx';

/** Racha con su llama del color del nivel (los tokens `--fire-*` de `.streak-badge`). */
function Streak({ days, testId }) {
  // Como en Objetivos: la llama aparece desde 2 días seguidos.
  if (days < 2) return <span className="text-text-faint" data-testid={testId}>—</span>;
  return (
    <span className="streak-badge inline-flex items-center gap-0.5 font-semibold tabular-nums" data-level={streakLevel(days)} data-testid={testId}>
      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
      {days}
    </span>
  );
}

/** Barra fina del % de un objetivo (pista del mismo tono, más clara). */
function Meter({ done, possible }) {
  const share = possible > 0 ? Math.min(1, done / possible) : 0;
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--chart-track)' }} aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: 'var(--chart-goal)' }} />
    </span>
  );
}

function GoalsTable({ stats }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-semibold">Por objetivo</h3>
      <ul className="divide-y divide-border" data-testid="dash-goal-list">
        {stats.goals.map((g) => {
          const best = g.id === stats.best_goal_id;
          const worst = g.id === stats.worst_goal_id;
          return (
            <li
              key={g.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_4.5rem_6.5rem] ${best || worst ? '-mx-2 rounded-xl px-2' : ''} ${best ? 'bg-accent-soft/60' : ''} ${worst ? 'bg-surface-2' : ''}`}
              data-testid="dash-goal-row"
              data-goal-id={g.id}
              data-best={best || undefined}
              data-worst={worst || undefined}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.title}</p>
                {best || worst ? (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
                    {best ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
                    {best ? 'El más cumplido' : 'El menos cumplido'}
                  </p>
                ) : null}
              </div>
              <div className="col-span-2 row-start-2 flex items-center gap-2 sm:col-span-1 sm:row-start-auto">
                <Meter done={g.done} possible={g.possible} />
                <span className="w-16 shrink-0 text-right text-xs text-text-muted tabular-nums">
                  {g.done} / {g.possible}
                </span>
              </div>
              <span className="col-start-2 row-start-1 text-right text-sm font-semibold tabular-nums sm:col-start-auto sm:row-start-auto" data-testid="dash-goal-percent">
                {percentLabel(g.percent)}
              </span>
              <span className="col-span-2 flex items-center gap-3 text-xs text-text-muted sm:col-span-1 sm:justify-end">
                <span className="inline-flex items-center gap-1" title="Racha actual">
                  <span className="sm:sr-only">Actual</span>
                  <Streak days={g.current_streak} testId="dash-goal-streak" />
                </span>
                <span className="inline-flex items-center gap-1" title="Mejor racha del mes">
                  <span>Mejor</span>
                  <span className="font-semibold text-text tabular-nums" data-testid="dash-goal-best">{g.best_streak}</span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Objetivos del mes: el puntaje de cada día (columnas), el cumplimiento por día de la semana y la
 * lista de objetivos con su %, su racha actual y la mejor, con el más y el menos cumplido.
 */
export function GoalsSection({ stats, stale, month, editable }) {
  if (!stats) {
    return (
      <Card title="Objetivos">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
        <Skeleton className="mt-5 h-28" />
      </Card>
    );
  }

  if (!stats.goals_count) {
    return (
      <Card title="Objetivos" testId="dash-goals" stale={stale}>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center" data-testid="dash-goals-empty">
          <p className="text-sm text-text-muted">
            {editable ? `Todavía no hay objetivos en ${monthName(month)}.` : `${monthName(month)[0].toUpperCase()}${monthName(month).slice(1)} no tuvo objetivos.`}
          </p>
          {editable ? (
            <Link
              to={`/objetivos?mes=${month}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              data-testid="dash-goals-create"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Crea tus objetivos del mes
            </Link>
          ) : null}
        </div>
      </Card>
    );
  }

  const todayDay = stats.today.slice(0, 7) === stats.month ? Number(stats.today.slice(8, 10)) : null;
  const ticksSet = new Set(dayTicks(stats.days_in_month));
  const daily = stats.daily.map((d) => ({
    key: d.day,
    label: `${d.day} de ${monthName(stats.month)}`,
    value: d.score,
    valueLabel: d.elapsed ? `${d.score} de ${stats.goals_count}` : 'Aún no llega',
    muted: !d.elapsed,
    strong: d.day === todayDay,
  }));
  const weekdays = stats.weekdays.map((w) => ({
    key: w.weekday,
    label: WEEKDAY_NAMES[w.weekday],
    value: w.percent == null ? 0 : Number(w.percent),
    valueLabel: w.percent == null ? 'Sin días aún' : `${percentLabel(w.percent)} · ${w.done} de ${w.possible}`,
    muted: w.percent == null,
  }));

  return (
    <Card
      title="Objetivos"
      subtitle={`${stats.goals_count} ${stats.goals_count === 1 ? 'objetivo' : 'objetivos'} · ${daysLabel(stats.elapsed_days)} de ${stats.days_in_month}`}
      action={
        <Link to={`/objetivos?mes=${stats.month}`} className="text-xs font-medium text-accent hover:underline">
          Ir a Objetivos
        </Link>
      }
      testId="dash-goals"
      stale={stale}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 className="mb-1 text-sm font-semibold">Puntaje por día</h3>
          <p className="mb-2 text-xs text-text-muted">Objetivos cumplidos cada día</p>
          <ColumnChart
            items={daily}
            max={stats.goals_count}
            integerTicks
            axisLabel={(item) => (ticksSet.has(item.key) || item.strong ? item.key : null)}
            ariaLabel={`Puntaje por día de ${monthName(stats.month)}. Usa las flechas para recorrer los días.`}
            testId="dash-daily-chart"
          />
          <DataTable
            caption="Puntaje por día"
            head={['Día', 'Puntaje']}
            rows={stats.daily.filter((d) => d.elapsed).map((d) => [String(d.day), `${d.score} / ${stats.goals_count}`])}
          />
        </div>
        <div className="min-w-0">
          <h3 className="mb-1 text-sm font-semibold">Por día de la semana</h3>
          <p className="mb-2 text-xs text-text-muted">% cumplido de lunes a domingo</p>
          <ColumnChart
            items={weekdays}
            max={100}
            tickLabel={(v) => `${v}%`}
            axisLabel={(item) => WEEKDAY_SHORT[item.key]}
            ariaLabel="Cumplimiento por día de la semana. Usa las flechas para recorrer los días."
            testId="dash-weekday-chart"
          />
          <DataTable
            caption="Cumplimiento por día de la semana"
            head={['Día', '%', 'Hechas']}
            rows={stats.weekdays.map((w) => [WEEKDAY_NAMES[w.weekday], percentLabel(w.percent), `${w.done} / ${w.possible}`])}
          />
        </div>
      </div>
      <GoalsTable stats={stats} />
    </Card>
  );
}

export default GoalsSection;
