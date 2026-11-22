package com.yutanios.app

import com.yutanios.app.screens.AssetsScreen
import com.yutanios.app.ui.Section
import kotlin.test.Test

/**
 * The Assets states the default render does not show: locations open, and a filter applied.
 * Underscores in the names: the "assets" shot clears every file starting "assets-" before it writes.
 */
class AssetsShotsTest {
    @Test fun renderAssetsStates() {
        if (!Shots.wanted) return
        // Drawn twice: the first shot of a cold JVM is taken before the copy has been read, and comes out blank.
        repeat(2) { Shots.shot("assets_search", Section.Assets) { AssetsScreen(9000001, initialQuery = "hobgoblin") } }
        Shots.shot("assets_expanded", Section.Assets) { AssetsScreen(9000001, initiallyExpandAll = true) }
    }
}
