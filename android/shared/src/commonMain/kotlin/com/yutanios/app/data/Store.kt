package com.yutanios.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okio.ByteString.Companion.encodeUtf8
import okio.FileSystem
import okio.Path

@Serializable data class StoredEntry(val etag: String?, val file: String, val fetchedAt: Long)

@Serializable
data class StoreIndex(
    val entries: Map<String, StoredEntry> = emptyMap(),
    /** When the phone last finished a full sync, in epoch milliseconds. */
    val lastSuccessAt: Long? = null,
    /** True when the most recent attempt could not reach the site. */
    val lastAttemptFailed: Boolean = false,
    val activeCharacterId: Long? = null,
)

/**
 * The copy of the site on the phone: one file per API path, and an index of their tags.
 * Screens read only from here; the network only ever writes here.
 */
class Store(private val fs: FileSystem, private val dir: Path) {
    private val mutex = Mutex()
    private val indexPath = dir / "index.json"
    private val _index = MutableStateFlow(StoreIndex())
    private var loaded = false
    val index: StateFlow<StoreIndex> = _index

    suspend fun open(): StoreIndex = edit { it }

    suspend fun read(path: String): String? = withContext(Dispatchers.IO) {
        val entry = open().entries[path] ?: return@withContext null
        val file = dir / entry.file
        // A missing file behind an index entry means a cleared cache; treat it as never fetched.
        if (fs.exists(file)) fs.read(file) { readUtf8() } else null
    }

    suspend fun etag(path: String): String? = open().entries[path]?.etag

    suspend fun put(path: String, text: String, etag: String?, now: Long) {
        val name = path.encodeUtf8().sha256().hex().take(32) + ".json"
        open() // makes sure the folder is there
        withContext(Dispatchers.IO) { writeAtomically(dir / name, text) }
        edit { it.copy(entries = it.entries + (path to StoredEntry(etag, name, now))) }
    }

    /** Drops everything the site no longer lists (a sold ship, a removed character). Returns what went. */
    suspend fun retain(paths: Set<String>): Set<String> {
        var gone = emptySet<String>()
        edit { index ->
            gone = index.entries.keys - paths
            gone.forEach { fs.delete(dir / index.entries.getValue(it).file, mustExist = false) }
            index.copy(entries = index.entries - gone)
        }
        return gone
    }

    suspend fun markSync(success: Boolean, now: Long) =
        edit { it.copy(lastSuccessAt = if (success) now else it.lastSuccessAt, lastAttemptFailed = !success) }.let {}

    suspend fun setActiveCharacter(id: Long?) = edit { it.copy(activeCharacterId = id) }.let {}

    suspend fun clear() = mutex.withLock {
        withContext(Dispatchers.IO) { fs.deleteRecursively(dir, mustExist = false) }
        loaded = true
        _index.value = StoreIndex()
    }

    private suspend fun edit(change: (StoreIndex) -> StoreIndex): StoreIndex = mutex.withLock {
        withContext(Dispatchers.IO) {
            if (!loaded) {
                fs.createDirectories(dir)
                _index.value = if (fs.exists(indexPath)) {
                    runCatching { AppJson.decodeFromString(StoreIndex.serializer(), fs.read(indexPath) { readUtf8() }) }
                        .getOrDefault(StoreIndex())
                } else StoreIndex()
                loaded = true
            }
            val before = _index.value
            val after = change(before)
            if (after != before) {
                fs.createDirectories(dir)
                writeAtomically(indexPath, AppJson.encodeToString(StoreIndex.serializer(), after))
                _index.value = after
            }
            after
        }
    }

    // Write beside the target and rename over it, so a kill mid-write never leaves half a file.
    private fun writeAtomically(target: Path, text: String) {
        val tmp = dir / (target.name + ".tmp")
        fs.write(tmp) { writeUtf8(text) }
        fs.atomicMove(tmp, target)
    }
}
