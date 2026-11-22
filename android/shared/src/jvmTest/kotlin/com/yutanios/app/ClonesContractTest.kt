package com.yutanios.app

import com.yutanios.app.model.Clones
import com.yutanios.app.model.Paths
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ClonesContractTest {
    private fun clones(id: Long) = Fixtures.decode(Paths.clones(id), Clones.serializer())

    @Test fun richCharacter() {
        val c = clones(9000001)
        assertTrue(c.synced)
        assertEquals("Jita IV - Moon 4 - Caldari Navy Assembly Plant", c.home?.name)
        assertEquals("station", c.home?.kind)
        assertEquals("sec-high", c.home?.system?.secClass)
        assertEquals(6, c.active.used)
        assertEquals(listOf(true, true, true, true, true, true, false, false, false, false), c.active.slots)
        assertEquals("+4 Perception", c.active.implants[0].bonus)
        assertEquals(1, c.active.implants[0].slot)
        assertNull(c.active.implants[5].bonus)
        assertTrue(c.active.implants[5].desc!!.endsWith("3% bonus to CPU output."))
        assertEquals("2026-03-13T17:20:00.000Z", c.lastCloneJumpAt)

        assertEquals(listOf("Perimeter", "Jita"), c.locations.map { it.title })
        val perimeter = c.locations[0]
        assertEquals("1035000000001", perimeter.key)
        assertEquals("Perimeter - Example Trade Tower", perimeter.station)
        assertEquals("0.9", perimeter.system?.sec)
        assertEquals(listOf("JC 02", "JC 03"), perimeter.clones.map { it.code })
        assertNull(perimeter.clones[0].name)
        assertTrue(perimeter.clones[0].implants.isEmpty())
        assertEquals("Empty spare", perimeter.clones[1].name)
        // Slot six alone is taken: the strip fills by position.
        assertEquals(5, perimeter.clones[1].slots.indexOf(true))
        assertEquals(8001L, c.locations[1].clones.single().jumpCloneId)
        assertEquals(2, c.locations[1].clones.single().used)
    }

    @Test fun unsyncedCharacters() {
        for (id in listOf(9000002L, 9000003L)) {
            val c = clones(id)
            assertFalse(c.synced)
            assertNull(c.home)
            assertNull(c.lastCloneJumpAt)
            assertTrue(c.locations.isEmpty())
            assertEquals(0, c.active.used)
            assertEquals(10, c.active.slots.size)
            assertTrue(c.active.slots.none { it })
        }
    }
}
