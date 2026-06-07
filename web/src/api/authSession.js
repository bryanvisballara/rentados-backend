const STORAGE_KEY = 'rentados_auth';
const TOKEN_KEY = 'rentados_token';

export function formatUser(user) {
  if (!user) return null;
  return {
    id: user.id || user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    staffType: user.staffType,
    organizationId: user.organizationId,
    buildingId: user.buildingId,
  };
}

export function persistSession(session) {
  if (!session?.token) return;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('rentados:session', { detail: session }));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('rentados:session', { detail: null }));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const token = parsed?.token || localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    return {
      token,
      user: formatUser(parsed?.user),
    };
  } catch {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    return { token, user: null };
  }
}

export function getToken() {
  return loadSession()?.token || null;
}

async function fetchSession(token) {
  const res = await fetch('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    return { invalid: true };
  }

  if (!res.ok) {
    return { error: true };
  }

  const data = await res.json();
  return {
    session: {
      token: data.token || token,
      user: formatUser(data.user),
    },
  };
}

export async function hydrateSession() {
  const stored = loadSession();
  if (!stored?.token) {
    clearSession();
    return null;
  }

  try {
    const result = await fetchSession(stored.token);

    if (result.invalid) {
      clearSession();
      return null;
    }

    if (result.error) {
      return stored.user ? stored : null;
    }

    persistSession(result.session);
    return result.session;
  } catch {
    return stored.user ? stored : null;
  }
}

export async function refreshSession() {
  const token = getToken();
  if (!token) return null;

  try {
    const result = await fetchSession(token);

    if (result.invalid) {
      clearSession();
      return null;
    }

    if (result.error) {
      return loadSession();
    }

    persistSession(result.session);
    return result.session;
  } catch {
    return loadSession();
  }
}
