package com.rentados.app

import android.app.Application
import com.google.firebase.FirebaseApp
import com.rentados.app.push.RentadosFirebaseMessagingService

class RentadosApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        RentadosFirebaseMessagingService.ensureAlertChannel(this)
    }
}
