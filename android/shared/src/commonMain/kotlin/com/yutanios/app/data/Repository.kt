package com.yutanios.app.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onSubscription
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable

/** Every response from the read API. */
@Serializable data class Envelope<T>(val data: T, val generatedAt: String)

/** A resource as a screen sees it: the data, and when the phone last fetched it. */
data class Loaded<T>(val data: T, val generatedAt: String, val fetchedAt: Long)

class Repository(private val store: Store, private val engine: SyncEngine, private val api: ApiClient) {
    /** The stored copy of `path`, again each time a sync rewrites it. `null` while the phone has none. */
    fun <T> observe(path: String, serializer: KSerializer<T>): Flow<Loaded<T>?> =
        engine.changed.onSubscription { emit(path) }.filter { it == path }.map { load(path, serializer) }.distinctUntilChanged()

    suspend fun <T> load(path: String, serializer: KSerializer<T>): Loaded<T>? {
        val text = store.read(path) ?: return null
        val fetchedAt = store.index.value.entries[path]?.fetchedAt ?: 0
        // A copy written by an older app version that no longer decodes is treated as missing.
        return runCatching { AppJson.decodeFromString(Envelope.serializer(serializer), text) }
            .map { Loaded(it.data, it.generatedAt, fetchedAt) }.getOrNull()
    }

    /** For the few things the phone does not keep (older wallet rows): straight from the site. */
    suspend fun <T> fetchOnce(path: String, serializer: KSerializer<T>): T =
        AppJson.decodeFromString(Envelope.serializer(serializer), (api.get(path) as Fetched.Body).text).data
}
