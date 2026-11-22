package com.yutanios.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import androidx.compose.ui.use
import com.yutanios.app.ui.Section
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.jetbrains.skia.EncodedImageFormat
import java.io.File

/**
 * Draws a screen from the contract fixtures into PNG tiles at phone width, off screen. Only when
 * the build is run with `-Pshots=<dir>`; otherwise [wanted] is false and callers return at once.
 * Each tile is 390x800dp at 2x; `<name>-1.png` is the top of the screen, `-2` the next 800dp, and so on.
 */
object Shots {
    private val out = System.getProperty("shots").orEmpty()
    val wanted: Boolean get() = out.isNotEmpty()

    fun shot(name: String, section: Section, heightDp: Int = 4000, screen: @Composable () -> Unit) {
        File(out).mkdirs()
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
                File(out).listFiles { f -> Regex("${Regex.escape(name)}-\\d+\\.png").matches(f.name) }?.forEach { it.delete() }
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
