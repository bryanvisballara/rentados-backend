/** Mismo watcher en una sola cadena para inyectar desde Android/iOS. */
export const DEPLOY_WATCHER_SCRIPT = `
(function () {
  if (window.__rentadosDeployWatch) return;
  window.__rentadosDeployWatch = true;
  function moduleScriptSrc() {
    var el = document.querySelector('script[type="module"][src*="/assets/index-"]');
    return el ? el.getAttribute('src') || '' : '';
  }
  var bootBuildEl = document.querySelector('meta[name="rentados-build"]');
  var bootBuild = bootBuildEl ? bootBuildEl.content : '';
  function check() {
    fetch('/index.html?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var buildMatch = html.match(/name="rentados-build"\\s+content="([^"]+)"/);
        if (buildMatch && bootBuild && buildMatch[1] !== bootBuild) {
          location.reload();
          return;
        }
        var assetMatch = html.match(/src="(\\/assets\\/index-[^"]+\\.js)"/);
        var remoteAsset = assetMatch ? assetMatch[1] : '';
        var localAsset = moduleScriptSrc();
        if (remoteAsset && localAsset && remoteAsset !== localAsset) {
          location.reload();
        }
      })
      .catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') check();
  });
  window.__rentadosCheckDeploy = check;
  setTimeout(check, 800);
})();
`.trim();
