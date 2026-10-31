import { createElement } from 'react';

import './money.css';

import { iconFor } from './icons.js';
import { colorVar } from './palette.js';

const SIZES = {
  sm: 'h-8 w-8 [&>svg]:h-4 [&>svg]:w-4',
  md: 'h-10 w-10 [&>svg]:h-5 [&>svg]:w-5',
  lg: 'h-12 w-12 [&>svg]:h-6 [&>svg]:w-6',
  xl: 'h-16 w-16 [&>svg]:h-8 [&>svg]:w-8',
};

/** El ícono de una categoría en su círculo de color. */
export function CategoryIcon({ icon, color, size = 'md', className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${SIZES[size]} ${className}`}
      style={{ background: colorVar(color), color: 'var(--fin-on)' }}
      aria-hidden="true"
    >
      {createElement(iconFor(icon), { strokeWidth: 2.1 })}
    </span>
  );
}

export default CategoryIcon;
