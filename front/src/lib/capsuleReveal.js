/**
 * El panel se abre creciendo desde el botón «Verificar código» (la
 * cápsula del video de referencia).
 *
 * Al entrar, el login llama `holdCapsule(boton)`: deja una copia de la cápsula, ya sin texto, fija
 * en `document.body` (fuera de React, así sobrevive al cambio de ruta) y guarda dónde estaba. El
 * panel, al montarse, llama `revealFromCapsule(raiz)`: recorta su raíz con `clip-path` a la forma
 * de la cápsula y la abre hasta la pantalla entera mientras la copia se desvanece. Web Animations
 * API, sin `motion` (el login no la carga). Con movimiento reducido, o si el panel tarda más de
 * `HOLD_MS`, la copia se quita sin animar.
 */

const HOLD_MS = 4000;
const REVEAL_MS = 760;
const EASING = 'cubic-bezier(0.76, 0, 0.24, 1)';

let pending = null;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function drop() {
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pending.ghost.remove();
  pending = null;
}

/** El fondo de la página donde está `el`: el primer antecesor que no es transparente. */
function pageBackground(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const color = window.getComputedStyle(node).backgroundColor;
    if (color && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color)) return color;
  }
  return window.getComputedStyle(document.documentElement).backgroundColor;
}

/** Deja la cápsula fija donde está `button` hasta que el panel la abra. */
export function holdCapsule(button) {
  if (typeof document === 'undefined' || !button) return;
  drop();
  const rect = button.getBoundingClientRect();
  const style = window.getComputedStyle(button);
  const radius = Math.min(rect.height / 2, parseFloat(style.borderTopLeftRadius) || rect.height / 2);
  // Un fondo del color de la página tapa lo que se monta debajo (la pantalla de carga del panel)
  // hasta que el panel crece desde la cápsula.
  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.dataset.testid = 'capsule-ghost';
  Object.assign(ghost.style, {
    position: 'fixed',
    inset: '0',
    background: pageBackground(button),
    zIndex: '2147483000',
    pointerEvents: 'none',
  });
  const capsule = document.createElement('div');
  ghost.appendChild(capsule);
  Object.assign(capsule.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: `${radius}px`,
    background: style.getPropertyValue('--capsule-fill').trim() || style.backgroundColor,
  });
  document.body.appendChild(ghost);
  // Mientras el panel carga, la cápsula «respira».
  if (!reducedMotion() && typeof capsule.animate === 'function') {
    capsule.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }], {
      duration: 650,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out',
    });
  }
  pending = { rect, radius, ghost, timer: window.setTimeout(drop, HOLD_MS) };
}

/** Abre `root` desde la cápsula guardada (si hay una). Devuelve la animación o `null`. */
export function revealFromCapsule(root) {
  if (!pending || !root) return null;
  const { rect, radius, ghost } = pending;
  window.clearTimeout(pending.timer);
  pending = null;
  if (reducedMotion() || typeof root.animate !== 'function') {
    ghost.remove();
    return null;
  }
  // Los recortes van contra la caja de la raíz, que puede ser más alta que la pantalla.
  const box = root.getBoundingClientRect();
  const px = (n) => `${Math.max(0, n)}px`;
  const from = `inset(${px(rect.top - box.top)} ${px(box.right - rect.right)} ${px(box.bottom - rect.bottom)} ${px(rect.left - box.left)} round ${radius}px)`;
  const to = 'inset(0px 0px 0px 0px round 0px)';
  // El fondo pasa detrás del panel (lo que queda fuera del recorte lo sigue tapando) y la cápsula,
  // que el panel cubre al crecer, ya no hace falta.
  ghost.style.zIndex = '-1';
  ghost.firstChild?.remove();
  const reveal = root.animate([{ clipPath: from }, { clipPath: to }], { duration: REVEAL_MS, easing: EASING });
  const cleanup = () => ghost.remove();
  reveal.finished.then(cleanup, cleanup);
  return reveal;
}
