import { useEffect, useRef, useState } from 'react';

import { apiError } from '@/lib/api.js';

/**
 * Carga `fetcher(key)` cada vez que cambia `key` (texto; `null` no carga). `fetcher` debe ser
 * estable (una función del módulo). Mientras llega la nueva, conserva la anterior (`stale`) para
 * que la sección no salte. Una respuesta vieja que llega tarde se descarta.
 */
export function useLoad(key, fetcher) {
  const [state, setState] = useState({ data: null, error: null, key: null });
  const id = useRef(0);

  useEffect(() => {
    if (key == null) return;
    const request = ++id.current;
    fetcher(key)
      .then((data) => request === id.current && setState({ data, error: null, key }))
      .catch((e) => request === id.current && setState((s) => ({ ...s, error: apiError(e).message, key })));
  }, [key, fetcher]);

  return {
    data: state.data,
    error: state.error,
    loading: state.key !== key,
    stale: state.key !== key && state.data != null,
  };
}
