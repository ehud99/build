import { Check } from 'lucide-react';

import { GoalTitleInput, StreakBadge } from './GoalParts.jsx';
import { HoursStepper } from './HoursStepper.jsx';
import { formatHours } from './hours.js';
import { currentStreak, dayScore, rowTotal, streakLevel, streaksByDay } from './score.js';

const WEEKDAY = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** `'2026-10-31'` → `'Sábado 31 de octubre'`. */
function todayTitle(iso) {
  const text = WEEKDAY.format(new Date(`${iso}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * La hoja en el celular: solo los objetivos y la casilla de hoy (grande, para marcar con el
 * pulgar), su racha y su T, y las horas trabajadas de hoy. Los otros días no ocupan lugar: están
 * en «Mes».
 */
export function TodayView({ data, today, editable, onToggle, onRename, hours, onHours }) {
  const goals = data.goals;
  const done = dayScore(goals, today);

  return (
    <section className="rounded-2xl border border-border bg-surface print:hidden" data-testid="goals-today" aria-label="Hoy">
      <header className="flex items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Hoy</p>
          <h2 className="text-lg font-semibold">{todayTitle(data.today)}</h2>
        </div>
        <p className="text-right" data-testid={`day-score-${today}`}>
          <span className="text-2xl font-semibold tabular-nums">{done}</span>
          <span className="text-sm text-text-muted tabular-nums"> / {goals.length}</span>
        </p>
      </header>

      <ul>
        {goals.map((goal) => {
          const on = goal.checked_days.includes(today);
          const streak = on ? streaksByDay(goal.checked_days)[today] : 0;
          const live = currentStreak(goal, today);
          return (
            <li key={goal.id} className="flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0" data-testid={`today-row-${goal.id}`}>
              <span className="w-5 shrink-0 text-right text-sm text-text-faint tabular-nums">{goal.position + 1}.</span>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <GoalTitleInput key={goal.title} goal={goal} disabled={!editable} onCommit={onRename} testId={`today-title-${goal.id}`} />
                <StreakBadge goal={goal} days={live} onFire={false} />
              </div>
              <span className="shrink-0 text-xs text-text-faint tabular-nums" title="Días cumplidos este mes" data-testid={`today-total-${goal.id}`}>
                {rowTotal(goal)}/{data.days_in_month}
              </span>
              <button
                type="button"
                onClick={() => onToggle(goal, today)}
                disabled={!editable}
                aria-pressed={on}
                aria-label={`${goal.title}, hoy${streak > 1 ? `, racha de ${streak} días` : ''}`}
                data-level={on ? streakLevel(streak) : undefined}
                data-testid={`today-check-${goal.id}`}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  on ? 'streak-cell border-accent bg-accent text-accent-fg' : 'border-border-strong bg-transparent'
                }`}
              >
                {on ? <Check className="h-6 w-6" strokeWidth={3} aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-4 py-3 rounded-b-2xl">
        <div>
          <p className="text-sm font-medium">Horas trabajadas</p>
          <p className="text-xs text-text-muted" data-testid="hours-month-total">
            Este mes: {formatHours(data.total_hours) || '0'} h
          </p>
        </div>
        <HoursStepper value={hours} onChange={onHours} disabled={!editable} size="lg" />
      </footer>
    </section>
  );
}

export default TodayView;
