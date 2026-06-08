const STORAGE_KEY = 'rentados_auth';
const TOKEN_KEY = 'rentados_token';

let hydratePromise = null;

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

export function isHydratingSession() {
  return Boolean(hydratePromise);
}

async function fetchSession(token) {
  const res = await fetch('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    return { invalid: true };
  }

  if (!res.ok) {
    return { error: true, status: res.status };
  }

  const data = await res.json();
  return {
    session: {
      token: data.token || token,
      user: formatUser(data.user),
    },
  };
}

function keepStoredSession(stored) {
  if (!stored?.token) return null;
  if (stored.user) return stored;
  return { token: stored.token, user: null };
}

export async function hydrateSession() {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
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
        return keepStoredSession(stored);
      }

      persistSession(result.session);
      return result.session;
    } catch {
      return keepStoredSession(stored);
    }
  })();

  try {
    return await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

export async function refreshSession() {
  if (hydratePromise) {
    const hydrated = await hydratePromise.catch(() => null);
    if (hydrated) return hydrated;
  }

  const stored = loadSession();
  const token = stored?.token;
  if (!token) return null;

  try {
    const result = await fetchSession(token);

    if (result.invalid) {
      clearSession();
      return null;
    }

    if (result.error) {
      return keepStoredSession(stored);
    }

    persistSession(result.session);
    return result.session;
  } catch {
    return keepStoredSession(stored);
  }
}
