package com.yutanios.app

import com.yutanios.app.data.AppJson
import com.yutanios.app.data.Envelope
import com.yutanios.app.data.Store
import com.yutanios.app.data.SyncList
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respondError
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.KSerializer
import okio.Path.Companion.toPath
import okio.fakefilesystem.FakeFileSystem
import java.io.File
import kotlin.time.Instant

/** The site's contract fixtures (`api-fixtures/v1`), which both the site's tests and these decode. */
object Fixtures {
    val dir = File(System.getProperty("fixtures"))

    /** `/api/v1/characters/1/wallet?kind=journal&…` is stored as `characters/1/wallet-journal.json`. */
    fun file(path: String): File {
        val bare = path.removePrefix("/api/v1/")
        val name = if ("?" in bare) bare.substringBefore("?") + "-" + bare.substringAfter("kind=").substringBefore("&") else bare
        return File(dir, "$name.json")
    }

    fun text(path: String): String = file(path).readText()
    fun <T> decode(path: String, serializer: KSerializer<T>): T = AppJson.decodeFromString(Envelope.serializer(serializer), text(path)).data
    val paths: List<String> by lazy { decode("/api/v1/sync", SyncList.serializer()).resources.map { it.path } }

    /** The moment the fixtures were generated at: the app's clock while rendering them. */
    val now: Long by lazy { Instant.parse(AppJson.decodeFromString(Envelope.serializer(SyncList.serializer()), text("/api/v1/sync")).generatedAt).toEpochMilliseconds() }

    /** A signed-in app holding the fixtures as its copy, with no network. */
    fun app(scope: CoroutineScope): AppContainer {
        val tokens = object : TokenStore { override fun get() = "fixture"; override fun set(token: String?) {} }
        val offline = MockEngine { respondError(HttpStatusCode.ServiceUnavailable) }
        val app = AppContainer("https://site.test", tokens, FakeFileSystem(), "/copy".toPath(), offline, null, "test", scope, now = { now })
        runBlocking { fill(app.store); app.store.markSync(true, now - 5 * 60_000) }
        return app
    }

    suspend fun fill(store: Store) = paths.forEach { store.put(it, text(it), null, now) }
}
