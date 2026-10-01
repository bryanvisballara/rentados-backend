package com.rentados.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import java.net.URL

object ExternalLink {
    private val appHosts: Set<String> = buildSet {
        add("rentados.app")
        add("www.rentados.app")
        add("localhost")
        add("127.0.0.1")
        add("10.0.2.2")
        runCatching { Uri.parse(AppConfig.webUrl).host?.lowercase() }.getOrNull()?.let { add(it) }
    }

    fun shouldLeaveApp(url: Uri): Boolean {
        val scheme = url.scheme?.lowercase().orEmpty()
        if (scheme in setOf("tel", "mailto", "sms", "whatsapp", "facetime")) {
            return true
        }
        if (scheme != "http" && scheme != "https") {
            return false
        }
        val host = url.host?.lowercase().orEmpty()
        if (host.isEmpty() || host in appHosts) {
            return false
        }
        return true
    }

    fun open(context: Context, raw: String) {
        val uri = runCatching { Uri.parse(raw) }.getOrNull() ?: return
        if (!shouldLeaveApp(uri)) {
            return
        }
        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
    }

    fun resolve(currentUrl: String?, raw: String): String {
        return runCatching {
            URL(URL(currentUrl), raw).toString()
        }.getOrElse { raw }
    }
}
