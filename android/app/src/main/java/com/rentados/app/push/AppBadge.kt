package com.rentados.app.push

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri

object AppBadge {
    fun set(context: Context, count: Int) {
        val safe = count.coerceAtLeast(0)
        setSamsung(context, safe)
        setBroadcast(context, safe)
    }

    private fun setSamsung(context: Context, count: Int) {
        try {
            val uri = Uri.parse("content://com.sec.badge/apps")
            val values = ContentValues().apply {
                put("package", context.packageName)
                put("class", "com.rentados.app.MainActivity")
                put("badgecount", count)
            }
            val updated = context.contentResolver.update(
                uri,
                values,
                "package=?",
                arrayOf(context.packageName),
            )
            if (updated == 0) {
                context.contentResolver.insert(uri, values)
            }
        } catch (_: Exception) {
        }
    }

    private fun setBroadcast(context: Context, count: Int) {
        try {
            context.sendBroadcast(
                Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
                    putExtra("badge_count", count)
                    putExtra("badge_count_package_name", context.packageName)
                    putExtra("badge_count_class_name", "com.rentados.app.MainActivity")
                },
            )
        } catch (_: Exception) {
        }
        try {
            context.sendBroadcast(
                Intent("android.intent.action.APPLICATION_MESSAGE_UPDATE").apply {
                    putExtra(
                        "android.intent.extra.update_application_component_name",
                        "${context.packageName}/com.rentados.app.MainActivity",
                    )
                    putExtra(
                        "android.intent.extra.update_application_message_text",
                        if (count > 0) count.toString() else "",
                    )
                },
            )
        } catch (_: Exception) {
        }
    }
}
