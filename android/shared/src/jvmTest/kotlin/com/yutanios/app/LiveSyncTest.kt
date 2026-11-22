package com.yutanios.app

import com.yutanios.app.data.SyncOutcome
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.KSerializer
import com.yutanios.app.model.*
import com.yutanios.app.screens.*
import com.yutanios.app.ui.Section
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.time.measureTime

/**
 * The whole path against a real site: a first sync into an empty folder, then a second that should
 * find nothing to fetch. Runs only with `-PliveUrl=… -PliveToken=…` (a local site and a token from
 * `npm run app:token`); otherwise it does nothing.
 */
class LiveSyncTest {
    private val url = System.getProperty("liveUrl").orEmpty()
    private val token = System.getProperty("liveToken").orEmpty()

    @Test fun firstSyncFillsThePhoneAndTheSecondFetchesNothing() {
        if (url.isEmpty()) return
        val dir = Files.createTempDirectory("yutani-live").toString()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
        val tokens = object : TokenStore { override fun get() = token; override fun set(token: String?) {} }
        val app = createAppContainer(url, tokens, dir, null, "live test", scope)
        try {
            runBlocking {
                val first = measureTime { assertEquals(SyncOutcome.Synced, app.syncNow()) }
                val held = app.store.index.value.entries
                val before = held.mapValues { it.value.fetchedAt }
                val second = measureTime { assertEquals(SyncOutcome.Synced, app.syncNow()) }
                val after = app.store.index.value.entries.mapValues { it.value.fetchedAt }
                println("live sync: ${held.size} resources, first $first, second $second")
                assertTrue(held.size > 4, "expected more than the four global resources")
                assertEquals(before, after, "the second sync rewrote something although nothing changed")
                // Real data is the hardest test of the models: every stored resource must decode.
                val failed = held.keys.filter { path -> runCatching { app.repo.load(path, serializerFor(path)) }.getOrNull() == null }
                assertEquals(emptyList(), failed, "resources the app's models cannot read")
                if (Shots.wanted) drawEverything(app)
            }
        } finally {
            scope.cancel()
        }
    }
}

/** Every screen for every character, and every ship's detail, from the real copy: a crash here is a crash on the phone. */
private suspend fun drawEverything(app: AppContainer) {
    val characters = app.repo.load(Paths.CHARACTERS, CharacterList.serializer())!!.data.characters
    Shots.shot("live-overview", Section.Overview, live = app) { OverviewScreen() }
    for (tab in 0..2) Shots.shot("live-skills-$tab", Section.Skills, live = app) { SkillsScreen(characters.first().id, initialTab = tab) }
    characters.forEachIndexed { i, c ->
        for (tab in 1..2) Shots.shot("live-$i-skills-$tab", Section.Skills, live = app) { SkillsScreen(c.id, initialTab = tab) }
        Shots.shot("live-$i-clones", Section.Clones, live = app) { ClonesScreen(c.id) }
        Shots.shot("live-$i-assets", Section.Assets, live = app) { AssetsScreen(c.id, initiallyExpandAll = true) }
        for (tab in 0..1) Shots.shot("live-$i-wallet-$tab", Section.Wallet, live = app) { WalletScreen(c.id, initialTab = tab) }
        for (tab in 0..1) Shots.shot("live-$i-ships-$tab", Section.Ships, live = app) { ShipsScreen(c.id, {}, {}, initialTab = tab) }
    }
    val details = app.store.index.value.entries.keys.filter { "/ships/" in it }
    details.forEachIndexed { i, path -> Shots.shot("live-ship-$i", Section.Ships, heightDp = 8000, live = app) { ShipDetailScreen(path, {}) } }
    println("live shots: ${characters.size} characters, ${details.size} ship details drawn")
}

/** The model each API path decodes to, as the screens ask for it. */
private fun serializerFor(path: String): KSerializer<out Any> = when {
    path == Paths.ME -> Me.serializer()
    path == Paths.CHARACTERS -> CharacterList.serializer()
    path == Paths.OVERVIEW -> Overview.serializer()
    path == Paths.TRAINING_OVERVIEW -> TrainingOverview.serializer()
    path.endsWith("/skills") -> SkillsData.serializer()
    path.endsWith("/training") -> TrainingData.serializer()
    path.endsWith("/clones") -> Clones.serializer()
    path.endsWith("/assets") -> AssetsData.serializer()
    path.endsWith("/wallet") -> WalletSummary.serializer()
    "kind=journal" in path -> WalletRows.serializer(JournalRow.serializer())
    "kind=transactions" in path -> WalletRows.serializer(TransactionRow.serializer())
    path.endsWith("/ships") -> Ships.serializer()
    "/ships/" in path -> ShipDetail.serializer()
    else -> error("no model for $path")
}
