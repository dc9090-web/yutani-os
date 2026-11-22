package com.yutanios.app

import com.yutanios.app.model.AssetsData
import com.yutanios.app.model.Paths
import com.yutanios.app.screens.locationContents
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AssetsContractTest {
    private fun assets(id: Long) = Fixtures.decode(Paths.assets(id), AssetsData.serializer())

    @Test fun richCharacterDecodesWithItsTree() {
        val data = assets(9000001)
        assertEquals(29, data.itemCount)
        assertEquals(listOf(60003760L, 1035000000001L), data.locations.map { it.locationId })
        val jita = data.locations[0]
        assertEquals("Jita IV - Moon 4 - Caldari Navy Assembly Plant", jita.label)
        assertEquals(24, jita.itemCount)
        assertEquals(39752.26, jita.volume)
        assertEquals("0.9", jita.system?.sec)
        assertEquals("sec-high", jita.system?.secClass)

        val tristan = jita.nodes[0]
        assertEquals(1040000000001L, tristan.itemId)
        assertEquals("Tristan", tristan.typeName)
        assertEquals("Paper Kite", tristan.name)
        assertEquals(18, tristan.children.size)
        val charge = tristan.children.first { it.itemId == 1040000000003L }
        assertEquals("High slot 1", charge.flag)
        assertEquals("HiSlot0", charge.rawFlag)
        assertTrue(charge.isCharge)
        assertEquals(120, charge.quantity)
        assertNull(charge.name)

        val blueprint = jita.nodes.first { it.typeId == 940L }
        assertTrue(blueprint.isBlueprintCopy)
        assertEquals("https://images.evetech.net/types/940/bpc?size=32", blueprint.iconUrl)
        assertEquals(1_250_000, jita.nodes[1].children[0].quantity)
        assertTrue(data.descriptions.getValue("34").startsWith("The main building block"))
        assertNull(data.descriptions["940"])
    }

    @Test fun charactersWithNothingDecodeAsEmpty() {
        for (id in listOf(9000002L, 9000003L)) {
            val data = assets(id)
            assertEquals(0, data.itemCount)
            assertTrue(data.locations.isEmpty())
            assertTrue(data.descriptions.isEmpty())
        }
    }

    /** The arrangement the screen draws for the fixture's first station, as the site would draw it. */
    @Test fun fixtureGroupsAsTheSiteGroupsIt() {
        val contents = locationContents(assets(9000001).locations[0].nodes)
        assertEquals(listOf("Tristan", "Small Standard Container"), contents.holders.map { it.title })
        assertEquals("18 items inside: 10 fitted, 8 drones, 4 cargo stacks", contents.holders[0].summary)
        assertEquals(listOf("Fitted" to "10 items", "Drone bay" to "8 drones", "Cargo hold" to "4 stacks"), contents.holders[0].groups.map { it.name to it.count })
        assertEquals(listOf(2L, "Light Neutron Blaster II", "Void S loaded in each", "High 1–2"), contents.holders[0].groups[0].items[0].let { listOf(it.quantity, it.typeName, it.note, it.where) })
        assertEquals("2 items inside", contents.holders[1].summary)
        assertEquals(listOf("Hangar" to "2 stacks"), contents.loose.map { it.name to it.count })
    }
}
