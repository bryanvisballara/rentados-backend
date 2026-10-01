import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { restoreNativeAuthFromBackup } from './api/nativeAuthBackup';
import { AuthProvider } from './context/AuthContext';
import { initDeployWatcher } from './utils/deployWatcher';
import App from './App';
import './styles/global.css';

restoreNativeAuthFromBackup();
initDeployWatcher();

const isNativeShell =
  /RentadosAndroid/i.test(navigator.userAgent) ||
  (window.webkit?.messageHandlers?.pushSession != null);

function syncNativeViewport() {
  if (!document.documentElement.classList.contains('rentados-native-shell')) return;
  const root = document.documentElement;
  const visual = Math.round(window.visualViewport?.height || window.innerHeight || 0);
  if (visual > 0) {
    root.style.setProperty('--app-height', `${visual}px`);
    root.style.setProperty('--screen-height', `${visual}px`);
  }
}

window.__rentadosSyncViewport = syncNativeViewport;

if (isNativeShell) {
  document.documentElement.classList.add('rentados-native-shell');
  syncNativeViewport();
  window.visualViewport?.addEventListener('resize', syncNativeViewport);
  window.addEventListener('resize', syncNativeViewport);
  window.addEventListener('orientationchange', syncNativeViewport);
  window.addEventListener('pageshow', syncNativeViewport);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNativeViewport();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
