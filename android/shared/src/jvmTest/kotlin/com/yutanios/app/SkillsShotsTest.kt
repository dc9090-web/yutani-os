package com.yutanios.app

import androidx.compose.runtime.Composable
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.unit.Density
import androidx.compose.ui.use
import com.yutanios.app.screens.SkillsScreen
import com.yutanios.app.screens.SkillsTab
import com.yutanios.app.ui.Section
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respondError
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import okio.Buffer
import okio.FileMetadata
import okio.FileSystem
import okio.ForwardingFileSystem
import okio.Path
import okio.Path.Companion.toPath
import okio.Source
import okio.fakefilesystem.FakeFileSystem
import org.jetbrains.skia.EncodedImageFormat
import java.io.File
import javax.imageio.ImageIO
import kotlin.test.Test

/** The three Skills tabs, drawn from the fixtures. Draws only with `-Pshots=<dir>`. */
class SkillsShotsTest {
    // Point this at 9000002 (paused, gaps) or 9000003 (nothing synced) to look at the empty states.
    private val character = 9000001L

    @Test fun renderEveryTab() {
        if (!Shots.wanted) return
        shot("skills-all") { SkillsScreen(character, initialTab = SkillsTab.OVERVIEW) }
        shot("skills-sheet") { SkillsScreen(character, initialTab = SkillsTab.SKILLS) }
        shot("skills-training") { SkillsScreen(character, initialTab = SkillsTab.TRAINING) }    }
}

/**
 * `FakeFileSystem` is not safe to read from two threads, and a per-character screen reads three
 * resources at once on `Dispatchers.IO`: under `Shots.shot` one of those reads dies and the tile
 * comes out blank. This lets one read through at a time.
 */
private class SerialFileSystem(delegate: FileSystem) : ForwardingFileSystem(delegate) {
    private val lock = Any()
    private fun whole(file: Path): Buffer = Buffer().also { buffer -> super.source(file).use { buffer.writeAll(it) } }
    override fun source(file: Path): Source = synchronized(lock) { whole(file) }
    override fun metadataOrNull(path: Path): FileMetadata? = synchronized(lock) { super.metadataOrNull(path) }
}

/** `Shots.shot` over a file system that survives concurrent reads; otherwise the same tiles. */
private fun shot(name: String, heightDp: Int = 4000, screen: @Composable () -> Unit) {
    val out = File(System.getProperty("shots")).apply { mkdirs() }
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val tokens = object : TokenStore { override fun get() = "fixture"; override fun set(token: String?) {} }
    val offline = MockEngine { respondError(HttpStatusCode.ServiceUnavailable) }
    val app = AppContainer("https://site.test", tokens, SerialFileSystem(FakeFileSystem()), "/copy".toPath(), offline, null, "test", scope, now = { Fixtures.now })
    runBlocking { Fixtures.fill(app.store); app.store.markSync(true, Fixtures.now - 5 * 60_000) }
    try {
        ImageComposeScene(width = 390 * 2, height = heightDp * 2, density = Density(2f)) {
            AppFrame(app) { SectionFrame(Section.Skills, {}) { screen() } }
        }.use { scene ->
            repeat(40) { frame -> scene.render(frame * 16_000_000L); Thread.sleep(25) }
            val whole = ImageIO.read(scene.render(41 * 16_000_000L).encodeToData(EncodedImageFormat.PNG)!!.bytes.inputStream())
            val tile = 800 * 2
            out.listFiles { f -> f.name.startsWith("$name-") }?.forEach { it.delete() }
            for (i in 0 until whole.height / tile) {
                val part = whole.getSubimage(0, i * tile, whole.width, tile)
                val ground = part.getRGB(4, tile - 4)
                val blank = (0 until tile step 8).all { y -> (0 until part.width step 8).all { x -> part.getRGB(x, y) == ground } }
                if (!blank || i == 0) ImageIO.write(part, "png", File(out, "$name-${i + 1}.png"))
            }
        }
    } finally {
        scope.cancel()
    }
}
