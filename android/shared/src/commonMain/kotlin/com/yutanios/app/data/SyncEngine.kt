package com.yutanios.app.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.Serializable

const val SYNC_PATH = "/api/v1/sync"

@Serializable data class SyncResource(val path: String, val etag: String)
@Serializable data class SyncList(val resources: List<SyncResource>)

enum class SyncOutcome { Synced, Offline, SignedOut }

data class SyncProgress(val running: Boolean = false, val done: Int = 0, val total: Int = 0)

/**
 * Brings the phone's copy up to date: one request for the site's list of tags, then one request
 * for each resource whose tag differs. Everything already fetched stays when the connection drops
 * half way, so the next attempt only asks for the rest.
 */
class SyncEngine(private val api: ApiClient, private val store: Store, private val now: () -> Long) {
    private val running = Mutex()
    private val _progress = MutableStateFlow(SyncProgress())
    private val _changed = MutableSharedFlow<String>(extraBufferCapacity = 256)
    val progress: StateFlow<SyncProgress> = _progress
    /** Emits the path of every resource that was rewritten or removed. */
    val changed: SharedFlow<String> = _changed

    suspend fun sync(): SyncOutcome = running.withLock {
        _progress.value = SyncProgress(running = true)
        try {
            val body = api.get(SYNC_PATH) as? Fetched.Body ?: error("the sync list came back empty")
            val wanted = AppJson.decodeFromString(Envelope.serializer(SyncList.serializer()), body.text).data.resources
            val stale = wanted.filter { store.etag(it.path) != it.etag }
            _progress.value = SyncProgress(running = true, done = 0, total = stale.size)
            val gate = Semaphore(4)
            coroutineScope {
                stale.map { resource ->
                    async {
                        gate.withPermit { fetch(resource) }
                        _progress.update { it.copy(done = it.done + 1) }
                    }
                }.awaitAll()
            }
            store.retain(wanted.mapTo(mutableSetOf()) { it.path }).forEach { _changed.emit(it) }
            store.markSync(success = true, now = now())
            SyncOutcome.Synced
        } catch (e: CancellationException) {
            throw e
        } catch (e: SignedOutException) {
            SyncOutcome.SignedOut
        } catch (e: Exception) {
            // No route, a timeout, Tailscale off, a 5xx: all the same to the owner — the copy is shown.
            store.markSync(success = false, now = now())
            SyncOutcome.Offline
        } finally {
            _progress.value = SyncProgress()
        }
    }

    private suspend fun fetch(resource: SyncResource) {
        when (val got = api.get(resource.path, store.etag(resource.path))) {
            is Fetched.Body -> {
                // Stored under the tag the list gave, not the response header: a proxy that compresses
                // may rewrite the header to a weak tag (W/"…"), which would never equal the list's and
                // would make every sync fetch everything. If the data moved on between the list and
                // this GET, the next list shows a different tag and the resource is simply asked for again.
                store.put(resource.path, got.text, resource.etag, now())
                _changed.emit(resource.path)
            }
            Fetched.NotModified -> Unit
        }
    }
}
