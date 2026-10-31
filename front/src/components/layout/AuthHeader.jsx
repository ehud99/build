import { Link } from 'react-router-dom';

import { RealLogo } from '@/components/brand/RealLogo.jsx';

/**
 * Cabecera común del inicio, el login y el registro: el logo y «REAL» a la izquierda (lleva a `/`) y, a la
 * derecha, un enlace en cápsula con borde (`to`, `label`, `testId`).
 */
export function AuthHeader({ to, label, testId }) {
  return (
    <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link to="/" className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-accent" data-testid="auth-brand">
        <RealLogo size={32} />
        REAL
      </Link>
      <Link
        to={to}
        className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted transition-colors hover:border-accent hover:text-text"
        data-testid={testId}
      >
        {label}
      </Link>
    </header>
  );
}

export default AuthHeader;
