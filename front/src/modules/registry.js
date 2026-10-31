import { lazy } from 'react';
import { CalendarDays, House } from 'lucide-react';

/**
 * Los módulos del panel, en el orden de la barra. Agregar uno (notas, tareas, finanzas…) es una
 * entrada aquí y su carpeta en `modules/<clave>/`; el panel arma la barra y las rutas desde esta
 * lista.
 *
 * - `key`: clave del módulo.
 * - `path`: ruta del panel.
 * - `label`: nombre visible (barra, migas y título).
 * - `icon`: ícono de lucide.
 * - `Page`: la pantalla (perezosa).
 */
export const MODULES = [
  {
    key: 'dashboard',
    path: '/inicio',
    label: 'Inicio',
    icon: House,
    Page: lazy(() => import('./dashboard/DashboardPage.jsx')),
  },
  {
    key: 'goals',
    path: '/objetivos',
    label: 'Objetivos',
    icon: CalendarDays,
    Page: lazy(() => import('./goals/GoalsPage.jsx')),
  },
];

/** Adonde va el usuario al entrar. */
export const HOME_PATH = '/inicio';
