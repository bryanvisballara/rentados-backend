package com.rentados.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.firebase.messaging.FirebaseMessaging
import com.rentados.app.databinding.ActivityMainBinding
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var jsBridge: RentadosJsBridge
    private var latestPushToken = ""
    private var lastSafeAreaSignature = ""
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var bridgePhotoPick = false
    private var cameraPhotoUri: Uri? = null

    private val galleryLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        handlePhotoResult(uri?.let { arrayOf(it) })
    }

    private val takePictureLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val uri = cameraPhotoUri
        cameraPhotoUri = null
        if (success && uri != null) {
            handlePhotoResult(arrayOf(uri))
        } else {
            handlePhotoResult(null)
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            launchCameraCapture()
        } else {
            showCameraPermissionDialog()
            cancelPendingPhotoPick()
        }
    }

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
            jsBridge.injectAuthRestore(binding.webView)
            jsBridge.checkDeployUpdate(binding.webView)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        jsBridge = RentadosJsBridge(
            this,
            lifecycleScope,
            fcmTokenProvider = { latestPushToken },
            onPickPackagePhoto = { openPackagePhotoPickerForBridge() },
        )

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
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?,
                ): Boolean = showPackagePhotoChooser(filePathCallback)
            }
            webViewClient = RentadosWebViewClient(
                onPageStarted = {
                    lastSafeAreaSignature = ""
                    showOffline(false)
                },
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
    }

    private fun applySafeAreaCss(webView: WebView) {
        if (webView.height <= 0) return
        val windowInsets = ViewCompat.getRootWindowInsets(binding.root)
        val status = windowInsets?.getInsets(WindowInsetsCompat.Type.statusBars())
        val nav = windowInsets?.getInsets(WindowInsetsCompat.Type.navigationBars())
        val top = status?.top?.coerceAtLeast(0) ?: 0
        val right = nav?.right?.coerceAtLeast(0) ?: 0
        val bottom = nav?.bottom?.coerceAtLeast(0) ?: 0
        val left = nav?.left?.coerceAtLeast(0) ?: 0
        val signature = "$top,$right,$bottom,$left,${webView.height}"
        if (signature == lastSafeAreaSignature) return
        lastSafeAreaSignature = signature
        // Physical px. The page converts with devicePixelRatio so the dock stays on the real bottom.
        val js = """
            (function() {
              var dpr = window.devicePixelRatio || 1;
              var css = function(px) { return Math.max(0, Math.round(px / dpr)); };
              var root = document.documentElement;
              root.classList.add('rentados-native-shell');
              root.style.setProperty('--safe-top', css($top) + 'px');
              root.style.setProperty('--safe-right', css($right) + 'px');
              root.style.setProperty('--safe-bottom', css($bottom) + 'px');
              root.style.setProperty('--safe-left', css($left) + 'px');
              root.style.setProperty('--screen-height', css(${webView.height}) + 'px');
              root.style.setProperty('--app-height', css(${webView.height}) + 'px');
              root.style.setProperty('--resident-nav-dock-bottom', (css($bottom) + 8) + 'px');
              root.style.setProperty('--resident-edge-top', (css($top) + 18) + 'px');
              var style = document.getElementById('rentados-native-fix');
              if (!style) {
                style = document.createElement('style');
                style.id = 'rentados-native-fix';
                style.textContent = [
                  'html.rentados-native-shell,html.rentados-native-shell body,html.rentados-native-shell #root,html.rentados-native-shell .resident-app{height:var(--app-height,100dvh)!important;max-height:var(--app-height,100dvh)!important;overflow:hidden!important;}',
                  'html.rentados-native-shell .resident-app__main{overflow-y:auto!important;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;}',
                  'html.rentados-native-shell .resident-app__nav,html.rentados-native-shell .resident-sos-fab{position:fixed!important;}',
                  'html.rentados-native-shell .resident-app__nav{bottom:var(--resident-nav-dock-bottom,8px)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}',
                  'html.rentados-native-shell .resident-sos-fab{bottom:calc(var(--resident-nav-bar-height,3rem) + var(--resident-nav-dock-bottom,8px) + 0.65rem)!important;}',
                  'html.rentados-native-shell .resident-modal-overlay{position:fixed;inset:0;}'
                ].join('');
                document.head.appendChild(style);
              }
              window.__rentadosSyncViewport = function() {
                var visual = Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight || 0);
                if (visual > 0) {
                  root.style.setProperty('--app-height', visual + 'px');
                  root.style.setProperty('--screen-height', visual + 'px');
                }
              };
              window.__rentadosSyncViewport();
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    fun openPackagePhotoPickerForBridge() {
        runOnUiThread { showPackagePhotoChooser(null) }
    }

    private fun showPackagePhotoChooser(inputCallback: ValueCallback<Array<Uri>>?): Boolean {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = inputCallback
        bridgePhotoPick = inputCallback == null
        val options = mutableListOf("Elegir de galería")
        if (packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            options.add(0, "Tomar foto")
        }
        AlertDialog.Builder(this)
            .setTitle("Foto del paquete")
            .setItems(options.toTypedArray()) { _, which ->
                val choice = options[which]
                when (choice) {
                    "Tomar foto" -> openCameraWithPermission()
                    else -> galleryLauncher.launch("image/*")
                }
            }
            .setNegativeButton("Cancelar") { _, _ -> cancelPendingPhotoPick() }
            .setOnCancelListener { cancelPendingPhotoPick() }
            .show()
        return true
    }

    private fun openCameraWithPermission() {
        when {
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED -> launchCameraCapture()

            shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) ->
                AlertDialog.Builder(this)
                    .setTitle("Permiso de cámara")
                    .setMessage("Rentados necesita usar la cámara para fotografiar el paquete en portería.")
                    .setPositiveButton("Continuar") { _, _ ->
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                    .setNegativeButton("Cancelar") { _, _ -> cancelPendingPhotoPick() }
                    .show()

            else -> cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchCameraCapture() {
        val photo = File(cacheDir, "paquete-${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", photo)
        cameraPhotoUri = uri
        takePictureLauncher.launch(uri)
    }

    private fun handlePhotoResult(uris: Array<Uri>?) {
        val callback = fileChooserCallback
        val forBridge = bridgePhotoPick
        fileChooserCallback = null
        bridgePhotoPick = false
        when {
            callback != null -> callback.onReceiveValue(uris)
            forBridge && uris != null && uris.isNotEmpty() -> deliverPhotoToWeb(uris[0])
        }
    }

    private fun cancelPendingPhotoPick() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        bridgePhotoPick = false
        cameraPhotoUri = null
    }

    private fun showCameraPermissionDialog() {
        AlertDialog.Builder(this)
            .setTitle("Cámara desactivada")
            .setMessage("Activa el permiso de cámara para Rentados en Ajustes del teléfono.")
            .setPositiveButton("Entendido", null)
            .show()
    }

    private fun deliverPhotoToWeb(uri: Uri) {
        lifecycleScope.launch {
            val dataUrl = withContext(Dispatchers.IO) { uriToDataUrl(uri) } ?: return@launch
            val quoted = JSONObject.quote(dataUrl)
            binding.webView.evaluateJavascript(
                "window.rentadosApplyPickedPhoto && window.rentadosApplyPickedPhoto($quoted);",
                null,
            )
        }
    }

    private fun uriToDataUrl(uri: Uri): String? {
        val input = contentResolver.openInputStream(uri) ?: return null
        val bitmap = input.use { BitmapFactory.decodeStream(it) } ?: return null
        val scaled = scaleBitmap(bitmap, 1600)
        if (scaled !== bitmap) {
            bitmap.recycle()
        }
        val bytes = ByteArrayOutputStream()
        if (!scaled.compress(Bitmap.CompressFormat.JPEG, 82, bytes)) {
            scaled.recycle()
            return null
        }
        scaled.recycle()
        val encoded = Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
        return "data:image/jpeg;base64,$encoded"
    }

    private fun scaleBitmap(source: Bitmap, maxEdge: Int): Bitmap {
        val width = source.width
        val height = source.height
        val longest = max(width, height)
        if (longest <= maxEdge) return source
        val scale = maxEdge.toFloat() / longest.toFloat()
        val targetW = (width * scale).roundToInt().coerceAtLeast(1)
        val targetH = (height * scale).roundToInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(source, targetW, targetH, true)
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
