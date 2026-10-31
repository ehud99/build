import { Check, ChevronLeft, ChevronRight, Ellipsis, Plus, Tags } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { apiError } from '@/lib/api.js';
import * as financeApi from './api.js';
import { CategoryDetailSheet } from './CategoryDetailSheet.jsx';
import { CategoryIcon } from './CategoryIcon.jsx';
import { CategorySheet } from './CategorySheet.jsx';
import { MODES, periodLabel, periodRange, shiftPeriod, switchMode } from './dates.js';
import { Donut } from './Donut.jsx';
import { ManageCategoriesSheet } from './ManageCategoriesSheet.jsx';
import { CURRENCY_NAMES, currencySymbol, formatMoney } from './money.js';
import { KIND_LABELS } from './palette.js';
import { RangeSheet } from './RangeSheet.jsx';
import { TransactionSheet } from './TransactionSheet.jsx';
import './finance.css';

const EMPTY = { expense: 'Sin gastos en este periodo', income: 'Sin ingresos en este periodo' };

/** «⋯» de la cabecera: la moneda y las categorías. */
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

/**
 * Finanzas, como «Gestor de gastos, ingresos»: arriba el balance (ingresos − gastos de siempre) y
 * las pestañas Gastos | Ingresos; en la hoja, Día | Semana | Mes | Año | Período con ‹ ›, la dona
 * por categorías y su lista (tocar una muestra sus movimientos). El «+» agrega un gasto o un ingreso.
 * Los montos llegan como texto y solo se formatean: las cuentas las hace el servidor.
 */
