import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Cabecera de una pantalla del panel: migas «Inicio › Objetivos», título, subtítulo opcional y,
 * a la derecha, las acciones (`children`).
 *
 * En el Inicio solo se muestra «Inicio» (sin enlace); en las demás, «Inicio» enlaza a `/inicio`
 * y la miga final es el título.
 */
export function PageHeader({ title, subtitle, crumbs, children }) {
  const isHome = title === 'Inicio';
  const trail = crumbs ?? (isHome ? [] : [{ label: title }]);
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <nav aria-label="Migas" className="mb-1 flex items-center gap-1 text-xs text-text-muted">
          {trail.length === 0 && !isHome ? null : isHome ? (
            <span className="text-text">Inicio</span>
          ) : (
            <>
              <Link to="/inicio" className="hover:text-text hover:underline">
                Inicio
              </Link>
              {trail.map((c) => (
                <span key={c.label} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  <span className="text-text">{c.label}</span>
                </span>
              ))}
            </>
          )}
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-3">{children}</div> : null}
    </header>
  );
}

export default PageHeader;
