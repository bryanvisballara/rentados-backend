const NATIVE_BACKUP_KEY = 'rentados_auth';

function nativeBridge() {
  const native = window.RentadosNative;
  if (!native) return null;
  if (
    typeof native.persistAuthSession === 'function' ||
    typeof native.getAuthSession === 'function'
  ) {
    return native;
  }
  return null;
}

function applyNativeSessionRaw(raw) {
  if (!raw) return false;
  try {
    const session = JSON.parse(raw);
    if (!session?.token) return false;
    const existing = localStorage.getItem('rentados_token');
    if (!existing) {
      localStorage.setItem('rentados_token', session.token);
    }
    localStorage.setItem(NATIVE_BACKUP_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function restoreNativeAuthFromBackup() {
  try {
    const bridge = nativeBridge();
    if (typeof bridge?.getAuthSession === 'function') {
      const raw = bridge.getAuthSession();
      if (applyNativeSessionRaw(raw)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function syncNativeAuthBackup(session) {
  try {
    const bridge = nativeBridge();
    if (!bridge) return;
    if (session?.token) {
      const raw = JSON.stringify(session);
      localStorage.setItem(NATIVE_BACKUP_KEY, raw);
      if (typeof bridge.persistAuthSession === 'function') {
        bridge.persistAuthSession(raw);
      }
    } else if (typeof bridge.clearAuthSession === 'function') {
      bridge.clearAuthSession();
    }
  } catch {
    /* native optional */
  }
}
