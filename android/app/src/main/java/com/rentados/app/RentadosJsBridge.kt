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
    fun clearAuthSession() {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            remove(AUTH_SESSION_KEY)
        }
    }

    fun injectBridgeScripts(webView: WebView) {
        webView.evaluateJavascript(PUSH_SESSION_SCRIPT, null)
        webView.evaluateJavascript(OPEN_EXTERNAL_SCRIPT, null)
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
    }
}
