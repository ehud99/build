/** Bloque gris que late mientras carga una sección (sin animación con movimiento reducido). */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-surface-2 motion-reduce:animate-none ${className}`} />;
}

/** Tarjeta de una sección del Dashboard: título, acción a la derecha y contenido. */
export function Card({ title, subtitle, action, children, className = '', testId, stale = false }) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-border bg-surface p-4 transition-opacity motion-reduce:transition-none md:p-5 ${stale ? 'opacity-60' : ''} ${className}`}
      data-testid={testId}
      aria-busy={stale || undefined}
    >
      {title ? (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle ? <p className="text-xs text-text-muted">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
