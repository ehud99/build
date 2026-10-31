import { Check, ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { apiError } from '@/lib/api.js';
import * as goalsApi from './api.js';
import { ExportMenu } from './ExportMenu.jsx';
import { csvFileName, downloadText, monthCsv } from './exportMonth.js';
import { AddGoalInput, GoalTitleInput, StreakBadge } from './GoalParts.jsx';
import { formatHours, halvesText, toHalves } from './hours.js';
import { HoursStepper } from './HoursStepper.jsx';
import { TodayView } from './TodayView.jsx';
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
const PHONE_QUERY = '(max-width: 767px)';
const HOURS_SAVE_MS = 450;

/** `true` en el celular (< 768 px, como la barra del panel). */
function useIsPhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** Total del mes con las horas de cada día (texto), sumado en medias horas. */
const sumHours = (hours) => halvesText(Object.values(hours ?? {}).reduce((n, h) => n + toHalves(h), 0));

/**
 * Objetivos del mes: la hoja de seguimiento (filas de objetivos, una columna por día, T y el
 * puntaje del día, con la fila de horas trabajadas). Solo se marca el día de hoy; los meses pasados
 * son de solo lectura. En el celular, el mes actual abre en «Hoy» (`TodayView`: solo los objetivos
 * y la casilla de hoy); «Mes» muestra la hoja. «Exportar» baja un CSV o imprime la hoja.
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
  const hoursTimer = useRef(null);
  const phone = useIsPhone();
  const [view, setView] = useState('hoy');

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

  const loadAgain = useCallback(() => {
    const id = ++requestId.current;
    goalsApi.fetchMonth(requested).then((month) => id === requestId.current && setData(month), () => {});
  }, [requested]);

  // Horas de hoy: se ven al instante y se guardan cuando se deja de tocar (`HOURS_SAVE_MS`).
  const changeHours = (text) => {
    if (today == null) return;
    setError(null);
    setData((d) => {
      if (!d) return d;
      const work = { ...d.work_hours, [today]: text };
      if (!toHalves(text)) delete work[today];
      return { ...d, work_hours: work, total_hours: sumHours(work) };
    });
    window.clearTimeout(hoursTimer.current);
    hoursTimer.current = window.setTimeout(async () => {
      try {
        const saved = await goalsApi.setWorkHours(today, text);
        setData((d) => (d && d.month === saved.month ? { ...d, total_hours: saved.total_hours } : d));
      } catch (e) {
        showError(e);
        loadAgain();
      }
    }, HOURS_SAVE_MS);
  };
  useEffect(() => () => window.clearTimeout(hoursTimer.current), []);

  const exportCsv = () => data && downloadText(monthCsv(data), csvFileName(data.month));

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
  const workHours = data?.work_hours ?? {};
  const todayHours = today != null ? workHours[today] ?? '0' : '0';
  const canToday = phone && today != null && !empty && Boolean(data);
  const todayMode = canToday && view === 'hoy';

  const arrow =
    'flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent';
  const cell = 'h-7 w-7 min-w-7 p-0 text-center';

  return (
    <>
      <PageHeader title="Objetivos" subtitle="Los objetivos del mes">
        <ExportMenu onCsv={exportCsv} onPrint={() => window.print()} disabled={!data || empty} />
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-text-muted">Puntaje final</p>
          <p className="text-xl font-semibold tabular-nums" data-testid="final-score">
            {total} / {max}
          </p>
        </div>
      </PageHeader>

      <div className="mb-4 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(-1)} disabled={!month} aria-label="Mes anterior" data-testid="month-prev" className={`${arrow} print:hidden`}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-44 text-center" data-testid="month-label">
          <span className="text-3xl font-bold uppercase tracking-wide sm:text-4xl">{monthName}</span>{' '}
          <span className="text-sm text-text-muted">{year}</span>
        </div>
        <button type="button" onClick={() => go(1)} disabled={!month} aria-label="Mes siguiente" data-testid="month-next" className={`${arrow} print:hidden`}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p role="alert" data-testid="goals-error" className="mb-3 print:hidden rounded-xl border border-danger/40 bg-surface px-3 py-2 text-sm text-danger">
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

      {canToday ? (
        <div className="mb-3 flex justify-center print:hidden">
          <div className="inline-flex rounded-full bg-surface-2 p-1" role="group" aria-label="Vista">
            {[
              ['hoy', 'Hoy'],
              ['mes', 'Mes'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                data-testid={`view-${key === 'hoy' ? 'today' : 'month'}`}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                  view === key ? 'bg-surface text-text shadow-sm' : 'text-text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {todayMode ? (
        <TodayView
          data={data}
          today={today}
          editable={editable}
          onToggle={toggle}
          onRename={rename}
          hours={todayHours}
          onHours={changeHours}
        />
      ) : null}

      {data && !empty ? (
        <>
          <div ref={tableRef} className={`${todayMode ? 'hidden print:block' : ''} overflow-x-auto print:overflow-visible rounded-2xl border border-border bg-surface`} data-testid="goals-table">
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
                          <button type="button" onClick={() => remove(goal)} aria-label={`Borrar «${goal.title}»`} title="Borrar" data-testid={`goal-delete-${goal.id}`} className="print:hidden shrink-0 rounded p-1 text-text-faint hover:text-danger focus-visible:outline-2 focus-visible:outline-accent">
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
                <tr className="border-t border-border-strong" data-testid="hours-row">
                  <th scope="row" className="sticky left-0 z-10 bg-surface-2 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                    Horas trabajadas
                  </th>
                  {days.map((d) => (
                    <td
                      key={d}
                      className={`${cell} tabular-nums ${d === today ? 'bg-accent-soft font-semibold text-accent' : 'bg-surface-2 text-text-muted'}`}
                      data-testid={`hours-${d}`}
                    >
                      {formatHours(workHours[d])}
                    </td>
                  ))}
                  <td className={`${cell} bg-surface-3 font-semibold tabular-nums`} data-testid="hours-total">
                    {formatHours(data.total_hours) || 0}
                  </td>
                </tr>
                <tr className="border-t border-border">
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
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
            {today != null && editable && !todayMode ? (
              <div className="flex items-center gap-3" data-testid="hours-editor">
                <span className="text-sm text-text-muted">Horas trabajadas hoy</span>
                <HoursStepper value={todayHours} onChange={changeHours} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
