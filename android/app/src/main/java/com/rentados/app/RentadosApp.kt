package com.rentados.app

import android.app.Application
import com.google.firebase.FirebaseApp

class RentadosApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}
