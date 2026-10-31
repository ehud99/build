import { Check, ChevronLeft, ChevronRight, Flame, Lock, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { apiError } from '@/lib/api.js';
import * as goalsApi from './api.js';
import { goalPlaceholder } from './placeholders.js';
import {
  currentStreak,
  dayScore,
  finalScore,
  fullMonth,
  maxScore,
  monthLabel,
  rowTotal,
  shiftMonth,
  streakLevel,
  streaksByDay,
  todayDay,
} from './score.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Título de un objetivo: se edita en el sitio y guarda al salir si cambió. */
function GoalTitleInput({ goal, disabled, onCommit }) {
  const [value, setValue] = useState(goal.title);

  const commit = () => {
    const next = value.trim();
    if (!next || next === goal.title) {
      setValue(goal.title);
      return;
    }
    onCommit(goal, next);
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(goal.title);
          e.currentTarget.blur();
        }
      }}
      readOnly={disabled}
      maxLength={80}
      size={1}
      title={value}
      aria-label={`Título del objetivo ${goal.position + 1}`}
      data-testid={`goal-title-${goal.id}`}
      className="min-w-0 flex-1 truncate rounded bg-transparent px-1 py-0.5 text-sm text-text outline-none focus:bg-surface-2 focus:ring-1 focus:ring-accent read-only:cursor-default"
    />
  );
}

/**
 * Fila para escribir un objetivo nuevo: Enter guarda, Escape cancela. El placeholder recomienda
 * un objetivo según cuántos hay (`count`, `placeholders.js`); se elige una vez al abrirse.
 */
function AddGoalInput({ count, onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [placeholder] = useState(() => goalPlaceholder(count));
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="flex w-full max-w-sm flex-col gap-1">
    <input
      ref={ref}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const t = title.trim();
          if (t) onSubmit(t);
        } else if (e.key === 'Escape') onCancel();
      }}
      maxLength={80}
      placeholder={placeholder}
      aria-label="Nuevo objetivo"
      data-testid="goal-add-input"
      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
    />
    <p className="px-1 text-left text-xs text-text-faint">Enter para guardar · Esc para cancelar</p>
    </div>
  );
}

/** Contador de la racha junto al título: la llama y los días seguidos. */
function StreakBadge({ goal, days, onFire }) {
  if (days < 2 && !onFire) return null;
  const label = onFire ? `¡Mes completo! Racha de ${days} días` : `Racha de ${days} días`;
  return (
    <span
      className="streak-badge inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums"
      data-level={streakLevel(days)}
      title={label}
      aria-label={label}
      data-testid={`goal-streak-${goal.id}`}
    >
      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
      {days}
    </span>
  );
}

/**
 * Objetivos del mes: la hoja de seguimiento (filas de objetivos, una columna por día, T y el
 * puntaje del día). Solo se marca el día de hoy; los meses pasados son de solo lectura.
 */
