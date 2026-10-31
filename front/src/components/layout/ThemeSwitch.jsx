import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/contexts/ThemeContext.jsx';

/**
 * Selector de tema «Claro | Oscuro»: pastilla segmentada con sol y luna. En PC ícono y texto; en
 * el celular solo íconos (el texto queda para lectores de pantalla). Llama `setTheme`, que cambia
 * el tema con el glitch.
 */
export function ThemeSwitch({ className = '' }) {
  const { theme, setTheme } = useTheme();
  const option = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => setTheme(value)}
      aria-pressed={theme === value}
      aria-label={`Tema ${label.toLowerCase()}`}
      title={`Tema ${label.toLowerCase()}`}
      data-testid={`theme-${value === 'light' ? 'light' : 'dark'}`}
      className={`inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent md:px-2.5 ${
        theme === value ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="max-md:sr-only">{label}</span>
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Tema"
      data-testid="theme-switch"
      className={`inline-flex shrink-0 items-center rounded-full bg-surface-2 p-0.5 ${className}`}
    >
      {option('light', Sun, 'Claro')}
      {option('dark', Moon, 'Oscuro')}
    </div>
  );
}

export default ThemeSwitch;
