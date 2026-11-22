package com.yutanios.app

import com.yutanios.app.data.SyncOutcome
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.measureTime

/**
 * The whole path against a real site: a first sync into an empty folder, then a second that should
 * find nothing to fetch. Runs only with `-PliveUrl=… -PliveToken=…` (a local site and a token from
 * `npm run app:token`); otherwise it does nothing.
 */
class LiveSyncTest {
    private val url = System.getProperty("liveUrl").orEmpty()
    private val token = System.getProperty("liveToken").orEmpty()

    @Test fun firstSyncFillsThePhoneAndTheSecondFetchesNothing() {
        if (url.isEmpty()) return
        val dir = Files.createTempDirectory("yutani-live").toString()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val tokens = object : TokenStore { override fun get() = token; override fun set(token: String?) {} }
        val app = createAppContainer(url, tokens, dir, null, "live test", scope)
        try {
            runBlocking {
                val first = measureTime { assertEquals(SyncOutcome.Synced, app.syncNow()) }
                val held = app.store.index.value.entries
                val before = held.mapValues { it.value.fetchedAt }
                val second = measureTime { assertEquals(SyncOutcome.Synced, app.syncNow()) }
                val after = app.store.index.value.entries.mapValues { it.value.fetchedAt }
                println("live sync: ${held.size} resources, first $first, second $second")
                assertTrue(held.size > 4, "expected more than the four global resources")
                assertEquals(before, after, "the second sync rewrote something although nothing changed")
            }
        } finally {
            scope.cancel()
        }
    }
}
