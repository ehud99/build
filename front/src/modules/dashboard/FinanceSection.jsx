import { useState } from 'react';
import { Link } from 'react-router-dom';

import { CategoryIcon } from '@/components/money/CategoryIcon.jsx';
import { Donut } from '@/components/money/Donut.jsx';
import { formatMoney, isNegative } from '@/components/money/money.js';
import { KIND_LABELS } from '@/components/money/palette.js';
import { monthName, percentLabel } from './format.js';
import { Card, Skeleton } from './Skeleton.jsx';

const EMPTY = { expense: 'Sin gastos este mes', income: 'Sin ingresos este mes' };

function Figure({ label, value, testId, tone = '' }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className={`mt-0.5 break-words text-lg font-semibold leading-tight ${tone}`} data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

/**
 * Finanzas del mes: el balance (de todo el tiempo), los gastos y los ingresos del mes, y la dona
 * por categorías con «Gastos | Ingresos» y su lista con % y monto (como estaba en Finanzas). Todo
 * lo suma el servidor (`/finance/summary`); aquí solo se formatea.
 */
export function FinanceSection({ finance, stale, month }) {
  const [kind, setKind] = useState('expense');

  if (!finance) {
    return (
      <Card title="Finanzas">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="mx-auto mt-5 h-52 w-52 rounded-full" />
      </Card>
    );
  }

  const { currency, expense, income } = finance;
  const summary = kind === 'expense' ? expense : income;
  const items = summary.categories;
  const nothing = expense.categories.length === 0 && income.categories.length === 0;

  return (
    <Card
      title="Finanzas"
      subtitle={`Gastos e ingresos de ${monthName(month)}`}
      action={
        <Link to="/finanzas" className="text-xs font-medium text-accent hover:underline" data-testid="dash-fin-link">
          Ir a Finanzas
        </Link>
      }
      testId="dash-finance"
      stale={stale}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Figure
            label="Balance"
            value={formatMoney(expense.balance, currency)}
            tone={isNegative(expense.balance) ? 'text-danger' : ''}
            testId="dash-fin-balance"
          />
        </div>
        <Figure label="Gastos del mes" value={formatMoney(expense.total, currency)} testId="dash-fin-expense" />
        <Figure label="Ingresos del mes" value={formatMoney(income.total, currency)} testId="dash-fin-income" />
      </div>
      <p className="mt-1.5 text-[11px] text-text-faint">El balance es de todo el tiempo.</p>

      {nothing ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-8 text-center" data-testid="dash-fin-empty">
          <p className="text-sm text-text-muted">No hay movimientos en {monthName(month)}.</p>
          <Link
            to="/finanzas"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            data-testid="dash-fin-first"
          >
            {/^-?0(\.0+)?$/.test(String(expense.balance)) ? 'Registra tu primer gasto' : 'Registra un gasto'}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 flex justify-center">
            <div className="inline-flex rounded-full bg-surface-2 p-1" role="group" aria-label="Tipo">
              {['expense', 'income'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  data-testid={`dash-fin-tab-${k}`}
                  className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    kind === k ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid items-start gap-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-8">
            <Donut items={items} total={formatMoney(summary.total, currency)} caption={KIND_LABELS[kind]} emptyLabel={EMPTY[kind]} />
            {items.length ? (
              <ul className="min-w-0 divide-y divide-border" data-testid="dash-fin-categories">
                {items.map((item) => (
                  <li key={item.category.id} className="flex items-center gap-3 py-2.5" data-testid="dash-fin-cat" data-name={item.category.name}>
                    <CategoryIcon icon={item.category.icon} color={item.category.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.category.name}</span>
                      <span className="block text-xs text-text-muted">
                        {item.count === 1 ? '1 movimiento' : `${item.count} movimientos`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-text-muted tabular-nums" data-testid="dash-fin-cat-percent">
                      {percentLabel(item.percent)}
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums" data-testid="dash-fin-cat-total">
                      {formatMoney(item.total, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="self-center text-center text-sm text-text-muted">
                <Link to="/finanzas" className="font-medium text-accent hover:underline">
                  {kind === 'expense' ? 'Registra un gasto' : 'Registra un ingreso'}
                </Link>
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

export default FinanceSection;
