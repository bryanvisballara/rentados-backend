const NATIVE_BACKUP_KEY = 'rentados_auth';

function androidBridge() {
  return typeof window.RentadosNative?.getAuthSession === 'function' ? window.RentadosNative : null;
}

export function restoreNativeAuthFromBackup() {
  try {
    const bridge = androidBridge();
    const raw = bridge?.getAuthSession?.();
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session?.token) return false;
    if (!localStorage.getItem('rentados_token')) {
      localStorage.setItem('rentados_token', session.token);
      localStorage.setItem(NATIVE_BACKUP_KEY, raw);
    }
    return true;
  } catch {
    return false;
  }
}

export function syncNativeAuthBackup(session) {
  try {
    const bridge = androidBridge();
    if (!bridge) return;
    if (session?.token) {
      const raw = JSON.stringify(session);
      bridge.persistAuthSession?.(raw);
    } else {
      bridge.clearAuthSession?.();
    }
  } catch {
    /* native optional */
  }
}