export default function FinancePage() {
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [kind, setKind] = useState('expense');
  const [period, setPeriod] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const [editor, setEditor] = useState(null); // {transaction?}
  const [detail, setDetail] = useState(null); // item del resumen
  const [catEditor, setCatEditor] = useState(null); // {category?, kind}
  const [rangeOpen, setRangeOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const requestId = useRef(0);

  const showError = useCallback((e) => setError(apiError(e).message), []);

  useEffect(() => {
    Promise.all([financeApi.fetchSettings(), financeApi.fetchCategories()])
      .then(([s, cats]) => {
        setSettings(s);
        setCategories(cats);
        setPeriod({ mode: 'month', anchor: s.today });
      })
      .catch(showError);
  }, [showError]);

  const today = settings?.today;
  const range = period ? periodRange(period) : null;
  const currency = summary?.currency ?? settings?.currency ?? 'PEN';

  useEffect(() => {
    if (!range) return;
    const id = ++requestId.current;
    financeApi
      .fetchSummary(kind, range.from, range.to)
      .then((s) => {
        if (id !== requestId.current) return;
        setError(null);
        setSummary(s);
      })
      .catch((e) => id === requestId.current && showError(e));
  }, [kind, range?.from, range?.to, version, showError]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => setVersion((v) => v + 1);
  const reloadCategories = () => financeApi.fetchCategories().then(setCategories, showError);

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
    setDetail((d) => (d && d.category.id === c.id ? { ...d, category: c } : d));
    refresh();
  };

  if (!settings || !period) {
    return (
      <>
        <PageHeader title="Finanzas" />
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : (
          <div className="h-64 animate-pulse rounded-3xl bg-surface-2 motion-reduce:animate-none" aria-label="Cargando" />
        )}
      </>
    );
  }

  const items = summary?.categories ?? [];
  const label = periodLabel(period, today);
  const balance = summary?.balance;

  return (
    <div className="mx-auto max-w-5xl pb-20 md:pb-24" data-testid="finance">
      <PageHeader title="Finanzas">
        <MoreMenu
          currency={currency}
          currencies={settings.currencies}
          onCurrency={changeCurrency}
          onManage={() => setManageOpen(true)}
        />
      </PageHeader>

      <section className="fin-hero relative overflow-hidden rounded-3xl px-5 pb-12 pt-5 md:px-8 md:pt-7" aria-label="Balance">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Balance</p>
        <p className="mt-1 break-words text-4xl font-bold leading-tight tabular-nums md:text-5xl" data-testid="fin-balance">
          {balance === undefined ? '…' : formatMoney(balance, currency)}
        </p>
        <div className="mt-5 flex max-w-sm" role="tablist" aria-label="Tipo">
          {['expense', 'income'].map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`fin-tab relative min-h-11 flex-1 text-sm font-semibold uppercase tracking-wider transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fg ${
                kind === k ? 'opacity-100' : 'opacity-65 hover:opacity-90'
              }`}
              data-testid={`fin-kind-${k}`}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </section>

      <section className="relative -mt-7 rounded-3xl border border-border bg-surface p-4 shadow-[var(--shadow-md)] md:p-6">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Periodo">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={period.mode === m.key}
              onClick={() => {
                if (m.key === 'range') setRangeOpen(true);
                else setPeriod((p) => switchMode(p, m.key));
              }}
              className={`min-h-9 min-w-0 flex-1 truncate rounded-full px-1 text-[13px] font-medium transition-colors sm:text-sm ${
                period.mode === m.key ? 'bg-surface text-accent shadow-sm' : 'text-text-muted hover:text-text'
              }`}
              data-testid={`fin-mode-${m.key}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
            aria-label="Periodo anterior"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
            data-testid="fin-prev"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {period.mode === 'range' ? (
            <button
              type="button"
              onClick={() => setRangeOpen(true)}
              className="min-w-0 truncate rounded-full px-3 py-1 font-medium underline decoration-dotted underline-offset-4 hover:bg-surface-2"
              data-testid="fin-period-label"
            >
              {label}
            </button>
          ) : (
            <p className="min-w-0 truncate font-medium" data-testid="fin-period-label" aria-live="polite">
              {label}
            </p>
          )}
          <button
            type="button"
            onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
            aria-label="Periodo siguiente"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
            data-testid="fin-next"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert" data-testid="fin-error">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid items-start gap-6 md:grid-cols-[minmax(0,17rem)_1fr] md:gap-10">
          <Donut
            items={items}
            total={formatMoney(summary?.total ?? '0', currency)}
            caption={KIND_LABELS[kind]}
            emptyLabel={EMPTY[kind]}
          />
          {items.length > 0 ? (
            <ul className="min-w-0 divide-y divide-border" data-testid="fin-categories">
              {items.map((item) => (
                <li key={item.category.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(item)}
                    className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                    data-testid="fin-cat-row"
                    data-name={item.category.name}
                  >
                    <CategoryIcon icon={item.category.icon} color={item.category.color} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.category.name}</span>
                      <span className="block text-xs text-text-muted">
                        {item.count === 1 ? '1 movimiento' : `${item.count} movimientos`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-text-muted tabular-nums" data-testid="fin-cat-percent">
                      {item.percent.replace('.', ',')} %
                    </span>
                    <span className="w-28 shrink-0 text-right font-semibold tabular-nums sm:w-32" data-testid="fin-cat-total">
                      {formatMoney(item.total, currency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hidden text-center text-sm text-text-muted md:block">
              Toca <span className="font-semibold text-text">+</span> para agregar {kind === 'expense' ? 'un gasto' : 'un ingreso'}.
            </p>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setEditor({})}
        aria-label={kind === 'expense' ? 'Nuevo gasto' : 'Nuevo ingreso'}
        title={kind === 'expense' ? 'Nuevo gasto' : 'Nuevo ingreso'}
        className="fin-fab fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[var(--shadow-md)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none md:right-8 md:h-16 md:w-16"
        data-testid="fin-fab"
      >
        <Plus className="h-7 w-7" aria-hidden="true" />
      </button>

      {detail ? (
        <CategoryDetailSheet
          key={detail.category.id}
          item={detail}
          range={range}
          periodText={label}
          currency={currency}
          today={today}
          version={version}
          onClose={() => setDetail(null)}
          onEdit={(t) => setEditor({ transaction: t })}
          onEditCategory={(c) => setCatEditor({ category: c, kind: c.kind })}
          onChanged={refresh}
        />
      ) : null}

      {manageOpen ? (
        <ManageCategoriesSheet
          categories={categories}
          initialKind={kind}
          onClose={() => setManageOpen(false)}
          onEdit={(c) => setCatEditor({ category: c, kind: c.kind })}
          onCreate={(k) => setCatEditor({ kind: k })}
        />
      ) : null}

      {editor ? (
        <TransactionSheet
          kind={editor.transaction?.kind ?? kind}
          transaction={editor.transaction}
          categories={categories}
          currency={currency}
          today={today}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
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
            reloadCategories();
          }}
        />
      ) : null}

      {rangeOpen ? (
        <RangeSheet
          from={range.from}
          to={range.to}
          onClose={() => setRangeOpen(false)}
          onApply={(from, to) => {
            setRangeOpen(false);
            setPeriod({ mode: 'range', anchor: from, from, to });
          }}
        />
      ) : null}
    </div>
  );
}
