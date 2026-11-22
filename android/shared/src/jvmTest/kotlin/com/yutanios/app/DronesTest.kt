package com.yutanios.app

import com.yutanios.app.model.DroneLimits
import com.yutanios.app.model.DroneOption
import com.yutanios.app.model.LaunchedTotals
import com.yutanios.app.model.Paths
import com.yutanios.app.model.ShipDetail
import com.yutanios.app.model.dpsText
import com.yutanios.app.model.fixed1
import com.yutanios.app.model.grouped
import com.yutanios.app.model.launchedSummary
import com.yutanios.app.model.launchedTotals
import com.yutanios.app.model.offenseNow
import com.yutanios.app.model.plainNumber
import com.yutanios.app.model.roomFor
import com.yutanios.app.model.volleyText
import kotlin.test.Test
import kotlin.test.assertEquals

/** The site's cases for `src/lib/view/drones.ts` (tests/view/ship-detail.test.ts, "drone selector arithmetic"). */
class DronesTest {
    private val heavy = DroneOption(typeId = 1, name = "Heavy", inBay = 3, bandwidth = 25.0, dpsEach = 50.0, volleyEach = 200.0)
    private val light = DroneOption(typeId = 2, name = "Light", inBay = 5, bandwidth = 5.0, dpsEach = 20.0, volleyEach = 60.0)
    private val limits = DroneLimits(listOf(heavy, light), bandwidth = 60.0, maxActive = 5)

    @Test fun totalsASelection() {
        assertEquals(LaunchedTotals(dps = 140.0, volley = 520.0, active = 4, bandwidthUsed = 60.0), launchedTotals(limits, mapOf(1L to 2, 2L to 2)))
        assertEquals(LaunchedTotals(0.0, 0.0, 0, 0.0), launchedTotals(limits, emptyMap()))
    }

    @Test fun neverCountsMoreThanTheBayHolds() {
        assertEquals(3, launchedTotals(limits.copy(bandwidth = 1000.0, maxActive = null), mapOf(1L to 9)).active)
    }

    @Test fun limitsATypeByTheBayTheBandwidthLeftAndTheControlLimit() {
        assertEquals(2, roomFor(limits, emptyMap(), heavy))                    // bandwidth
        assertEquals(2, roomFor(limits, mapOf(1L to 2), light))                // bandwidth
        assertEquals(1, roomFor(limits, mapOf(2L to 4), light))                // bay and control limit
        assertEquals(0, roomFor(limits, mapOf(2L to 5), heavy))                // control limit
        assertEquals(3, roomFor(limits.copy(maxActive = null, bandwidth = 1000.0), emptyMap(), heavy))   // bay
    }

    @Test fun aDroneThatNeedsNoBandwidthIsNotLimitedByIt() {
        val free = heavy.copy(bandwidth = 0.0)
        assertEquals(3, roomFor(DroneLimits(listOf(free), bandwidth = 0.0, maxActive = null), emptyMap(), free))
    }

    @Test fun summarisesWhatIsOut() {
        assertEquals("2× Heavy, 1× Light", launchedSummary(limits, mapOf(1L to 2, 2L to 1)))
        assertEquals("No drones launched", launchedSummary(limits, mapOf(1L to 0)))
    }

    @Test fun printsFiguresAsTheSiteDoes() {
        assertEquals("1,234,567.89", grouped("1234567.89"))
        assertEquals("-1,000", grouped("-1000"))
        assertEquals("999", grouped("999"))
        assertEquals("16.2", fixed1(16.1952))
        assertEquals("0.0", fixed1(0.0))
        assertEquals("1,234.5", dpsText(1234.46))
        assertEquals("551", volleyText(550.6))
        assertEquals("1,200", volleyText(1199.5))
        assertEquals("25", plainNumber(25.0))
        assertEquals("12.5", plainNumber(12.5))
        assertEquals("1,250", plainNumber(1250.0))
    }

    /** The site prints the same sums for the selection the sheet opens with; the phone's must agree to the digit. */
    @Test fun agreesWithTheSitesOwnFiguresForTheOpeningSelection() {
        for (path in listOf(Paths.shipAsset(9000001, 1040000000001), Paths.shipFit(9000001, 7001), Paths.shipAsset(9000001, 1040000000050), Paths.shipFit(9000001, 7002))) {
            val view = Fixtures.decode(path, ShipDetail.serializer()).view!!
            val control = view.droneControl
            val now = offenseNow(view.weapons.dps, view.weapons.volley, control?.limits, control?.opening ?: emptyMap())
            val site = view.stats.offense
            assertEquals(site.headline, "${dpsText(now.totalDps)} dps", path)
            assertEquals(site.rows.first { it.label == "Weapons" }.value, "${dpsText(now.weaponDps)} dps", path)
            assertEquals(site.rows.first { it.label == "Drones" }.value, if (now.droneDps > 0) "${dpsText(now.droneDps)} dps" else "—", path)
            assertEquals(site.rows.first { it.label == "Volley" }.value, "${volleyText(now.volley)} HP", path)
        }
    }

    @Test fun aDifferentSelectionMovesTheTotals() {
        val view = Fixtures.decode(Paths.shipAsset(9000001, 1040000000001), ShipDetail.serializer()).view!!
        val control = view.droneControl!!
        val hobgoblin = control.types.first { it.name == "Hobgoblin II" }
        val warrior = control.types.first { it.name == "Warrior II" }
        // The sheet opens with all five Hobgoblins out: bandwidth and control are both spent.
        assertEquals(mapOf(hobgoblin.typeId to 5), control.opening)
        assertEquals(0, roomFor(control.limits, control.opening, warrior))

        val mixed = mapOf(hobgoblin.typeId to 2, warrior.typeId to 3)
        val now = offenseNow(view.weapons.dps, view.weapons.volley, control.limits, mixed)
        assertEquals("71.9", dpsText(now.droneDps))
        assertEquals("167.1", dpsText(now.totalDps))
        assertEquals("514", volleyText(now.volley))
        assertEquals(5, now.active)
        assertEquals("2× Hobgoblin II, 3× Warrior II", launchedSummary(control.limits, mixed))
        assertEquals(0, roomFor(control.limits, mixed, hobgoblin))
        assertEquals(3, roomFor(control.limits, emptyMap(), warrior))
    }
}
