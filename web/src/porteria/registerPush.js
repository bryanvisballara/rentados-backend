function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function registerPorteriaPush(api) {
  window.rentadosRegisterIosPush = (token) => {
    window.__rentadosIosPushToken = token;
    api.registerPushDevice({ platform: 'ios', token }).catch(() => {});
  };

  window.rentadosRegisterAndroidPush = (token) => {
    window.__rentadosAndroidPushToken = token;
    api.registerPushDevice({ platform: 'android', token }).catch(() => {});
  };

  if (window.__rentadosIosPushToken) {
    window.rentadosRegisterIosPush(window.__rentadosIosPushToken);
  }
  if (window.__rentadosAndroidPushToken) {
    window.rentadosRegisterAndroidPush(window.__rentadosAndroidPushToken);
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return;
  }

  navigator.serviceWorker
    .register('/sw.js')
    .then(async (registration) => {
      const permission =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') return;

      const { publicKey } = await api.pushPublicKey();
      if (!publicKey) return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await api.registerPushDevice({ platform: 'web', subscription: subscription.toJSON() });
    })
    .catch(() => {});
}
