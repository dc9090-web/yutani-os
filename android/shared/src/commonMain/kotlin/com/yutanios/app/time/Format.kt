package com.yutanios.app.time

import kotlin.math.floor
import kotlin.time.Instant

/**
 * The one piece of the site's view logic the app carries: anything worked out against "now".
 * The copy on the phone can be hours old, so countdowns, progress and "x ago" are recomputed here
 * from the raw times the API sends. Each function mirrors its namesake in the site's
 * `src/lib/view/format.ts` case for case; the tests are the site's cases.
 */

private const val MINUTE = 60_000L
private const val HOUR = 60 * MINUTE
private const val DAY = 24 * HOUR

/** Epoch milliseconds of an ISO-8601 time from the API; null for null or unreadable. */
fun epochMs(iso: String?): Long? = iso?.let { runCatching { Instant.parse(it).toEpochMilliseconds() }.getOrNull() }

/** "5d 13h 20m": a training span. Minutes are two digits once a larger unit precedes them. */
fun duration(ms: Long): String {
    if (ms <= 0) return "0m"
    val minutes = floor(ms.toDouble() / MINUTE + 0.5).toLong()
    if (minutes == 0L) return "< 1m"
    val days = minutes / 1440
    val hours = (minutes % 1440) / 60
    val rest = minutes % 60
    val parts = mutableListOf<String>()
    if (days > 0) parts += "${days}d"
    if (hours > 0) parts += "${hours}h"
    if (rest > 0 || parts.isEmpty()) parts += (if (parts.isNotEmpty()) rest.toString().padStart(2, '0') else rest.toString()) + "m"
    return parts.joinToString(" ")
}

/** "3d 12h 09m 41s": the live queue countdown, the only place seconds are shown. */
fun countdown(ms: Long): String {
    if (ms <= 0) return "Queue complete"
    val total = ms / 1000
    return "${total / 86400}d ${(total % 86400) / 3600}h ${(total % 3600) / 60}m ${total % 60}s"
}

private fun span(ms: Long): String {
    if (ms < HOUR) return "${ms / MINUTE} m"
    if (ms < DAY) {
        val hours = ms / HOUR
        val minutes = (ms % HOUR) / MINUTE
        return if (minutes == 0L) "$hours h" else "$hours h $minutes m"
    }
    val days = ms / DAY
    return if (days == 1L) "1 day" else "$days days"
}

/** "in 3 h 12 m" / "2 days ago" / "just now" / "never". */
fun relativeTime(at: Long?, now: Long): String {
    if (at == null) return "never"
    val delta = at - now
    val magnitude = if (delta < 0) -delta else delta
    if (magnitude < MINUTE) return "just now"
    return if (delta > 0) "in ${span(magnitude)}" else "${span(magnitude)} ago"
}

/**
 * 0–1 progress of a queue entry through its level. With ESI's SP bounds it is the share of the
 * level's SP; without them it falls back to the wall clock over this stint. No dates (paused) is 0.
 */
fun queueProgress(start: Long?, finish: Long?, levelStartSp: Long?, levelEndSp: Long?, trainingStartSp: Long?, now: Long): Double {
    if (start == null || finish == null) return 0.0
    val window = finish - start
    if (window <= 0) return 1.0
    val stint = ((now - start).toDouble() / window).coerceIn(0.0, 1.0)
    if (levelStartSp == null || levelEndSp == null || trainingStartSp == null || levelEndSp <= levelStartSp) return stint
    val sp = trainingStartSp + stint * (levelEndSp - trainingStartSp)
    return ((sp - levelStartSp) / (levelEndSp - levelStartSp)).coerceIn(0.0, 1.0)
}

private val ROMAN = listOf("", "I", "II", "III", "IV", "V")
fun roman(level: Int): String = ROMAN.getOrNull(level) ?: level.toString()
