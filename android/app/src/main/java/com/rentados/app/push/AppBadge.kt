package com.rentados.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.rentados.app.MainActivity
import com.rentados.app.R

object AppBadge {
    private const val BADGE_CHANNEL_ID = "rentados_badge"
    private const val BADGE_NOTIFICATION_ID = 41001

    fun set(context: Context, count: Int) {
        val safe = count.coerceAtLeast(0)
        val className = launcherClass(context)
        setSamsung(context, safe, className)
        setBroadcast(context, safe, className)
        showBadgeNotification(context, safe)
    }

    private fun launcherClass(context: Context): String {
        return context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.component
            ?.className
            ?: "com.rentados.app.MainActivity"
    }

    private fun showBadgeNotification(context: Context, count: Int) {
        val manager = NotificationManagerCompat.from(context)
        if (count <= 0) {
            manager.cancel(BADGE_NOTIFICATION_ID)
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                BADGE_CHANNEL_ID,
                "Pendientes",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                setSound(null, null)
                enableVibration(false)
                setShowBadge(true)
            }
            val system = context.getSystemService(NotificationManager::class.java)
            system?.createNotificationChannel(channel)
        }
        val pending = PendingIntent.getActivity(
            context,
            BADGE_NOTIFICATION_ID,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val text = if (count == 1) "Tienes 1 pendiente" else "Tienes $count pendientes"
        val notification = NotificationCompat.Builder(context, BADGE_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Rentados")
            .setContentText(text)
            .setNumber(count)
            .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setAutoCancel(false)
            .setContentIntent(pending)
            .build()
        try {
            manager.notify(BADGE_NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
        }
    }

    private fun setSamsung(context: Context, count: Int, className: String) {
        try {
            val uri = Uri.parse("content://com.sec.badge/apps")
            val values = ContentValues().apply {
                put("package", context.packageName)
                put("class", className)
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

    private fun setBroadcast(context: Context, count: Int, className: String) {
        try {
            context.sendBroadcast(
                Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
                    putExtra("badge_count", count)
                    putExtra("badge_count_package_name", context.packageName)
                    putExtra("badge_count_class_name", className)
                },
            )
        } catch (_: Exception) {
        }
        try {
            context.sendBroadcast(
                Intent("android.intent.action.APPLICATION_MESSAGE_UPDATE").apply {
                    putExtra(
                        "android.intent.extra.update_application_component_name",
                        "${context.packageName}/$className",
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
