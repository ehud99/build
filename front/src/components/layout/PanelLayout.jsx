import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { AccountMenu } from '@/components/layout/AccountMenu.jsx';
import { ThemeSwitch } from '@/components/layout/ThemeSwitch.jsx';
import { revealFromCapsule } from '@/lib/capsuleReveal.js';
import { MODULES } from '@/modules/registry.js';

const DESKTOP_QUERY = '(min-width: 768px)';

/** `true` en PC (≥ 768 px). Solo se monta una de las dos barras, así no se repiten los `data-testid`. */
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/** Logo «Real»: cuadrado redondeado con la R y el nombre. */
function Logo() {
  return (
    <div className="flex items-center gap-2" data-testid="logo">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-fg">
        R
      </span>
      <span className="text-lg font-semibold tracking-tight">Real</span>
    </div>
  );
}

/** Ítem de la barra vertical (PC): solo el ícono, con el nombre en el tooltip. */
function RailItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      aria-label={item.label}
      title={item.label}
      data-testid={`nav-${item.key}`}
      className={({ isActive }) =>
        `flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isActive ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-surface-2 hover:text-text'
        }`
      }
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </NavLink>
  );
}

/** Ítem de la barra de abajo (celular): ícono y nombre. */
function BarItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      aria-label={item.label}
      data-testid={`nav-${item.key}`}
      className={({ isActive }) =>
        `flex min-h-11 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-full px-1.5 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isActive ? 'bg-accent-soft text-accent' : 'text-text-muted'
        }`
      }
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  );
}

/**
 * Armazón del panel: arriba el logo y el selector de tema; la barra de íconos de vidrio a la
 * izquierda en PC (con la cuenta abajo) o flotando abajo en el celular (con la cuenta como último
 * ítem); en medio, la pantalla del módulo (`<Outlet />`). La barra sale de `MODULES`.
 */
export function PanelLayout() {
  const rootRef = useRef(null);
  const desktop = useIsDesktop();

  useLayoutEffect(() => {
    revealFromCapsule(rootRef.current);
  }, []);

  return (
    <div ref={rootRef} data-testid="panel" className="min-h-dvh bg-bg text-text">
      <div className="flex items-center justify-between px-4 pt-4 md:px-6">
        <Logo />
        <ThemeSwitch />
      </div>

      {desktop ? (
        <>
          <nav
            aria-label="Módulos"
            className="glass-panel fixed left-4 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full p-1.5"
          >
            {MODULES.map((item) => (
              <RailItem key={item.key} item={item} />
            ))}
          </nav>
          <div className="fixed bottom-4 left-4 z-40">
            <AccountMenu variant="rail" />
          </div>
        </>
      ) : (
        <nav
          aria-label="Módulos"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-2.5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
        >
          <div className="glass-panel pointer-events-auto flex w-full items-stretch gap-0.5 rounded-full p-1.5">
            {MODULES.map((item) => (
              <BarItem key={item.key} item={item} />
            ))}
            <AccountMenu variant="bar" />
          </div>
        </nav>
      )}

      <main className="px-4 pb-28 pt-6 md:pb-10 md:pl-24 md:pr-6">
        <Outlet />
      </main>
    </div>
  );
}

export default PanelLayout;
