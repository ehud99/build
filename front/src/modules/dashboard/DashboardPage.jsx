import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader.jsx';
import * as dashApi from './api.js';
import { FinanceSection } from './FinanceSection.jsx';
import { MONTH_RE, monthBounds, monthLabel, shiftMonth } from './format.js';
import { GoalsSection } from './GoalsSection.jsx';
import { HeatmapSection } from './HeatmapSection.jsx';
import { HoursSection } from './HoursSection.jsx';
import { Kpis } from './Kpis.jsx';
import { useLoad } from './useLoad.js';

// Sin `?mes=`, cada ruta usa el mes (o el año) de hoy del servidor: así todo carga en paralelo
// sin adivinar la fecha en el navegador.
const CURRENT = 'actual';

const loadStats = (key) => dashApi.fetchStats(key === CURRENT ? null : key);

const loadHeatmap = (key) => dashApi.fetchHeatmap(key === CURRENT ? null : Number(key));

async function loadFinance(key) {
  const range = key === CURRENT ? {} : monthBounds(key);
  const [settings, expense, income] = await Promise.all([
    dashApi.fetchFinanceSettings(),
    dashApi.fetchFinanceSummary('expense', range.from, range.to),
    dashApi.fetchFinanceSummary('income', range.from, range.to),
  ]);
  return { currency: expense.currency ?? settings.currency, expense, income };
}

/**
 * Inicio del panel: el Dashboard de un mes a la vez (‹ Octubre 2026 ›, `?mes=YYYY-MM`). El mismo
 * mes para los objetivos, las horas y las finanzas; el mapa de calor es del año de ese mes. Cada
 * sección carga por su lado con su esqueleto y, al cambiar de mes, conserva lo anterior atenuado
 * hasta que llega lo nuevo.
 */
export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const requested = MONTH_RE.test(params.get('mes') ?? '') ? params.get('mes') : null;

  const stats = useLoad(requested ?? CURRENT, loadStats);
  const finance = useLoad(requested ?? CURRENT, loadFinance);
  const heatmap = useLoad(requested ? requested.slice(0, 4) : CURRENT, loadHeatmap);

  const month = requested ?? stats.data?.month ?? null;
  const today = stats.data?.today ?? null;
  const editable = Boolean(month && today && month >= today.slice(0, 7));
  const statsData = stats.data;
  const go = (delta) => month && setParams({ mes: shiftMonth(month, delta) });
  const [name, year] = month ? monthLabel(month).split(' ') : ['', ''];

  const arrow =
    'flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40';
  const errors = [stats.error, finance.error, heatmap.error].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Inicio" subtitle="Tu mes de un vistazo">
        <div className="flex items-center gap-1" role="group" aria-label="Mes">
          <button type="button" onClick={() => go(-1)} disabled={!month} aria-label="Mes anterior" className={arrow} data-testid="dash-month-prev">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="min-w-36 text-center" aria-live="polite" data-testid="dash-month-label">
            {month ? (
              <>
                <span className="text-lg font-semibold">{name}</span> <span className="text-sm text-text-muted">{year}</span>
              </>
            ) : (
              <span className="text-sm text-text-muted">…</span>
            )}
          </p>
          <button type="button" onClick={() => go(1)} disabled={!month} aria-label="Mes siguiente" className={arrow} data-testid="dash-month-next">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </PageHeader>

      {errors.length ? (
        <p role="alert" className="mb-3 rounded-xl border border-danger/40 bg-surface px-3 py-2 text-sm text-danger" data-testid="dash-error">
          {errors[0]}
        </p>
      ) : null}

      <div className="space-y-4">
        <Kpis stats={statsData} stale={stats.stale} />
        <GoalsSection stats={statsData} stale={stats.stale} month={month} editable={editable} />
        <HeatmapSection heatmap={heatmap.data} stale={heatmap.stale} month={month} />
        <div className="grid gap-4 xl:grid-cols-2">
          <HoursSection stats={statsData} stale={stats.stale} current={Boolean(month && today && month === today.slice(0, 7))} />
          <FinanceSection finance={finance.data} stale={finance.stale} month={month ?? ''} />
        </div>
      </div>
    </div>
  );
}