export default function GoalsPage() {
  const [params, setParams] = useSearchParams();
  const requested = MONTH_RE.test(params.get('mes') ?? '') ? params.get('mes') : null;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const tableRef = useRef(null);

  const showError = useCallback((e) => setError(apiError(e).message), []);

  useEffect(() => {
    const id = ++requestId.current;
    goalsApi
      .fetchMonth(requested)
      .then((month) => {
        if (id !== requestId.current) return;
        setError(null);
        setAdding(false);
        setData(month);
      })
      .catch((e) => id === requestId.current && showError(e));
  }, [requested, showError]);

  const month = data?.month ?? requested;
  const goals = data?.goals ?? [];
  const today = data ? todayDay(data.month, data.today) : null;
  const editable = Boolean(data?.editable);
  const days = Array.from({ length: data?.days_in_month ?? 0 }, (_, i) => i + 1);
  const maxGoals = data?.max_goals ?? 10;

  const patchGoal = (goal) =>
    setData((d) => (d ? { ...d, goals: d.goals.map((g) => (g.id === goal.id ? goal : g)) } : d));

  const go = (delta) => month && setParams({ mes: shiftMonth(month, delta) });

  const toggle = async (goal, day) => {
    if (day !== today) return;
    const done = !goal.checked_days.includes(day);
    const optimistic = {
      ...goal,
      checked_days: done
        ? [...goal.checked_days, day].sort((a, b) => a - b)
        : goal.checked_days.filter((d) => d !== day),
    };
    setError(null);
    patchGoal(optimistic);
    try {
      patchGoal(await goalsApi.setCheck(goal.id, day, done));
    } catch (e) {
      patchGoal(goal);
      showError(e);
    }
  };

  const rename = async (goal, title) => {
    setError(null);
    patchGoal({ ...goal, title });
    try {
      patchGoal(await goalsApi.renameGoal(goal.id, title));
    } catch (e) {
      patchGoal(goal);
      showError(e);
    }
  };

  const remove = async (goal) => {
    if (!window.confirm(`¿Borrar el objetivo «${goal.title}»?`)) return;
    setError(null);
    try {
      await goalsApi.deleteGoal(goal.id);
      setData((d) => (d ? { ...d, goals: d.goals.filter((g) => g.id !== goal.id) } : d));
    } catch (e) {
      showError(e);
    }
  };

  const add = async (title) => {
    setError(null);
    try {
      const goal = await goalsApi.createGoal(data.month, title);
      setData((d) => ({ ...d, goals: [...d.goals, goal] }));
      setAdding(false);
    } catch (e) {
      showError(e);
    }
  };

  const copy = async () => {
    setError(null);
    setBusy(true);
    try {
      setData(await goalsApi.copyPrevious(data.month));
    } catch (e) {
      const err = apiError(e);
      setError(err.code === 'NOTHING_TO_COPY' ? 'El mes anterior no tiene objetivos' : err.message);
    } finally {
      setBusy(false);
    }
  };

  // Si la tabla no cabe (celular), abre mostrando hoy junto a la columna T.
  const loadedMonth = data?.month;
  const hasGoals = goals.length > 0;
  useEffect(() => {
    const box = tableRef.current;
    const col = box?.querySelector('[data-today-col]');
    if (!box || !col || box.scrollWidth <= box.clientWidth) return;
    box.scrollLeft = Math.max(0, col.offsetLeft + col.offsetWidth * 2 - box.clientWidth);
  }, [loadedMonth, hasGoals]);

  const total = finalScore(goals);
  const max = data ? maxScore(goals, data.days_in_month) : 0;
  const [monthName, year] = month && MONTH_RE.test(month) ? monthLabel(month).split(' ') : ['', ''];
  const empty = data && goals.length === 0;
  const canAdd = editable && goals.length < maxGoals;

  const arrow =
    'flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent';
  const cell = 'h-7 w-7 min-w-7 p-0 text-center';

  return (
    <>
      <PageHeader title="Objetivos" subtitle="Los objetivos del mes">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-text-muted">Puntaje final</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="final-score">
            {total} / {max}
          </p>
        </div>
      </PageHeader>

      <div className="mb-4 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(-1)} disabled={!month} aria-label="Mes anterior" data-testid="month-prev" className={arrow}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-44 text-center" data-testid="month-label">
          <span className="text-3xl font-bold uppercase tracking-wide sm:text-4xl">{monthName}</span>{' '}
          <span className="text-sm text-text-muted">{year}</span>
        </div>
        <button type="button" onClick={() => go(1)} disabled={!month} aria-label="Mes siguiente" data-testid="month-next" className={arrow}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p role="alert" data-testid="goals-error" className="mb-3 rounded-xl border border-danger/40 bg-surface px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {data && !editable ? (
        <p className="mb-3 flex items-center justify-center gap-1.5 text-sm text-text-muted" data-testid="month-closed">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Mes cerrado
        </p>
      ) : null}

      {empty ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center" data-testid="goals-empty">
          <p className="text-sm text-text-muted">
            {editable ? 'Este mes todavía no tiene objetivos.' : 'Este mes no tuvo objetivos.'}
          </p>
          {editable ? (
            adding ? (
              <AddGoalInput count={goals.length} onSubmit={add} onCancel={() => setAdding(false)} />
            ) : (
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setAdding(true)} data-testid="goal-add" className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Añadir
                </button>
                <button type="button" onClick={copy} disabled={busy} data-testid="goal-copy-previous" className="rounded-full bg-surface-2 px-4 py-2 text-sm text-text hover:bg-surface-3 disabled:opacity-60">
                  Copiar mes anterior
                </button>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {data && !empty ? (
        <>
          <div ref={tableRef} className="overflow-x-auto rounded-2xl border border-border bg-surface" data-testid="goals-table">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 w-40 min-w-40 bg-surface px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted sm:w-auto sm:min-w-56">
                    Objetivos
                  </th>
                  {days.map((d) => (
                    <th key={d} scope="col" data-today-col={d === today || undefined} className={`${cell} font-medium tabular-nums ${d === today ? 'bg-accent-soft text-accent' : 'text-text-muted'}`}>
                      {d}
                    </th>
                  ))}
                  <th scope="col" className={`${cell} bg-surface-3 font-semibold text-text`}>T</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((goal) => {
                  const streaks = streaksByDay(goal.checked_days);
                  const onFire = fullMonth(goal, data.days_in_month);
                  const streakNow = onFire ? streaks[data.days_in_month] : currentStreak(goal, today);
                  return (
                  <tr
                    key={goal.id}
                    data-testid={`goal-row-${goal.id}`}
                    data-fire={onFire || undefined}
                    className={`border-t border-border ${onFire ? 'goal-row-fire' : ''}`}
                  >
                    <th scope="row" className="sticky left-0 z-10 w-40 min-w-40 bg-surface p-1 text-left font-normal sm:w-auto sm:min-w-56">
                      <div className="flex items-center gap-1">
                        <span className="w-5 shrink-0 text-right text-text-faint tabular-nums">{goal.position + 1}.</span>
                        <GoalTitleInput key={goal.title} goal={goal} disabled={!editable} onCommit={rename} />
                        <StreakBadge goal={goal} days={streakNow} onFire={onFire} />
                        {editable ? (
                          <button type="button" onClick={() => remove(goal)} aria-label={`Borrar «${goal.title}»`} title="Borrar" data-testid={`goal-delete-${goal.id}`} className="shrink-0 rounded p-1 text-text-faint hover:text-danger focus-visible:outline-2 focus-visible:outline-accent">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </th>
                    {days.map((d) => {
                      const on = goal.checked_days.includes(d);
                      const streak = on ? streaks[d] : 0;
                      const isToday = d === today;
                      const clickable = isToday && editable;
                      return (
                        <td
                          key={d}
                          className={`${cell} ${isToday ? 'bg-accent-soft' : ''}`}
                          style={onFire ? { '--fire-i': d - 1, '--fire-n': days.length + 1 } : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => toggle(goal, d)}
                            disabled={!clickable}
                            aria-pressed={on}
                            aria-label={`${goal.title}, día ${d}${streak > 1 ? `, racha de ${streak} días` : ''}`}
                            data-level={on ? streakLevel(streak) : undefined}
                            title={clickable ? undefined : 'Solo puedes marcar el día de hoy'}
                            data-testid={`check-${goal.id}-${d}`}
                            className={`mx-auto flex h-5 w-5 items-center justify-center rounded border motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                              on ? 'streak-cell border-accent bg-accent text-accent-fg' : 'border-border-strong bg-transparent'
                            } ${clickable ? 'cursor-pointer hover:border-accent' : 'cursor-not-allowed opacity-70'}`}
                          >
                            {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : null}
                          </button>
                        </td>
                      );
                    })}
                    <td
                      className={`${cell} bg-surface-3 font-semibold tabular-nums`}
                      style={onFire ? { '--fire-i': days.length, '--fire-n': days.length + 1 } : undefined}
                      data-testid={`goal-total-${goal.id}`}
                    >
                      {rowTotal(goal)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-strong">
                  <th scope="row" className="sticky left-0 z-10 bg-surface-3 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                    Puntaje del día
                  </th>
                  {days.map((d) => (
                    <td key={d} className={`${cell} bg-surface-3 font-medium tabular-nums`} data-testid={`day-score-${d}`}>
                      {dayScore(goals, d)}
                    </td>
                  ))}
                  <td className={`${cell} bg-surface-3 font-semibold tabular-nums`}>{total}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3">
            {!editable ? null : goals.length >= maxGoals ? (
              <p className="text-sm text-text-muted">Máximo {maxGoals} objetivos</p>
            ) : adding ? (
              <AddGoalInput count={goals.length} onSubmit={add} onCancel={() => setAdding(false)} />
            ) : canAdd ? (
              <button type="button" onClick={() => setAdding(true)} data-testid="goal-add" className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-sm hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent">
                <Plus className="h-4 w-4" aria-hidden="true" /> Añadir
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
