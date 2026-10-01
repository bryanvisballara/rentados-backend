package com.rentados.app.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.rentados.app.MainActivity

class RentadosFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        MainActivity.notifyPushTokenChanged(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Notifications are shown by the system when the payload includes a notification block.
        message.data
    }
}
