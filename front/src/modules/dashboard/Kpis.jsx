import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, Flame } from 'lucide-react';

import { Ring } from '@/components/charts/Ring.jsx';
import { daysLabel, decimalLabel, deltaParts, hoursLabel, monthLabel, percentLabel, streakLevel } from './format.js';
import { Skeleton } from './Skeleton.jsx';

const tile = 'min-w-0 rounded-2xl border border-border bg-surface p-4';
const label = 'text-xs font-medium uppercase tracking-wide text-text-muted';

const DELTA = {
  up: { Icon: ArrowUpRight, className: 'text-success', word: 'Subió' },
  down: { Icon: ArrowDownRight, className: 'text-danger', word: 'Bajó' },
  flat: { Icon: ArrowRight, className: 'text-text-muted', word: 'Igual' },
};

/**
 * La fila de indicadores: Compromiso (el anillo con el %, como el «71 % Compromiso» de la hoja),
 * la diferencia con el mes anterior, las rachas activas y las horas del mes.
 */
export function Kpis({ stats, stale }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        <Skeleton className="col-span-2 h-32 lg:col-span-1" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="col-span-2 h-32 lg:col-span-1" />
      </div>
    );
  }
  const delta = deltaParts(stats.commitment_delta);
  const d = delta ? DELTA[delta.dir] : null;
  const best = stats.streaks.best;
  const hours = stats.hours;

  return (
    <div
      className={`grid grid-cols-2 gap-3 transition-opacity motion-reduce:transition-none lg:grid-cols-4 ${stale ? 'opacity-60' : ''}`}
      data-testid="dash-kpis"
    >
      <div className={`${tile} col-span-2 flex items-center gap-4 lg:col-span-1`} data-testid="kpi-commitment">
        <Ring
          done={stats.score}
          total={stats.possible}
          className="w-24"
          label={`Compromiso: ${percentLabel(stats.commitment)}, ${stats.score} de ${stats.possible}`}
        >
          <span className="text-xl font-semibold leading-none" data-testid="kpi-commitment-value">
            {decimalLabel(stats.commitment)}
            {stats.commitment != null ? <span className="text-xs font-medium text-text-muted"> %</span> : null}
          </span>
        </Ring>
        <div className="min-w-0">
          <p className={label}>Compromiso</p>
          <p className="mt-1 text-2xl font-semibold" data-testid="kpi-commitment-fraction">
            {stats.score} <span className="text-base font-normal text-text-muted">/ {stats.possible}</span>
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {!stats.goals_count ? (
              'Sin objetivos este mes'
            ) : stats.possible === stats.max_score ? (
              `${stats.goals_count} ${stats.goals_count === 1 ? 'objetivo' : 'objetivos'} × ${stats.days_in_month} días`
            ) : (
              <>
                Puntaje final <span className="font-medium text-text tabular-nums" data-testid="kpi-final-score">{stats.score} / {stats.max_score}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className={tile} data-testid="kpi-delta">
        <p className={label}>vs. mes anterior</p>
        {delta ? (
          <p className={`mt-2 flex items-center gap-1 text-2xl font-semibold ${d.className}`}>
            <d.Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span data-testid="kpi-delta-value">{delta.text}</span>
            <span className="sr-only">{d.word}</span>
            <span className="text-sm font-normal text-text-muted">pts</span>
          </p>
        ) : (
          <p className="mt-2 text-2xl font-semibold text-text-faint" data-testid="kpi-delta-value">—</p>
        )}
        <p className="mt-1 text-xs text-text-muted">
          {monthLabel(stats.previous.month)}: <span className="text-text">{percentLabel(stats.previous.commitment)}</span>
        </p>
      </div>

      <div className={tile} data-testid="kpi-streaks">
        <p className={label}>Rachas activas</p>
        <p className="mt-2 text-2xl font-semibold" data-testid="kpi-streaks-value">
          {stats.streaks.active}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-text-muted" data-testid="kpi-streak-best">
          {best ? (
            <>
              <span className="streak-badge inline-flex shrink-0 items-center gap-0.5 font-semibold" data-level={streakLevel(best.days)}>
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                {best.days}
              </span>
              <span className="truncate" title={`${best.title} · ${daysLabel(best.days)}`}>
                Mejor: {best.title} · {daysLabel(best.days)}
              </span>
            </>
          ) : (
            'Sin rachas este mes'
          )}
        </p>
      </div>

      <div className={`${tile} col-span-2 lg:col-span-1`} data-testid="kpi-hours">
        <p className={label}>Horas del mes</p>
        <p className="mt-2 flex items-baseline gap-1 text-2xl font-semibold">
          <Clock className="h-4 w-4 self-center text-text-muted" aria-hidden="true" />
          <span data-testid="kpi-hours-value">{hoursLabel(hours.total)}</span>
          <span className="text-sm font-normal text-text-muted">h</span>
        </p>
        <p className="mt-1 text-xs text-text-muted" data-testid="kpi-hours-average">
          {hours.worked_days ? (
            <>
              <span className="text-text">{hoursLabel(hours.average)} h</span> por día trabajado · {daysLabel(hours.worked_days)}
            </>
          ) : (
            'Sin horas anotadas'
          )}
        </p>
      </div>
    </div>
  );
}

export default Kpis;
