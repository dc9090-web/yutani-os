package com.yutanios.app

import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * A development window, never shipped. It cannot use Android's account picker, so it runs on a token
 * minted on the site (`npm run app:token`): set YUTANI_SITE_URL and YUTANI_TOKEN.
 */
fun main() {
    val token = System.getenv("YUTANI_TOKEN")
    val tokens = object : TokenStore {
        private var value: String? = token
        override fun get() = value
        override fun set(token: String?) { value = token }
    }
    val container = createAppContainer(
        siteUrl = System.getenv("YUTANI_SITE_URL") ?: "",
        tokens = tokens,
        dataDir = (System.getenv("YUTANI_DATA_DIR") ?: (System.getProperty("java.io.tmpdir") + "/yutani-os-desktop")),
        google = null,
        deviceName = "Desktop window",
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
    )
    application {
        Window(onCloseRequest = ::exitApplication, title = "Yutani OS", state = rememberWindowState(width = 390.dp, height = 844.dp)) { App(container) }
    }
}
