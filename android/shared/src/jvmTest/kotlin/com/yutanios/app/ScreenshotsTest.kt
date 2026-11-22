package com.yutanios.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import androidx.compose.ui.use
import com.yutanios.app.model.Paths
import com.yutanios.app.screens.AssetsScreen
import com.yutanios.app.screens.ClonesScreen
import com.yutanios.app.screens.OverviewScreen
import com.yutanios.app.screens.ShipDetailScreen
import com.yutanios.app.screens.ShipsScreen
import com.yutanios.app.screens.SkillsScreen
import com.yutanios.app.screens.WalletScreen
import com.yutanios.app.ui.Section
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.jetbrains.skia.EncodedImageFormat
import java.io.File
import kotlin.test.Test

/**
 * Not a test of behaviour: with `-Pshots=<dir>` it draws every screen from the contract fixtures
 * into PNGs at phone width, off screen, so a screen can be checked by eye on a machine with no
 * display and no emulator. Without the property it does nothing.
 */
class ScreenshotsTest {
    private val out = System.getProperty("shots").orEmpty()
    private val character = 9000001L

    @Test fun renderEveryScreen() {
        if (out.isEmpty()) return
        File(out).mkdirs()
        shot("overview", Section.Overview) { OverviewScreen() }
        shot("skills", Section.Skills) { SkillsScreen(character) }
        shot("clones", Section.Clones) { ClonesScreen(character) }
        shot("assets", Section.Assets) { AssetsScreen(character) }
        shot("wallet", Section.Wallet) { WalletScreen(character) }
        shot("ships", Section.Ships) { ShipsScreen(character, {}, {}) }
        shot("ship-asset", Section.Ships) { ShipDetailScreen(Paths.shipAsset(character, 1040000000001), {}) }
        shot("ship-fit", Section.Ships) { ShipDetailScreen(Paths.shipFit(character, 7001), {}) }
    }

    private fun shot(name: String, section: Section, heightDp: Int = 4000, screen: @Composable () -> Unit) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val app = Fixtures.app(scope)
        try {
            ImageComposeScene(width = 390 * 2, height = heightDp * 2, density = Density(2f)) {
                AppFrame(app) { SectionFrame(section, {}) { screen() } }
            }.use { scene ->
                // The copy is read off the main thread; give it a few frames to arrive and settle.
                repeat(40) { frame -> scene.render(frame * 16_000_000L); Thread.sleep(25) }
                val png = scene.render(41 * 16_000_000L).encodeToData(EncodedImageFormat.PNG)!!.bytes
                // Cut into phone-height tiles and drop the ones with nothing on them, so each is readable.
                val whole = javax.imageio.ImageIO.read(png.inputStream())
                val tile = 800 * 2
                File(out).listFiles { f -> f.name.startsWith("$name-") }?.forEach { it.delete() }
                for (i in 0 until whole.height / tile) {
                    val part = whole.getSubimage(0, i * tile, whole.width, tile)
                    val ground = part.getRGB(4, tile - 4)
                    val blank = (0 until tile step 8).all { y -> (0 until part.width step 8).all { x -> part.getRGB(x, y) == ground } }
                    if (!blank || i == 0) javax.imageio.ImageIO.write(part, "png", File(out, "$name-${i + 1}.png"))
                }
            }
        } finally {
            scope.cancel()
        }
    }
}
