/** Detecta un nuevo deploy en Hostinger y recarga (shell nativo = WebView). */
export function initDeployWatcher() {
  if (typeof window === 'undefined') return;

  const bootBuild =
    document.querySelector('meta[name="rentados-build"]')?.getAttribute('content') || '';

  function moduleScriptSrc() {
    const el = document.querySelector('script[type="module"][src*="/assets/index-"]');
    return el?.getAttribute('src') || '';
  }

  const bootAsset = moduleScriptSrc();

  async function checkForNewDeploy() {
    try {
      const res = await fetch(`/index.html?_=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const html = await res.text();

      const remoteBuild = html.match(/name="rentados-build"\s+content="([^"]+)"/)?.[1];
      if (remoteBuild && bootBuild && remoteBuild !== bootBuild) {
        window.location.reload();
        return;
      }

      const remoteAsset = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
      const localAsset = moduleScriptSrc();
      if (remoteAsset && localAsset && remoteAsset !== localAsset) {
        window.location.reload();
      }
    } catch {
      /* sin red */
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForNewDeploy();
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) checkForNewDeploy();
  });

  window.__rentadosCheckDeploy = checkForNewDeploy;
}
