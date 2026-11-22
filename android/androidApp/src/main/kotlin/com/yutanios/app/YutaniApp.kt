package com.yutanios.app

import android.app.Activity
import android.app.Application
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.lang.ref.WeakReference
import java.util.concurrent.TimeUnit

class YutaniApp : Application() {
    /** The activity on screen, for the Google account picker, which must be shown from one. */
    var activity: WeakReference<Activity> = WeakReference(null)

    val container: AppContainer by lazy {
        createAppContainer(
            siteUrl = BuildConfig.SITE_URL,
            tokens = KeystoreTokenStore(this),
            dataDir = filesDir.resolve("copy").absolutePath,
            google = CredentialManagerSignIn(this, BuildConfig.GOOGLE_WEB_CLIENT_ID),
            deviceName = listOf(Build.MANUFACTURER, Build.MODEL).joinToString(" ") { it.trim() }.ifBlank { "Android phone" },
            scope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
        )
    }

    override fun onCreate() {
        super.onCreate()
        // About once an hour while there is a network. With Tailscale off the attempt just fails
        // quietly and the copy on the phone stays as it is.
        val hourly = PeriodicWorkRequestBuilder<SyncWorker>(1, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("sync", ExistingPeriodicWorkPolicy.KEEP, hourly)
    }
}
