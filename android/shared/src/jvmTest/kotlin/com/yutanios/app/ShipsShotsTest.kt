package com.yutanios.app

import com.yutanios.app.model.Paths
import com.yutanios.app.screens.ShipDetailScreen
import com.yutanios.app.screens.ShipsScreen
import com.yutanios.app.ui.Section
import kotlin.test.Test

/** The states of the Ships screens that the default renders do not show. Draws only with `-Pshots=<dir>`. */
class ShipsShotsTest {
    private val character = 9000001L

    @Test fun savedFitsTab() {
        if (!Shots.wanted) return
        Shots.shot("ships-saved", Section.Ships) { ShipsScreen(character, {}, {}, initialTab = 1) }
    }

    @Test fun modulesStripOpen() {
        if (!Shots.wanted) return
        Shots.shot("ships-modules", Section.Ships) { ShipsScreen(character, {}, {}, initialOpen = setOf("asset:1040000000001")) }
    }

    @Test fun noShips() {
        if (!Shots.wanted) return
        Shots.shot("ships-empty", Section.Ships) { ShipsScreen(9000002L, {}, {}) }
    }

    /** Two Hobgoblins and three Warriors out instead of the five Hobgoblins the sheet opens with; tall enough to reach the foot. */
    @Test fun aDifferentDroneSelection() {
        if (!Shots.wanted) return
        Shots.shot("ship-asset-drones", Section.Ships, heightDp = 8800) {
            ShipDetailScreen(Paths.shipAsset(character, 1040000000001), {}, initialLaunched = mapOf(2456L to 2, 2488L to 3))
        }
    }

    @Test fun aHullWithNoDroneBay() {
        if (!Shots.wanted) return
        Shots.shot("ship-fit-rifter", Section.Ships, heightDp = 8800) { ShipDetailScreen(Paths.shipFit(character, 7002), {}) }
    }
}
