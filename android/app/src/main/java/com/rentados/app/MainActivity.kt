package com.rentados.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.firebase.messaging.FirebaseMessaging
import com.rentados.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var jsBridge: RentadosJsBridge
    private var latestPushToken = ""

    private val pushTokenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val token = intent?.getStringExtra(EXTRA_PUSH_TOKEN).orEmpty()
            if (token.isNotBlank()) {
                latestPushToken = token
                jsBridge.updateFcmToken(token)
                jsBridge.deliverPushToken(binding.webView, token)
            }
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            requestFcmToken()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.offlineMessage.setText(AppConfig.offlineMessageRes)
        applySafeAreaInsets()
        setupWebView()
        setupUi()
        setupBackNavigation()
        requestNotificationPermission()
        loadApp(forceReload = savedInstanceState == null)
    }

    override fun onStart() {
        super.onStart()
        ContextCompat.registerReceiver(
            this,
            pushTokenReceiver,
            IntentFilter(ACTION_PUSH_TOKEN_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun onStop() {
        unregisterReceiver(pushTokenReceiver)
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        if (::binding.isInitialized && !binding.webView.url.isNullOrBlank()) {
            jsBridge.checkDeployUpdate(binding.webView)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        jsBridge = RentadosJsBridge(this, lifecycleScope, fcmTokenProvider = { latestPushToken })

        binding.webView.apply {
            setBackgroundColor(android.graphics.Color.WHITE)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                cacheMode = WebSettings.LOAD_NO_CACHE
                userAgentString = "$userAgentString RentadosAndroid/${BuildConfig.VERSION_NAME}"
            }

            addJavascriptInterface(jsBridge, "RentadosNative")
            webChromeClient = WebChromeClient()
            webViewClient = RentadosWebViewClient(
                onPageStarted = { showOffline(false) },
                onPageFinished = { webView ->
                    showOffline(false)
                    jsBridge.injectBridgeScripts(webView)
                    applySafeAreaCss(webView)
                    jsBridge.deliverPushToken(webView, latestPushToken)
                },
                onPageFailed = { showOffline(true) },
                onExternalLink = { uri -> ExternalLink.open(this@MainActivity, uri.toString()) },
            )
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(binding.webView, true)
    }

    private fun setupUi() {
        binding.retryButton.setOnClickListener {
            loadApp(forceReload = true)
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (binding.webView.canGoBack()) {
                        binding.webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            },
        )
    }

    private fun loadApp(forceReload: Boolean) {
        showOffline(false)
        ensureFreshWebCache()
        val url = AppConfig.webUrl
        val headers = mapOf(
            "Cache-Control" to "no-cache",
            "Pragma" to "no-cache",
        )
        if (forceReload || binding.webView.url?.startsWith(url.substringBefore('?')) != true) {
            binding.webView.loadUrl(url, headers)
        } else {
            binding.webView.reload()
        }
    }

    private fun ensureFreshWebCache() {
        val prefs = getSharedPreferences("rentados_web", MODE_PRIVATE)
        val key = "cache_version"
        val current = BuildConfig.VERSION_CODE.toString()
        if (prefs.getString(key, null) == current) return
        binding.webView.clearCache(true)
        prefs.edit().putString(key, current).apply()
    }

    private fun showOffline(show: Boolean) {
        binding.offlinePanel.visibility = if (show) View.VISIBLE else View.GONE
    }

    private fun applySafeAreaInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
            applySafeAreaCss(binding.webView)
            insets
        }
        binding.root.viewTreeObserver.addOnGlobalLayoutListener {
            applySafeAreaCss(binding.webView)
        }
    }

    private fun applySafeAreaCss(webView: WebView) {
        val windowInsets = ViewCompat.getRootWindowInsets(binding.root)
        val status = windowInsets?.getInsets(WindowInsetsCompat.Type.statusBars())
        val nav = windowInsets?.getInsets(WindowInsetsCompat.Type.navigationBars())
        val top = status?.top?.coerceAtLeast(0) ?: 0
        val right = nav?.right?.coerceAtLeast(0) ?: 0
        val bottom = nav?.bottom?.coerceAtLeast(0) ?: 0
        val left = nav?.left?.coerceAtLeast(0) ?: 0
        val appHeight = listOf(binding.root.height, binding.webView.height, resources.displayMetrics.heightPixels)
            .firstOrNull { it > 0 }
            ?: resources.displayMetrics.heightPixels
        val dockGap = (10 * resources.displayMetrics.density).toInt().coerceAtLeast(8)
        val navDockBottom = bottom + dockGap
        val edgeTop = (8 * resources.displayMetrics.density).toInt().coerceAtLeast(6)
        val js = """
            document.documentElement.classList.add('rentados-native-shell');
            document.documentElement.style.setProperty('--safe-top', '${top}px');
            document.documentElement.style.setProperty('--safe-right', '${right}px');
            document.documentElement.style.setProperty('--safe-bottom', '${bottom}px');
            document.documentElement.style.setProperty('--safe-left', '${left}px');
            document.documentElement.style.setProperty('--screen-height', '${appHeight}px');
            document.documentElement.style.setProperty('--resident-nav-dock-bottom', '${navDockBottom}px');
            document.documentElement.style.setProperty('--resident-edge-top', '${edgeTop}px');
            if (window.__rentadosSyncViewport) window.__rentadosSyncViewport();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            requestFcmToken()
            return
        }
        when {
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED -> requestFcmToken()

            else -> notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun requestFcmToken() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            if (!token.isNullOrBlank()) {
                notifyPushTokenChanged(applicationContext, token)
            }
        }
    }

    companion object {
        const val ACTION_PUSH_TOKEN_CHANGED = "com.rentados.app.PUSH_TOKEN_CHANGED"
        const val EXTRA_PUSH_TOKEN = "push_token"

        fun notifyPushTokenChanged(context: Context, token: String) {
            context.sendBroadcast(
                Intent(ACTION_PUSH_TOKEN_CHANGED).apply {
                    setPackage(context.packageName)
                    putExtra(EXTRA_PUSH_TOKEN, token)
                },
            )
        }
    }
}
