import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'rentados_auth';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStored);

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      isAuthenticated: Boolean(auth?.token),
      loginSuccess(data) {
        localStorage.setItem('rentados_token', data.token);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setAuth(data);
      },
      logout() {
        localStorage.removeItem('rentados_token');
        localStorage.removeItem(STORAGE_KEY);
        setAuth(null);
      },
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
