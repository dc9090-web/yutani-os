package com.yutanios.app.model

import com.yutanios.app.time.epochMs
import kotlinx.serialization.Serializable

/** `GET /api/v1/server`: how many pilots are logged in to Tranquility. `status` is null when the site has no count. */
@Serializable data class Server(val status: ServerStatus? = null)

/** `label` is the count as the site writes it ("23,456"); `at` is when the site read it from ESI. */
@Serializable data class ServerStatus(val players: Int = 0, val label: String = "", val at: String? = null)

/** The site reads the count every five minutes; older than this at the last sync, it was already out of date. */
const val SERVER_STATUS_MAX_AGE_MS = 20 * 60 * 1000L

/**
 * The count to show beside "as of <last sync>", or null. It is judged against the last successful
 * sync, not against now: offline, the strip already says how old the whole copy is, and the count
 * is as old as that. But a count that was stale when the phone last synced (the site's job had
 * been failing, or Tranquility was down) is not shown at all.
 */
fun playersLabel(server: Server?, lastSuccessAt: Long?): String? {
    val status = server?.status ?: return null
    val at = epochMs(status.at) ?: return null
    if (lastSuccessAt == null || lastSuccessAt - at > SERVER_STATUS_MAX_AGE_MS) return null
    return status.label.ifBlank { null }
}
