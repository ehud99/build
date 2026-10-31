/**
 * Los guardados del editor que siguen en curso cuando se vuelve a la lista (el último se manda al
 * desmontar el editor, con su miniatura). La lista espera `whenSaved()` antes de pedir las
 * pizarras, así la card ya muestra el dibujo y la fecha nuevos.
 */
const pending = new Set();

/** Registra un guardado en curso y lo devuelve. */
export function track(promise) {
  const p = Promise.resolve(promise).catch(() => {});
  pending.add(p);
  p.finally(() => pending.delete(p));
  return promise;
}

/** Se resuelve cuando terminan todos los guardados en curso (nunca falla). */
export function whenSaved() {
  return Promise.all([...pending]).then(() => undefined);
}
