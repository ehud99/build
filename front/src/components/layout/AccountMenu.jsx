import { LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { GeneratedAvatar } from '@/components/ui/GeneratedAvatar.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

/**
 * Botón con el avatar de la cuenta y su menú: avatar grande, nombre, `@usuario` y «Cerrar
 * sesión». Cierra con Escape y con un clic afuera.
 *
 * `variant`: `rail` (PC, abajo a la izquierda; el menú sube a la derecha del botón) o `bar`
 * (celular, último ítem de la barra; el menú sube sobre la barra).
 */
export function AccountMenu({ variant = 'rail' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const onLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const bar = variant === 'bar';
  return (
    <div ref={rootRef} className={`relative ${bar ? 'flex flex-1 basis-0 justify-center' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        title="Cuenta"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="account-button"
        className={`flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          bar ? 'min-h-11 px-1.5' : 'glass-panel h-12 w-12'
        } ${open ? 'ring-2 ring-accent' : ''}`}
      >
        <GeneratedAvatar seed={user?.username} size={bar ? 30 : 36} title={user?.name} />
      </button>
      {open ? (
        <div
          role="menu"
          data-testid="account-menu"
          className={`glass-panel absolute z-50 w-60 rounded-2xl p-4 ${
            bar ? 'bottom-full right-0 mb-3' : 'bottom-0 left-full ml-3'
          }`}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <GeneratedAvatar seed={user?.username} size={72} title={user?.name} />
            <div className="min-w-0 max-w-full">
              <p className="truncate font-semibold">{user?.name}</p>
              <p className="truncate text-sm text-text-muted">@{user?.username}</p>
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            data-testid="logout"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-surface-2 px-3 py-2 text-sm text-text transition-colors hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default AccountMenu;
