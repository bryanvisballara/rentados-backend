package com.rentados.app

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class RentadosWebViewClient(
    private val onPageStarted: () -> Unit,
    private val onPageFinished: (WebView) -> Unit,
    private val onPageFailed: () -> Unit,
    private val onExternalLink: (Uri) -> Unit,
) : WebViewClient() {

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        onPageStarted()
    }

    override fun onPageFinished(view: WebView, url: String?) {
        if (url == "about:blank") {
            return
        }
        onPageFinished(view)
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
    ) {
        if (request.isForMainFrame) {
            view.stopLoading()
            view.loadUrl("about:blank")
            onPageFailed()
        }
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url ?: return false
        if (ExternalLink.shouldLeaveApp(uri)) {
            onExternalLink(uri)
            return true
        }
        return false
    }
}
