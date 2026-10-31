import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/lib/api.js';

const AuthContext = createContext(null);

/**
 * La sesión: `user` (o `null`), `loading` mientras pregunta `GET /api/auth/me` al cargar.
 *
 * - `login(username, accessCode)` y `register({invite_code, name, username, access_code})`
 *   devuelven el usuario o lanzan el error de axios (leerlo con `apiError` de `lib/api.js`).
 * - `logout()` borra la cookie y deja `user` en `null`.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get('/auth/me')
      .then(({ data }) => alive && setUser(data.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username, accessCode) => {
    const { data } = await api.post('/auth/login', { username, access_code: accessCode });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), login, register, logout }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
