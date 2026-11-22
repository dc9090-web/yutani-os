package com.yutanios.app.time

import kotlin.test.Test
import kotlin.test.assertEquals

class FormatTest {
    private val m = 60_000L
    private val h = 60 * m
    private val d = 24 * h

    @Test fun durationMatchesTheSite() {
        assertEquals("0m", duration(0))
        assertEquals("0m", duration(-5))
        assertEquals("< 1m", duration(20_000))
        assertEquals("1m", duration(30_000))
        assertEquals("42m", duration(42 * m))
        assertEquals("3h 12m", duration(3 * h + 12 * m))
        assertEquals("3h", duration(3 * h))
        assertEquals("1d 4h 09m", duration(d + 4 * h + 9 * m))
        assertEquals("5d 13h 20m", duration(5 * d + 13 * h + 20 * m))
        assertEquals("2d", duration(2 * d))
    }

    @Test fun countdownShowsSeconds() {
        assertEquals("Queue complete", countdown(0))
        assertEquals("3d 12h 9m 41s", countdown(3 * d + 12 * h + 9 * m + 41_000))
        assertEquals("0d 0h 0m 5s", countdown(5_999))
    }

    @Test fun relativeTimeMatchesTheSite() {
        val now = 1_000_000_000_000L
        assertEquals("never", relativeTime(null, now))
        assertEquals("just now", relativeTime(now - 59_000, now))
        assertEquals("42 m ago", relativeTime(now - 42 * m, now))
        assertEquals("in 3 h 12 m", relativeTime(now + 3 * h + 12 * m, now))
        assertEquals("3 h ago", relativeTime(now - 3 * h, now))
        assertEquals("1 day ago", relativeTime(now - d - 5 * h, now))
        assertEquals("2 days ago", relativeTime(now - 2 * d, now))
    }

    @Test fun progressUsesSpBoundsWhenPresent() {
        // 93% of the level was trained before this stint began; half way through the stint.
        assertEquals(0.965, queueProgress(0, 1000, 0, 1000, 930, 500), 1e-9)
        assertEquals(0.5, queueProgress(0, 1000, null, null, null, 500), 1e-9)
        assertEquals(0.0, queueProgress(null, null, 0, 1000, 930, 500), 1e-9)
        assertEquals(1.0, queueProgress(0, 1000, 0, 1000, 930, 5000), 1e-9)
        assertEquals(1.0, queueProgress(10, 10, null, null, null, 5), 1e-9)
    }

    @Test fun readsIsoTimes() {
        assertEquals(0L, epochMs("1970-01-01T00:00:00Z"))
        assertEquals(1_000L, epochMs("1970-01-01T00:00:01.000Z"))
        assertEquals(null, epochMs(null))
        assertEquals(null, epochMs("soon"))
    }
}
