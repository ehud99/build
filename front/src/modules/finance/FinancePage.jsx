import { Check, ChevronLeft, ChevronRight, Ellipsis, Plus, ReceiptText, Tags } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { CategoryIcon } from '@/components/money/CategoryIcon.jsx';
import { CURRENCY_NAMES, currencySymbol } from '@/components/money/money.js';
import { apiError } from '@/lib/api.js';
import * as financeApi from './api.js';
import { CategorySheet } from './CategorySheet.jsx';
import { dayHeading, monthLabel, monthName, monthOf, netTone, parseMonth, shiftMonth, signedMoney } from './ledger.js';
import { ManageCategoriesSheet } from './ManageCategoriesSheet.jsx';
import { TransactionSheet } from './TransactionSheet.jsx';
import './finance.css';

// `?tipo=` de la URL ↔ `kind` de la API.
const KIND_PARAMS = { gastos: 'expense', ingresos: 'income' };
const KIND_FILTERS = [
  { key: null, param: null, label: 'Todos' },
  { key: 'expense', param: 'gastos', label: 'Gastos' },
  { key: 'income', param: 'ingresos', label: 'Ingresos' },
];
const TONE_CLASS = { positive: 'text-success', negative: 'text-danger', zero: 'text-text-muted' };

/** «⋯» de la cabecera: las categorías y la moneda. */
function MoreMenu({ currency, currencies, onCurrency, onManage }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        data-testid="fin-more"
      >
        <Ellipsis className="h-5 w-5" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="glass-panel absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl p-2" data-testid="fin-more-menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
            data-testid="fin-manage-categories"
          >
            <Tags className="h-4 w-4 text-text-muted" aria-hidden="true" /> Categorías
          </button>
          <p className="mt-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Moneda</p>
          {currencies.map((c) => (
            <button
              key={c}
              type="button"
              role="menuitemradio"
              aria-checked={c === currency}
              onClick={() => {
                setOpen(false);
                onCurrency(c);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-surface-2"
              data-testid={`fin-currency-${c}`}
            >
              <span className="w-8 shrink-0 font-semibold tabular-nums">{currencySymbol(c)}</span>
              <span className="min-w-0 flex-1 truncate">
                {CURRENCY_NAMES[c]} <span className="text-text-faint">{c}</span>
              </span>
              {c === currency ? <Check className="h-4 w-4 text-accent" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Una cifra de la franja del mes: «Ingresos +…», «Gastos −…», «Neto ±…». */
function Total({ label, value, tone, testId }) {
  return (
    <div className="min-w-0 px-2 text-center first:pl-0 last:pr-0 sm:px-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted sm:text-xs">{label}</p>
      <p
        className={`mt-0.5 text-[15px] font-semibold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-2xl ${TONE_CLASS[tone]}`}
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

/** Una fila de la lista: ícono y nombre de la categoría, la nota en gris y el monto con su signo. */
function TransactionRow({ transaction: t, currency, onOpen }) {
  const income = t.kind === 'income';
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(t)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none sm:px-4"
        data-testid="fin-tx-row"
        data-kind={t.kind}
        data-category={t.category.name}
      >
        <CategoryIcon icon={t.category.icon} color={t.category.color} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{t.category.name}</span>
          {t.note ? (
            <span className="block truncate text-sm text-text-muted" data-testid="fin-tx-row-note">
              {t.note}
            </span>
          ) : null}
        </span>
        <span
          className={`shrink-0 text-right font-semibold tabular-nums ${income ? 'text-success' : 'text-danger'}`}
          data-testid="fin-tx-row-amount"
        >
          {signedMoney(t.amount, currency, income ? '+' : '-')}
        </span>
      </button>
    </li>
  );
}

/**
 * Finanzas como libreta de movimientos: el mes con ‹ › (`?mes=AAAA-MM`), la franja con Ingresos,
 * Gastos y Neto, los filtros Todos | Gastos | Ingresos y por categoría (`?tipo=`, `?cat=`), y la
 * lista agrupada por día con el neto de cada uno. Tocar una fila la edita; el «+» agrega un gasto o
 * un ingreso. Los montos llegan como texto ya sumados por el servidor: aquí solo se formatean.
 * Las estadísticas (balance, dona, porcentajes y periodos) viven en el Dashboard.
 */
export default function FinancePage() {
  const [params, setParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loaded, setLoaded] = useState(null); // {key, data}: la última libreta que llegó
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const [editor, setEditor] = useState(null); // {transaction?}
  const [catEditor, setCatEditor] = useState(null); // {category?, kind}
  const [manageOpen, setManageOpen] = useState(false);
  const requestId = useRef(0);

  const showError = useCallback((e) => setError(apiError(e).message), []);

  useEffect(() => {
    Promise.all([financeApi.fetchSettings(), financeApi.fetchCategories()])
      .then(([s, cats]) => {
        setSettings(s);
        setCategories(cats);
      })
      .catch(showError);
  }, [showError]);

  const today = settings?.today;
  const month = parseMonth(params.get('mes')) ?? (today ? monthOf(today) : null);
  const kind = KIND_PARAMS[params.get('tipo')] ?? null;
  const categoryParam = Number(params.get('cat')) || null;
  const filterCategory = categories.find((c) => c.id === categoryParam && (!kind || c.kind === kind)) ?? null;
  const categoryId = filterCategory?.id ?? null;
  const ledger = loaded?.data;
  const currency = ledger?.currency ?? settings?.currency ?? 'PEN';
  // Mientras llega la libreta de otros filtros se ve la anterior, atenuada.
  const requestKey = `${month}|${kind}|${categoryId}|${version}`;
  const loading = loaded?.key !== requestKey;

  useEffect(() => {
    if (!month) return;
    const id = ++requestId.current;
    financeApi
      .fetchLedger({ month, kind: kind ?? undefined, category_id: categoryId ?? undefined })
      .then((data) => {
        if (id !== requestId.current) return;
        setError(null);
        setLoaded({ key: `${month}|${kind}|${categoryId}|${version}`, data });
      })
      .catch((e) => id === requestId.current && showError(e));
  }, [month, kind, categoryId, version, showError]);

  const refresh = () => setVersion((v) => v + 1);

  /** Cambia parámetros de la URL (`null` los quita) sin llenar el historial. */
  const setParam = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value == null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );

  const changeKind = (filter) => {
    const keepCategory = filterCategory && (!filter.key || filterCategory.kind === filter.key);
    setParam({ tipo: filter.param, cat: keepCategory ? filterCategory.id : null });
  };

  const changeCurrency = async (c) => {
    try {
      setSettings(await financeApi.saveSettings({ currency: c }));
      refresh();
    } catch (e) {
      showError(e);
    }
  };

  const onCategorySaved = (c) => {
    setCatEditor(null);
    setCategories((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]));
    refresh();
  };

  // Las del filtro por categoría: las del tipo elegido (también las archivadas, que tienen historia).
  const filterOptions = useMemo(
    () =>
      ['expense', 'income']
        .filter((k) => !kind || k === kind)
        .map((k) => ({ kind: k, items: categories.filter((c) => c.kind === k) })),
    [categories, kind],
  );

  if (!settings || !month) {
    return (
      <>
        <PageHeader title="Finanzas" />
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : (
          <div className="h-40 animate-pulse rounded-3xl bg-surface-2 motion-reduce:animate-none" aria-label="Cargando" />
        )}
      </>
    );
  }

  const shown = ledger?.month === month ? ledger : null;
  const { income = '0', expense = '0', net = '0' } = shown?.totals ?? {};
  const days = shown?.days ?? [];
  const filtered = Boolean(kind || categoryId);

  return (
    <div className="mx-auto max-w-3xl pb-28 md:pb-24" data-testid="finance">
      <PageHeader title="Finanzas">
        <MoreMenu
          currency={currency}
          currencies={settings.currencies}
          onCurrency={changeCurrency}
          onManage={() => setManageOpen(true)}
        />
      </PageHeader>

      <section className="rounded-3xl border border-border bg-surface p-3 sm:p-4" aria-label="Mes">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setParam({ mes: shiftMonth(month, -1) })}
            disabled={month <= '2000-01'}
            aria-label="Mes anterior"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
            data-testid="fin-prev"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="min-w-0 truncate text-base font-semibold sm:text-lg" data-testid="fin-month" aria-live="polite">
            {monthLabel(month)}
          </h2>
          <button
            type="button"
            onClick={() => setParam({ mes: shiftMonth(month, 1) })}
            disabled={month >= '2100-12'}
            aria-label="Mes siguiente"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
            data-testid="fin-next"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div
          className={`mt-2 grid grid-cols-3 divide-x divide-border border-t border-border pt-3 transition-opacity motion-reduce:transition-none ${
            loading ? 'opacity-60' : ''
          }`}
          data-testid="fin-totals"
        >
          <Total
            label="Ingresos"
            value={signedMoney(income, currency, '+')}
            tone={netTone(income) === 'zero' ? 'zero' : 'positive'}
            testId="fin-total-income"
          />
          <Total
            label="Gastos"
            value={signedMoney(expense, currency, '-')}
            tone={netTone(expense) === 'zero' ? 'zero' : 'negative'}
            testId="fin-total-expense"
          />
          <Total label="Neto" value={signedMoney(net, currency)} tone={netTone(net)} testId="fin-total-net" />
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex w-full gap-1 rounded-full bg-surface-2 p-1 sm:w-auto" role="radiogroup" aria-label="Tipo de movimiento">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              role="radio"
              aria-checked={kind === f.key}
              onClick={() => changeKind(f)}
              className={`min-h-9 flex-1 rounded-full px-3.5 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-accent ${
                kind === f.key ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
              data-testid={`fin-filter-${f.param ?? 'all'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="w-full min-w-0 sm:w-64">
          <span className="sr-only">Categoría</span>
          <select
            value={categoryId ?? ''}
            onChange={(e) => setParam({ cat: e.target.value || null })}
            className={`min-h-11 w-full min-w-0 rounded-full border bg-surface px-3.5 text-sm outline-none focus-visible:border-accent ${
              categoryId ? 'border-accent text-text' : 'border-border text-text-muted'
            }`}
            data-testid="fin-filter-category"
          >
            <option value="">Todas las categorías</option>
            {filterOptions.map((group) => (
              <optgroup key={group.kind} label={group.kind === 'expense' ? 'Gastos' : 'Ingresos'}>
                {group.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.archived ? `${c.name} (archivada)` : c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert" data-testid="fin-error">
          {error}
        </p>
      ) : null}

      {!shown ? (
        <div className="mt-5 space-y-3" aria-label="Cargando">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-surface-2 motion-reduce:animate-none" />
          ))}
        </div>
      ) : days.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-3xl border border-dashed border-border-strong px-6 py-10 text-center" data-testid="fin-empty">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ReceiptText className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-3 font-semibold">
            {filtered ? 'Nada con estos filtros' : `Sin movimientos en ${monthName(month)}`}
          </p>
          <p className="mt-1 max-w-xs text-sm text-text-muted">
            {filtered ? 'Prueba con otra categoría o mira todos los movimientos.' : 'Anota tus gastos e ingresos y aquí verás cada día del mes.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filtered ? (
              <button
                type="button"
                onClick={() => setParam({ tipo: null, cat: null })}
                className="min-h-10 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-2"
                data-testid="fin-clear-filters"
              >
                Quitar filtros
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditor({})}
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90"
              data-testid="fin-empty-add"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Agregar movimiento
            </button>
          </div>
        </div>
      ) : (
        <div className={`mt-5 space-y-5 transition-opacity motion-reduce:transition-none ${loading ? 'opacity-60' : ''}`} data-testid="fin-days">
          {days.map((day) => (
            <section key={day.date} aria-label={dayHeading(day.date, shown.today)} data-testid="fin-day" data-date={day.date}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                <h3 className="min-w-0 truncate text-sm font-semibold" data-testid="fin-day-label">
                  {dayHeading(day.date, shown.today)}
                </h3>
                <span className={`shrink-0 text-sm font-medium tabular-nums ${TONE_CLASS[netTone(day.net)]}`} data-testid="fin-day-net">
                  {signedMoney(day.net, currency)}
                </span>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
                {day.transactions.map((t) => (
                  <TransactionRow key={t.id} transaction={t} currency={currency} onOpen={(tx) => setEditor({ transaction: tx })} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditor({})}
        aria-label="Nuevo movimiento"
        title="Nuevo movimiento"
        className="fin-fab fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[var(--shadow-md)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none md:right-8 md:h-16 md:w-16"
        data-testid="fin-fab"
      >
        <Plus className="h-7 w-7" aria-hidden="true" />
      </button>

      {manageOpen ? (
        <ManageCategoriesSheet
          categories={categories}
          initialKind={kind ?? 'expense'}
          onClose={() => setManageOpen(false)}
          onEdit={(c) => setCatEditor({ category: c, kind: c.kind })}
          onCreate={(k) => setCatEditor({ kind: k })}
        />
      ) : null}

      {editor ? (
        <TransactionSheet
          defaultKind={kind ?? 'expense'}
          transaction={editor.transaction}
          categories={categories}
          currency={currency}
          today={today}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setEditor(null);
            // Uno nuevo de otro mes: se va a ese mes para verlo.
            if (!editor.transaction && monthOf(saved.occurred_on) !== month) setParam({ mes: monthOf(saved.occurred_on) });
            refresh();
          }}
          onDeleted={() => {
            setEditor(null);
            refresh();
          }}
          onCategoryCreated={(c) => setCategories((list) => [...list, c])}
        />
      ) : null}

      {catEditor ? (
        <CategorySheet
          key={catEditor.category?.id ?? `new-${catEditor.kind}`}
          category={catEditor.category}
          defaultKind={catEditor.kind}
          level={1}
          onClose={() => setCatEditor(null)}
          onSaved={onCategorySaved}
          onDeleted={(c) => {
            setCatEditor(null);
            setCategories((list) => list.filter((x) => x.id !== c.id));
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
