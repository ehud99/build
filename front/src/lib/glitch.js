/**
 * Cambio de tema con efecto glitch (docs/contrato.md, «Cambio de tema con glitch»), al
 * estilo de louisraille.fr: el color se parte en rojo y azul, franjas de la pantalla
 * saltan a los lados y una estática parpadea antes de quedar el tema nuevo.
 *
 * Usa la View Transitions API, sin librería: `commit` cambia el tema en el DOM de forma
 * síncrona dentro de `document.startViewTransition`, así hay una foto vieja
 * (`::view-transition-old(root)`) y una nueva (`::view-transition-new(root)`) de la página
 * real. Tras `ready`, la Web Animations API las anima con pasos bruscos (`steps(1, end)`)
 * durante `GLITCH_MS`; los cuadros los calcula una sola vez `glitchFrames` (función pura,
 * `glitchFrames.js`), sin JS por cuadro.
 *
 * 1. RGB split y 2. franjas desplazadas: un filtro SVG por vista y por cuadro
 *    (`glitchFilterMarkup`: `feDisplacementMap` con un mapa de franjas y los canales
 *    separados con `feColorMatrix` + `feOffset`), puestos en un `<svg>` temporal y
 *    animados como `filter: url(#…)`. Una pseudo de la View Transition es una sola
 *    imagen, y `view-transition-name` en bandas vacías capturaría solo esas bandas
 *    (no la página detrás), así que el desplazamiento por franjas se hace dentro de la
 *    misma imagen con el mapa de desplazamiento. Encima, el tema nuevo aparece por
 *    franjas (`clip-path: polygon()`) y las dos vistas saltan con `translateX`.
 * 3. Ruido: un `<div class="glitch-noise">` a pantalla completa con un mosaico de
 *    estática pintado una vez en un `<canvas>`, con su propio `view-transition-name`
 *    (queda encima). Se agrega dentro de `commit`, así solo está en la vista nueva, que
 *    es en vivo: se anima el elemento (opacidad y `background-position` a saltos).
 *
 * Mientras dura, `html.glitch-vt` apaga el fundido por defecto (`glitch.css`). Sin la
 * API o con `prefers-reduced-motion`, `commit` corre directo. Si llega otro cambio
 * mientras corre uno, el anterior se salta (`skipTransition`) y se limpia en el acto.
 */
import './glitch.css';

import { GLITCH_MS, NOISE_TILE, glitchFilterMarkup, glitchFrames } from './glitchFrames.js';

export { GLITCH_MS } from './glitchFrames.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STEP = 'steps(1, end)';

/** La transición en curso: `{ transition, cleanup }`. */
let active = null;
let runs = 0;
let noiseUrl = null;

function reducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/** Mosaico de estática (data URL), pintado una vez: grises con algún píxel de color. */
function noiseTile() {
  if (noiseUrl !== null) return noiseUrl;
  noiseUrl = '';
  try {
    const size = NOISE_TILE / 3; // cada punto de ruido mide 3 px en pantalla
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      const tint = Math.random();
      d[i] = tint < 0.04 ? 255 : v;
      d[i + 1] = tint > 0.04 && tint < 0.07 ? 255 : v;
      d[i + 2] = tint > 0.07 && tint < 0.1 ? 255 : v;
      d[i + 3] = 150 + Math.random() * 105;
    }
    // Algunas líneas de barrido más claras, como una tele mal sintonizada.
    for (let y = 0; y < size; y += 1) {
      if (Math.random() < 0.08) {
        for (let x = 0; x < size; x += 1) d[(y * size + x) * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    noiseUrl = canvas.toDataURL('image/png');
  } catch {
    /* sin canvas: no hay estática, el resto del glitch sigue */
  }
  return noiseUrl;
}

/** `<svg>` con los filtros de cada cuadro; devuelve el elemento y los `filter` por cuadro. */
function buildFilters(frames, width, height, prefix) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'glitch-defs');
  svg.setAttribute('aria-hidden', 'true');
  const markup = [];
  const filters = frames.map((frame, i) => {
    const out = {};
    for (const layer of ['new', 'old']) {
      const fx = frame[`${layer}Fx`];
      if (!fx) {
        out[layer] = 'none';
        continue;
      }
      const id = `${prefix}-${layer}-${i}`;
      markup.push(glitchFilterMarkup(id, fx, width, height));
      out[layer] = `url(#${id})`;
    }
    return out;
  });
  svg.innerHTML = `<defs>${markup.join('')}</defs>`;
  return { svg, filters };
}

/**
 * Corre `commit` (cambia el tema en el DOM, síncrono) con el glitch si se puede.
 * Devuelve una promesa que se cumple al terminar (enseguida si el cambio fue inmediato).
 */
export function runGlitchTransition(commit) {
  if (active) active.skip();

  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function' || reducedMotion()) {
    commit();
    return Promise.resolve();
  }

  const root = document.documentElement;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const frames = glitchFrames(width, height);
  runs += 1;
  const { svg, filters } = buildFilters(frames, width, height, `glitch-${runs}`);

  const noise = document.createElement('div');
  noise.className = 'glitch-noise';
  noise.setAttribute('aria-hidden', 'true');
  const tile = noiseTile();
  if (tile) noise.style.backgroundImage = `url(${tile})`;

  let cleaned = false;
  const run = {
    transition: null,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      noise.remove();
      svg.remove();
      if (active === run) {
        active = null;
        root.classList.remove('glitch-vt');
      }
    },
    skip() {
      try {
        run.transition?.skipTransition();
      } catch {
        /* ya terminó */
      }
      run.cleanup();
    },
  };
  active = run;

  try {
    document.body.appendChild(svg);
    root.classList.add('glitch-vt');
    run.transition = document.startViewTransition(() => {
      if (!cleaned) document.body.appendChild(noise);
      commit();
    });
  } catch {
    run.cleanup();
    commit();
    return Promise.resolve();
  }

  const last = frames.length - 1;
  const at = (i) => i / last;
  const opts = (pseudoElement) => ({ duration: GLITCH_MS, easing: 'linear', pseudoElement });

  run.transition.ready
    .then(() => {
      if (cleaned) return;
      root.animate(
        frames.map((f, i) => ({
          offset: at(i),
          easing: STEP,
          clipPath: f.clip,
          transform: `translateX(${f.newX}px)`,
          filter: filters[i].new,
        })),
        opts('::view-transition-new(root)'),
      );
      root.animate(
        frames.map((f, i) => ({
          offset: at(i),
          easing: STEP,
          transform: `translateX(${f.oldX}px)`,
          filter: filters[i].old,
        })),
        opts('::view-transition-old(root)'),
      );
      noise.animate(
        frames.map((f, i) => ({
          offset: at(i),
          easing: STEP,
          opacity: f.noise.opacity,
          backgroundPosition: `${f.noise.x}px ${f.noise.y}px`,
        })),
        { duration: GLITCH_MS, easing: 'linear', fill: 'forwards' },
      );
    })
    .catch(() => {
      /* transición saltada: el tema ya cambió */
    });

  return run.transition.finished
    .catch(() => {
      /* `commit` falló o se saltó: igual se limpia */
    })
    .finally(() => run.cleanup());
}
