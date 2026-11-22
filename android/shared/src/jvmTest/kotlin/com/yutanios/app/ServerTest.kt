package com.yutanios.app

import com.yutanios.app.model.Paths
import com.yutanios.app.model.Server
import com.yutanios.app.model.ServerStatus
import com.yutanios.app.model.playersLabel
import com.yutanios.app.time.epochMs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ServerTest {
    private val read = epochMs("2026-03-14T11:57:00.000Z")!!
    private val minute = 60_000L

    @Test fun decodesTheFixture() {
        val server = Fixtures.decode(Paths.SERVER, Server.serializer())
        assertEquals(ServerStatus(23456, "23,456", "2026-03-14T11:57:00.000Z"), server.status)
        assertEquals("23,456", playersLabel(server, Fixtures.now))
    }

    @Test fun showsTheCountAsOfTheLastSync() {
        val server = Server(ServerStatus(23456, "23,456", "2026-03-14T11:57:00.000Z"))
        assertEquals("23,456", playersLabel(server, read + 3 * minute))
        assertEquals("23,456", playersLabel(server, read + 20 * minute))
    }

    @Test fun hidesACountThatWasAlreadyStaleWhenThePhoneSynced() {
        val server = Server(ServerStatus(23456, "23,456", "2026-03-14T11:57:00.000Z"))
        assertNull(playersLabel(server, read + 21 * minute))
    }

    @Test fun showsNothingWithoutACountOrASync() {
        assertNull(playersLabel(null, read))
        assertNull(playersLabel(Server(null), read))
        assertNull(playersLabel(Server(ServerStatus(5, "5", "2026-03-14T11:57:00.000Z")), null))
        assertNull(playersLabel(Server(ServerStatus(5, "5", null)), read))
    }
}
