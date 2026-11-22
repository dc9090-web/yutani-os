import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

// Private settings never live in the repo: the site address and the Google web client ID come
// from the git-ignored local.properties, the release key from keystore.properties.
fun props(name: String) = Properties().apply {
    val file = rootProject.file(name)
    if (file.exists()) file.inputStream().use { load(it) }
}
val local = props("local.properties")
val keystore = props("keystore.properties")

dependencies {
    implementation(projects.shared)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.playServices)
    implementation(libs.androidx.work)
    implementation(libs.compose.foundation)
    implementation(libs.compose.runtime)
    implementation(libs.compose.ui)
    implementation(libs.googleid)
    implementation(libs.kotlinx.coroutines.core)
}

android {
    namespace = "com.yutanios.app"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.yutanios.app"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 4
        versionName = "0.1.3"
        buildConfigField("String", "SITE_URL", "\"${local.getProperty("yutani.siteUrl", "")}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${local.getProperty("yutani.googleWebClientId", "")}\"")
    }
    buildFeatures { buildConfig = true }
    signingConfigs {
        if (keystore.getProperty("storeFile") != null) {
            create("release") {
                storeFile = rootProject.file(keystore.getProperty("storeFile"))
                storePassword = keystore.getProperty("storePassword")
                keyAlias = keystore.getProperty("keyAlias")
                keyPassword = keystore.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1,INDEX.LIST}" } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_17 } }
