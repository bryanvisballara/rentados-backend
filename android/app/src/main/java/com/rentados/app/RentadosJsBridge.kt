package com.rentados.app

import android.content.Context
import androidx.core.content.edit
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class RentadosJsBridge(
    private val context: Context,
    private val scope: CoroutineScope,
    private var fcmTokenProvider: () -> String,
) {
    private var authToken = ""
    private var uploadedPair = ""

    @JavascriptInterface
    fun onPushSession(token: String) {
        authToken = token.trim()
        uploadPushToken()
    }

    @JavascriptInterface
    fun onOpenExternal(url: String) {
        ExternalLink.open(context, url)
    }

    @JavascriptInterface
    fun getAuthSession(): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(AUTH_SESSION_KEY, "")
            .orEmpty()
    }

    @JavascriptInterface
    fun persistAuthSession(raw: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            if (raw.isBlank()) {
                remove(AUTH_SESSION_KEY)
            } else {
                putString(AUTH_SESSION_KEY, raw)
            }
        }
    }

    @JavascriptInterface
    fun setAppBadge(count: String) {
        val value = count.trim().toIntOrNull() ?: 0
        com.rentados.app.push.AppBadge.set(context, value)
    }

    @JavascriptInterface
    fun clearAuthSession() {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            remove(AUTH_SESSION_KEY)
        }
    }

    fun injectAuthRestore(webView: WebView) {
        val raw = getAuthSession()
        if (raw.isBlank()) return
        val escaped = JSONObject.quote(raw)
        webView.evaluateJavascript(
            """
            (function () {
              try {
                var raw = $escaped;
                if (!raw) return;
                if (!localStorage.getItem('rentados_token')) {
                  var session = JSON.parse(raw);
                  if (session && session.token) {
                    localStorage.setItem('rentados_token', session.token);
                    localStorage.setItem('rentados_auth', raw);
                  }
                }
              } catch (e) {}
            })();
            """.trimIndent(),
            null,
        )
    }

    fun injectBridgeScripts(webView: WebView) {
        injectAuthRestore(webView)
        webView.evaluateJavascript(PUSH_SESSION_SCRIPT, null)
        webView.evaluateJavascript(OPEN_EXTERNAL_SCRIPT, null)
        webView.evaluateJavascript(DEPLOY_WATCHER_SCRIPT, null)
    }

    fun checkDeployUpdate(webView: WebView) {
        webView.evaluateJavascript(
            "window.__rentadosCheckDeploy && window.__rentadosCheckDeploy();",
            null,
        )
    }

    fun deliverPushToken(webView: WebView, token: String) {
        if (token.isBlank()) return
        val escaped = JSONObject.quote(token)
        webView.evaluateJavascript(
            "window.rentadosRegisterAndroidPush && window.rentadosRegisterAndroidPush($escaped);",
            null,
        )
        uploadPushToken()
    }

    fun updateFcmToken(token: String) {
        fcmTokenProvider = { token }
        uploadPushToken()
    }

    private fun uploadPushToken() {
        val fcmToken = fcmTokenProvider().trim()
        if (fcmToken.isEmpty() || authToken.isEmpty()) return
        val pair = "$authToken|$fcmToken"
        if (pair == uploadedPair) return
        uploadedPair = pair

        scope.launch(Dispatchers.IO) {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL(AppConfig.pushDevicesUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $authToken")
                }
                val body = JSONObject()
                    .put("platform", "android")
                    .put("token", fcmToken)
                    .toString()
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                if (status != 200 && status != 201) {
                    uploadedPair = ""
                }
            } catch (_: Exception) {
                uploadedPair = ""
            } finally {
                connection?.disconnect()
            }
        }
    }

    companion object {
        private const val PREFS_NAME = "rentados_app"
        private const val AUTH_SESSION_KEY = "auth_session"

        private val PUSH_SESSION_SCRIPT = """
            (function () {
              if (window.__rentadosPushWatch) return;
              window.__rentadosPushWatch = true;
              var tick = function () {
                var current = '';
                try { current = localStorage.getItem('rentados_token') || ''; } catch (e) {}
                if (current && window.RentadosNative && window.RentadosNative.onPushSession) {
                  window.RentadosNative.onPushSession(current);
                }
              };
              setInterval(tick, 2000);
              tick();
            })();
        """.trimIndent()

        private val OPEN_EXTERNAL_SCRIPT = """
            (function () {
              if (window.__rentadosOpenExternal) return;
              window.__rentadosOpenExternal = true;
              var original = window.open;
              window.open = function (url) {
                try {
                  var resolved = new URL(String(url || ''), window.location.href);
                  if (resolved.host && resolved.host !== window.location.host) {
                    if (window.RentadosNative && window.RentadosNative.onOpenExternal) {
                      window.RentadosNative.onOpenExternal(resolved.toString());
                    }
                    return null;
                  }
                } catch (error) {}
                return original.apply(window, arguments);
              };
            })();
        """.trimIndent()

        private val DEPLOY_WATCHER_SCRIPT = """
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
        """.trimIndent()
    }
}
