package com.yutanios.app

import com.yutanios.app.data.AppJson
import com.yutanios.app.model.Paths
import com.yutanios.app.model.ShipDetail
import com.yutanios.app.model.Ships
import com.yutanios.app.screens.placeName
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The Ships and ship-detail models against the site's contract fixtures. */
class ShipsContractTest {
    private fun ships(id: Long) = Fixtures.decode(Paths.ships(id), Ships.serializer())
    private fun sheet(path: String) = Fixtures.decode(path, ShipDetail.serializer())

    @Test fun shipsOfTheRichCharacter() {
        val data = ships(9000001)
        assertTrue(data.skillsSynced)
        assertEquals(listOf("asset:1040000000001", "asset:1040000000050"), data.ships.map { it.key })
        assertEquals(listOf("fit:7001", "fit:7002"), data.fits.map { it.key })

        val tristan = data.ships[0]
        assertEquals(1040000000001, tristan.assetId)
        assertNull(tristan.fitId)
        assertEquals("Paper Kite", tristan.name)
        assertEquals("Tristan", tristan.typeName)
        assertEquals(593, tristan.typeId)
        assertEquals("0.9", tristan.system?.sec)
        assertEquals("sec-high", tristan.system?.secClass)
        assertEquals("176.2", tristan.stats?.dps)
        assertEquals("Lasts 56s", tristan.stats?.cap)
        assertEquals(false, tristan.stats?.capOk)
        assertEquals("AB", tristan.stats?.propKind)
        assertTrue(tristan.cpu!!.over)
        assertEquals("174.00 / 167.38 tf", tristan.cpu!!.text)
        assertEquals(91.9, tristan.power!!.percent)
        assertEquals(1, tristan.missingSkills)
        assertEquals("27.2M ISK", tristan.value)
        assertEquals("1 item unpriced", tristan.unpriced)
        assertEquals(1, tristan.mastery)
        assertNull(tristan.error)
        assertEquals(listOf(2, 1, 1), tristan.weapons.map { it.count })
        assertEquals("Void S", tristan.weapons[0].charge)
        assertNull(tristan.weapons[1].charge)
        assertEquals("range 9.0 km", tristan.weapons[1].range)

        val rifter = data.ships[1]
        assertNull(rifter.stats?.propKind)
        assertEquals(true, rifter.stats?.capOk)
        assertNull(rifter.unpriced)

        val fit = data.fits[0]
        assertEquals(7001, fit.fitId)
        assertNull(fit.assetId)
        assertNull(fit.system)
        assertEquals("Saved fit", fit.location)
    }

    @Test fun shipsOfTheSparseAndTheEmptyCharacter() {
        for (id in listOf(9000002L, 9000003L)) {
            val data = ships(id)
            assertTrue(data.ships.isEmpty(), "$id")
            assertTrue(data.fits.isEmpty(), "$id")
        }
    }

