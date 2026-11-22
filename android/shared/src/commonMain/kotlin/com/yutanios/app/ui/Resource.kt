package com.yutanios.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import com.yutanios.app.AppContainer
import com.yutanios.app.data.Loaded
import kotlinx.coroutines.delay
import kotlinx.serialization.KSerializer

val LocalApp = staticCompositionLocalOf<AppContainer> { error("no AppContainer") }

/** What a screen knows about one resource: still reading the disk, not on the phone yet, or here. */
sealed interface Res<out T> {
    data object Reading : Res<Nothing>
    data object Missing : Res<Nothing>
    data class Ready<T>(val loaded: Loaded<T>) : Res<T> { val data: T get() = loaded.data }
}

/** The phone's copy of `path`, kept current as syncs rewrite it. Never touches the network. */
@Composable
fun <T> resource(path: String, serializer: KSerializer<T>): State<Res<T>> {
    val app = LocalApp.current
    return produceState<Res<T>>(Res.Reading, path) {
        app.repo.observe(path, serializer).collect { value = if (it == null) Res.Missing else Res.Ready(it) }
    }
}

/** The current time, re-read every `periodMs`, for countdowns and "x ago" lines. */
@Composable
fun rememberNow(periodMs: Long = 30_000): State<Long> {
    val app = LocalApp.current
    val state = remember { mutableLongStateOf(app.now()) }
    produceState(0, periodMs) {
        while (true) { state.longValue = app.now(); delay(periodMs) }
    }.value
    return state
}
