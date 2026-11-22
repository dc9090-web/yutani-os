package com.yutanios.app.data

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.respondError
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import okio.Path.Companion.toPath
import okio.fakefilesystem.FakeFileSystem
import java.io.IOException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** A pretend site: a map of path to (tag, data), and a log of what was asked for. */
private class FakeSite {
    val resources = mutableMapOf<String, Pair<String, String>>()
    val requests = mutableListOf<String>()
    var down = false
    var status = HttpStatusCode.OK

    val engine = MockEngine { request ->
        val path = request.url.encodedPathAndQuery
        requests += path
        if (down) throw IOException("no route to host")
        if (status != HttpStatusCode.OK) return@MockEngine respondError(status)
        if (request.headers[HttpHeaders.Authorization] != "Bearer t0ken") return@MockEngine respondError(HttpStatusCode.Unauthorized)
        if (path == SYNC_PATH) {
            val list = resources.entries.joinToString(",") { """{"path":"${it.key}","etag":"${it.value.first.replace("\"", "\\\"")}"}""" }
            return@MockEngine respond("""{"data":{"resources":[$list]},"generatedAt":"2026-01-01T00:00:00Z"}""")
        }
        val (etag, data) = resources[path] ?: return@MockEngine respondError(HttpStatusCode.NotFound)
        if (request.headers[HttpHeaders.IfNoneMatch] == etag) respond("", HttpStatusCode.NotModified)
        else respond("""{"data":$data,"generatedAt":"2026-01-01T00:00:00Z"}""", headers = headersOf(HttpHeaders.ETag, etag))
    }
}

class SyncEngineTest {
    private val site = FakeSite()
    private val store = Store(FakeFileSystem(), "/data".toPath())
    private var clock = 1_000L
    private val engine = SyncEngine(ApiClient("https://site.test/", apiHttpClient(site.engine)) { "t0ken" }, store) { clock }

    @Test fun firstSyncDownloadsEverythingListed() = runTest {
        site.resources["/api/v1/me"] = "\"a\"" to """{"n":1}"""
        site.resources["/api/v1/overview"] = "\"b\"" to """{"n":2}"""
        assertEquals(SyncOutcome.Synced, engine.sync())
        assertEquals("""{"data":{"n":2},"generatedAt":"2026-01-01T00:00:00Z"}""", store.read("/api/v1/overview"))
        assertEquals(1_000L, store.index.value.lastSuccessAt)
        assertEquals(false, store.index.value.lastAttemptFailed)
    }

    @Test fun secondSyncAsksOnlyForTheListWhenNothingChanged() = runTest {
        site.resources["/api/v1/me"] = "\"a\"" to "1"
        engine.sync()
        site.requests.clear()
        engine.sync()
        assertEquals(listOf(SYNC_PATH), site.requests)
    }

    @Test fun onlyTheChangedResourceIsFetchedAgain() = runTest {
        site.resources["/api/v1/me"] = "\"a\"" to "1"
        site.resources["/api/v1/overview"] = "\"b\"" to "2"
        engine.sync()
        site.requests.clear()
        site.resources["/api/v1/overview"] = "\"c\"" to "3"
        engine.sync()
        assertEquals(listOf(SYNC_PATH, "/api/v1/overview"), site.requests)
        assertTrue(store.read("/api/v1/overview")!!.contains("\"data\":3"))
    }

    @Test fun aResourceNoLongerListedIsRemovedFromThePhone() = runTest {
        site.resources["/api/v1/me"] = "\"a\"" to "1"
        site.resources["/api/v1/characters/7/ships/asset/9"] = "\"s\"" to "2"
        engine.sync()
        site.resources.remove("/api/v1/characters/7/ships/asset/9")
        engine.sync()
        assertNull(store.read("/api/v1/characters/7/ships/asset/9"))
        assertEquals(setOf("/api/v1/me"), store.index.value.entries.keys)
    }

    @Test fun withNoConnectionTheCopyStaysAndTheAttemptIsMarkedFailed() = runTest {
        site.resources["/api/v1/me"] = "\"a\"" to "1"
        engine.sync()
        site.down = true
        clock = 2_000L
        assertEquals(SyncOutcome.Offline, engine.sync())
        assertTrue(store.read("/api/v1/me") != null)
        assertEquals(1_000L, store.index.value.lastSuccessAt)
        assertEquals(true, store.index.value.lastAttemptFailed)
    }

    @Test fun aServerErrorCountsAsOffline() = runTest {
        site.status = HttpStatusCode.BadGateway
        assertEquals(SyncOutcome.Offline, engine.sync())
    }

    @Test fun aRefusedTokenSignsThePhoneOut() = runTest {
        val other = SyncEngine(ApiClient("https://site.test", apiHttpClient(site.engine)) { "revoked" }, store) { clock }
        assertEquals(SyncOutcome.SignedOut, other.sync())
    }

    @Test fun theCopySurvivesARestart() = runTest {
        val fs = FakeFileSystem()
        val first = Store(fs, "/data".toPath())
        first.put("/api/v1/me", "{}", "\"a\"", 5)
        first.setActiveCharacter(42)
        val second = Store(fs, "/data".toPath())
        assertEquals("{}", second.read("/api/v1/me"))
        assertEquals("\"a\"", second.etag("/api/v1/me"))
        assertEquals(42L, second.index.value.activeCharacterId)
    }
}