    @Test fun anOwnedShipsSheet() {
        val detail = sheet(Paths.shipAsset(9000001, 1040000000001))
        assertEquals("ok", detail.kind)
        assertNull(detail.title)
        val view = assertNotNull(detail.view)
        assertEquals("Paper Kite", view.title)
        assertEquals("Tristan", view.typeName)
        assertEquals("Frigate", view.ship.groupName)
        assertEquals("Jita", view.location.system?.name)
        assertNull(view.location.note)
        assertEquals(1, view.mastery)
        assertEquals("bad", view.key.capacitor.tone)
        assertNull(view.key.ehp.unit)
        assertEquals("m/s", view.key.speed.unit)
        assertEquals(95.21351851851853, view.weapons.dps)

        val control = assertNotNull(view.droneControl)
        assertEquals(25.0, control.bandwidth)
        assertEquals(5, control.maxActive)
        assertEquals(mapOf(2456L to 5), control.opening)
        assertEquals(listOf(5, 3), control.types.map { it.inBay })
        assertEquals("40 / 40 m³", control.bay)

        assertEquals(false, view.stats.capacitor.ok)
        assertEquals(listOf("Shield", "Armor", "Hull"), view.stats.defense.layers.map { it.layer })
        assertEquals(listOf(13, 30, 48, 56), view.stats.defense.layers[0].resists)
        assertEquals("625 s", view.stats.defense.layers[0].note)
        assertNull(view.stats.defense.layers[1].note)
        assertEquals("3,242 ehp", view.stats.defense.headline)
        assertEquals(3, view.gauges.size)
        assertEquals(7, view.counters.size)

        assertEquals(listOf("high", "mid", "low", "rig", "subsystem"), view.slots.map { it.slot })
        val blaster = view.slots[0].rows[0]
        assertEquals(2, blaster.quantity)
        assertEquals("Void S", blaster.charge)
        assertFalse(blaster.chargeAssumed)
        assertEquals("Active", blaster.state)
        assertEquals("1.6 km", blaster.range?.optimal)
        assertNull(view.slots[1].rows[0].range)
        assertNull(view.slots[1].rows[1].range?.falloff)
        assertEquals("9.0 km", view.slots[1].rows[1].range?.optimal)
        assertEquals(0, view.slots[4].total)

        assertEquals(listOf("cpu", "skill"), view.problems.map { it.kind })
        assertEquals(listOf(0 to 1), view.missing.map { it.have to it.need })
        assertEquals(listOf("thermal", "kinetic"), view.ammo[0].damage?.types?.map { it.kind })
        assertEquals("Short", view.ammo[0].band?.label)
        assertEquals("95.2", view.ammo[0].dps)
        assertEquals("Overheat repair", view.consumables.single().effect)
        assertNull(view.consumables.single().use)
        assertEquals(2000, view.cargo[0].quantity)
        assertNull(view.cargo[0].nickname)
        assertEquals("4,600,000.00 ISK", view.drones[0].value)
        assertTrue(view.unknown.isEmpty() && view.unfittable.isEmpty())
        assertEquals("27,193,721.00 ISK", view.value.total)
        assertEquals("1 item unpriced", view.value.unpriced)
        assertEquals(listOf("Ship and bonuses", "Modules", "Drones"), view.skillGaps.map { it.name })
        assertEquals(4, view.skillGaps[0].skills[0].level)
        assertEquals(5, view.bonuses[0].level)
    }

    @Test fun aHullWithNoDroneBayAndASavedFit() {
        val rifter = assertNotNull(sheet(Paths.shipAsset(9000001, 1040000000050)).view)
        assertNull(rifter.droneControl)
        assertNull(rifter.key.speed.note)
        assertEquals("good", rifter.key.capacitor.tone)
        assertTrue(rifter.consumables.isEmpty())
        assertTrue(rifter.repairs[1].idle)

        val saved = assertNotNull(sheet(Paths.shipFit(9000001, 7001)).view)
        assertNull(saved.location.system)
        assertNull(saved.location.place)
        assertEquals("Saved fit", saved.location.note)
        assertTrue(saved.slots[0].rows[0].chargeAssumed)
        assertEquals("2 weapons loaded with the best ammo in cargo", saved.stats.offense.note)
        assertNull(assertNotNull(sheet(Paths.shipFit(9000001, 7002)).view).droneControl)
    }

    /** No fixture carries the error shape, so this is the README's own example of it. */
    @Test fun aFitTheSiteCouldNotCompute() {
        val detail = AppJson.decodeFromString(ShipDetail.serializer(), """{"kind":"error","title":"Paper Kite"}""")
        assertEquals("error", detail.kind)
        assertEquals("Paper Kite", detail.title)
        assertNull(detail.view)
    }

    @Test fun aPlaceNamesItsSystemOnlyWhenItsOwnNameDoesNot() {
        assertEquals("Jita IV - Moon 4", placeName("Jita IV - Moon 4", "Jita"))
        assertEquals("Jita", placeName("Jita", "Jita"))
        assertEquals("Perimeter · Example Trade Tower", placeName("Example Trade Tower", "Perimeter"))
        assertEquals("Saved fit", placeName("Saved fit", null))
    }
}
