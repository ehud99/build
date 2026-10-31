import { createContext, useCallback, useContext, useState } from 'react';
import { flushSync } from 'react-dom';

import { runGlitchTransition } from '@/lib/glitch.js';

const STORAGE_KEY = 'real-theme';
const ThemeContext = createContext(null);

/** El tema que el script de `index.html` puso en `<html>` antes de pintar. */
function initialTheme() {
  const t = typeof document !== 'undefined' ? document.documentElement.dataset.theme : null;
  return t === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#16140F' : '#FAFAF7');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* sin almacenamiento: el tema dura la visita */
  }
}

/**
 * El tema (`light` | `dark`) en `<html data-theme>` y en `localStorage`. `setTheme(next)` lo cambia
 * con el glitch (`lib/glitch.js`): el DOM cambia de forma síncrona dentro de la transición
 * (`flushSync`), así la foto «nueva» ya tiene el tema nuevo.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);

  const setTheme = useCallback(
    (next) => {
      if (next !== 'light' && next !== 'dark') return Promise.resolve();
      if (next === theme) return Promise.resolve();
      return runGlitchTransition(() => {
        flushSync(() => setThemeState(next));
        applyTheme(next);
      });
    },
    [theme],
  );

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme fuera de ThemeProvider');
  return ctx;
}
