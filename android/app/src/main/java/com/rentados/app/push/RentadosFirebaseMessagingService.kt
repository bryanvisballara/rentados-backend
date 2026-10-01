package com.rentados.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.rentados.app.MainActivity
import com.rentados.app.R

class RentadosFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        MainActivity.notifyPushTokenChanged(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        message.data["badge"]?.toIntOrNull()?.let { AppBadge.set(this, it) }
        val title = message.notification?.title ?: message.data["title"] ?: getString(R.string.app_name)
        val body = message.notification?.body ?: message.data["body"] ?: ""
        if (body.isBlank() && title.isBlank()) return
        showNotification(title, body, message.data["url"] ?: "/app")
    }

    private fun showNotification(title: String, body: String, url: String) {
        ensureChannel()
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_OPEN_URL, url)
        }
        val pending = PendingIntent.getActivity(
            this,
            (title + body).hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSound(notificationSound(this))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        NotificationManagerCompat.from(this).notify((title + body).hashCode(), notification)
    }

    private fun ensureChannel() {
        ensureAlertChannel(this)
    }

    companion object {
        const val CHANNEL_ID = "rentados_alerts"
        const val EXTRA_OPEN_URL = "open_url"

        fun notificationSound(context: Context): Uri =
            Uri.parse("android.resource://${context.packageName}/${R.raw.push_rentados}")

        fun ensureAlertChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Rentados",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Avisos de paquetes, visitas y novedades del conjunto"
                setSound(
                    notificationSound(context),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
            }
            manager.createNotificationChannel(channel)
        }
    }
}
