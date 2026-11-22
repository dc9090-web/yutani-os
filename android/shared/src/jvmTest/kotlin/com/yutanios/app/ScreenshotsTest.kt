package com.yutanios.app

import com.yutanios.app.model.Paths
import com.yutanios.app.screens.AssetsScreen
import com.yutanios.app.screens.ClonesScreen
import com.yutanios.app.screens.OverviewScreen
import com.yutanios.app.screens.ShipDetailScreen
import com.yutanios.app.screens.ShipsScreen
import com.yutanios.app.screens.SkillsScreen
import com.yutanios.app.screens.WalletScreen
import com.yutanios.app.ui.Section
import kotlin.test.Test

/**
 * Not a test of behaviour: with `-Pshots=<dir>` it draws every screen from the contract fixtures
 * into PNGs at phone width, off screen, so a screen can be checked by eye on a machine with no
 * display and no emulator. Without the property it does nothing.
 */
class ScreenshotsTest {
    private val character = 9000001L

    @Test fun renderEveryScreen() {
        if (!Shots.wanted) return
        Shots.shot("overview", Section.Overview) { OverviewScreen() }
        Shots.shot("skills", Section.Skills) { SkillsScreen(character) }
        Shots.shot("clones", Section.Clones) { ClonesScreen(character) }
        Shots.shot("assets", Section.Assets) { AssetsScreen(character) }
        Shots.shot("wallet", Section.Wallet) { WalletScreen(character) }
        Shots.shot("ships", Section.Ships) { ShipsScreen(character, {}, {}) }
        Shots.shot("ship-asset", Section.Ships) { ShipDetailScreen(Paths.shipAsset(character, 1040000000001), {}) }
        Shots.shot("ship-fit", Section.Ships) { ShipDetailScreen(Paths.shipFit(character, 7001), {}) }
    }
}
