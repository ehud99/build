/**
 * El logo de Real: un Cthulhu con alas en pixel art de 16 × 16 (cabeza de pulpo, ojos que brillan,
 * alas de murciélago con sus huesos y tentáculos de barba). Se dibuja desde `PIXELS` con un
 * `<rect>` por tramo de color y `shape-rendering="crispEdges"`, así queda nítido en 16, 32 o
 * 64 px. Los colores son tokens (`--logo-*` en `index.css`); el favicon (`public/favicon.svg`)
 * es el mismo dibujo con colores fijos.
 *
 * `.` vacío · `O` contorno · `B` cuerpo · `D` sombra · `L` brillo · `W` ala · `V` hueso del ala ·
 * `E` ojo · `e` brillo del ojo.
 */
const PIXELS = Object.freeze([
  '......OOOO......',
  '.....OBLLBO.....',
  'O...OBLBBBBO...O',
  'VO..OBBBBBBO..OV',
  'WVO.OBBBBBDO.OVW',
  'WVVOOBBBBBDOOVVW',
  'VWWVOEeBBEeOVWWV',
  'WVWWOEEBBEEOWWVW',
  'OWVWOBBBBBDOWVWO',
  '.OOVOBDBBDDOVOO.',
  '...OOBOBBOBDOO..',
  '...OBOOBDOOBDO..',
  '...OBO.OBO.OBO..',
  '..OBO..OBO..OBO.',
  '..OO..OBO....OO.',
  '......OO........',
]);

const FILL = {
  O: 'var(--logo-ink)',
  B: 'var(--logo-body)',
  D: 'var(--logo-shade)',
  L: 'var(--logo-light)',
  W: 'var(--logo-wing)',
  V: 'var(--logo-bone)',
  E: 'var(--logo-eye)',
  e: 'var(--logo-glint)',
};

/** Tramos horizontales del mismo color: `[x, y, ancho, letra]`. */
const RUNS = PIXELS.flatMap((row, y) => {
  const out = [];
  let x = 0;
  while (x < row.length) {
    const c = row[x];
    let end = x;
    while (end < row.length && row[end] === c) end += 1;
    if (c !== '.') out.push([x, y, end - x, c]);
    x = end;
  }
  return out;
});

export function RealLogo({ size = 32, className = '', title }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      data-testid="real-logo"
    >
      {RUNS.map(([x, y, w, c]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={FILL[c]} />
      ))}
    </svg>
  );
}

export default RealLogo;
