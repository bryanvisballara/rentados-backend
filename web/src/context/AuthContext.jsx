import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  formatUser,
  hydrateSession,
  loadSession,
  persistSession,
} from '../api/authSession';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadSession());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hydrateSession()
      .then((session) => {
        if (!cancelled) setAuth(session);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSession(event) {
      setAuth(event.detail);
    }

    window.addEventListener('rentados:session', handleSession);
    return () => window.removeEventListener('rentados:session', handleSession);
  }, []);

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      ready,
      isAuthenticated: Boolean(auth?.token && (auth?.user || !ready)),
      loginSuccess(data) {
        const session = { token: data.token, user: formatUser(data.user) };
        persistSession(session);
        setAuth(session);
        setReady(true);
      },
      logout() {
        clearSession();
        setAuth(null);
      },
      updateSession(session) {
        persistSession(session);
        setAuth(session);
      },
    }),
    [auth, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
