package com.rentados.app

object AppConfig {
    val webUrl: String
        get() = if (BuildConfig.DEBUG) BuildConfig.DEBUG_DEVICE_WEB_URL else BuildConfig.PRODUCTION_WEB_URL

    val pushDevicesUrl: String
        get() = if (BuildConfig.DEBUG) BuildConfig.DEBUG_PUSH_DEVICES_URL else BuildConfig.PRODUCTION_PUSH_DEVICES_URL

    val offlineMessageRes: Int
        get() = if (BuildConfig.DEBUG) R.string.offline_message_debug else R.string.offline_message_release
}
