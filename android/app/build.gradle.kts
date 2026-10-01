plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

import java.io.FileInputStream
import java.util.Properties

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(FileInputStream(localPropertiesFile))
}

fun localProp(name: String, fallback: String): String =
    localProperties.getProperty(name)?.trim().orEmpty().ifBlank { fallback }

android {
    namespace = "com.rentados.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rentados.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "1.1"

        buildConfigField(
            "String",
            "PRODUCTION_WEB_URL",
            "\"https://rentados.app/\"",
        )
        buildConfigField(
            "String",
            "DEBUG_DEVICE_WEB_URL",
            "\"${localProp("debug.web.url", "http://192.168.1.60:5578/")}\"",
        )
        buildConfigField(
            "String",
            "PRODUCTION_PUSH_DEVICES_URL",
            "\"https://rentados-backend.onrender.com/api/v1/resident/push-devices\"",
        )
        buildConfigField(
            "String",
            "DEBUG_PUSH_DEVICES_URL",
            "\"${localProp("debug.push.url", "http://192.168.1.60:3000/api/v1/resident/push-devices")}\"",
        )
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ""
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
