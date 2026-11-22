package com.yutanios.app

import com.yutanios.app.model.Paths
import com.yutanios.app.model.RawQueueEntry
import com.yutanios.app.model.SheetGroup
import com.yutanios.app.model.SheetSkill
import com.yutanios.app.model.SkillsData
import com.yutanios.app.model.TrainingData
import com.yutanios.app.model.TrainingOverview
import com.yutanios.app.model.TrainingOverviewCharacter
import com.yutanios.app.model.at
import com.yutanios.app.time.epochMs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

private val ids = listOf(9000001L, 9000002L, 9000003L)
private fun at(iso: String): Long = epochMs(iso)!!

private fun skills(id: Long) = Fixtures.decode(Paths.skills(id), SkillsData.serializer())
private fun training(id: Long) = Fixtures.decode(Paths.training(id), TrainingData.serializer())
private fun overview() = Fixtures.decode(Paths.TRAINING_OVERVIEW, TrainingOverview.serializer())

private fun SkillsData.skill(id: Long): SheetSkill = groups.flatMap { it.skills }.first { it.skillId == id }
private fun SkillsData.group(id: Long): SheetGroup = groups.first { it.groupId == id }

/** Progress is a long sum in floating point; everything else must match the site to the character. */
private fun assertProgress(expected: Double?, actual: Double?) {
    if (expected == null) assertNull(actual) else assertEquals(expected, assertNotNull(actual), 1e-12)
}

/** The fixtures decode, with the values and the gaps the README promises. */
class SkillsContractTest {
    @Test fun skillsSheet() {
        val rich = skills(9000001)
        assertEquals(9, rich.groups.size)
        assertEquals(3, rich.queueLength)
        assertEquals(4, rich.queue.size, "the stored queue keeps the entry that had finished")
        val drones = rich.group(273)
        assertEquals("Drones", drones.name); assertEquals("709k", drones.groupSp); assertEquals(3, drones.queued); assertEquals(8, drones.skills.size)
        val interfacing = rich.skill(3442)
        assertEquals("Drone Interfacing", interfacing.name)
        assertEquals(4, interfacing.level); assertEquals(1, interfacing.queued); assertTrue(interfacing.training)
        assertTrue(interfacing.desc!!.startsWith("Improves damage"))

        val gaps = skills(9000002)
        assertEquals(listOf("Gunnery", "Spaceship Command"), gaps.groups.map { it.name })
        val gunnery = gaps.skill(3300)
        assertEquals(4, gunnery.level); assertEquals(3, gunnery.activeLevel); assertEquals(3, gunnery.trainedActiveLevel)
        assertNull(gaps.queue[0].finishAt); assertNull(gaps.queue[0].startAt)

        val empty = skills(9000003)
        assertTrue(empty.groups.isEmpty()); assertEquals(0, empty.queueLength); assertTrue(empty.queue.isEmpty())
    }

    @Test fun trainingQueue() {
        val rich = training(9000001)
        assertEquals(3, rich.entries.size)
        assertEquals("2026-04-05T21:00:00.000Z", rich.finishAt); assertEquals("22d 9h 0m 0s", rich.eta)
        val head = rich.entries[0]
        assertEquals(1, head.position); assertEquals(3442L, head.skillId); assertEquals(5, head.targetLevel)
        assertEquals("5d 6h 45m", head.remaining); assertEquals(0.1141, head.progress!!, 1e-4); assertEquals(61200L, head.trainingStartSp)
        assertNull(rich.entries[1].progress)

        val paused = training(9000002)
        assertEquals(2, paused.entries.size); assertNull(paused.finishAt); assertEquals("—", paused.eta)
        assertNull(paused.entries[0].startAt); assertNull(paused.entries[0].finishAt); assertNull(paused.entries[0].progress)
        assertEquals("—", paused.entries[0].remaining); assertEquals(21000L, paused.entries[0].trainingStartSp)

        val empty = training(9000003)
        assertTrue(empty.entries.isEmpty()); assertNull(empty.finishAt); assertEquals("—", empty.eta)
    }

    @Test fun trainingOverview() {
        val data = overview()
        assertEquals(ids, data.characters.map { it.id }); assertEquals(ids, data.all.map { it.id })
        val (one, two, three) = data.characters
        assertEquals("eta", one.status.kind); assertEquals("22d 9h", one.status.text)
        assertEquals(false, one.online); assertEquals(3, one.count); assertEquals(4, one.queue.size); assertTrue(one.rows[0].training)
        assertEquals("paused", two.status.kind); assertNull(two.status.text); assertEquals(true, two.online); assertNull(two.progress)
        assertEquals("—", two.rows[0].remaining)
        assertEquals("notSynced", three.status.kind); assertNull(three.online); assertFalse(three.synced); assertTrue(three.rows.isEmpty())
    }
}

/** What the app works out on its own clock matches what the site worked out on the fixture's. */
class SkillsClockTest {
    @Test fun sheetAtTheFixtureClockIsTheSitesOwn() = ids.forEach { id ->
        val data = skills(id)
        assertEquals(data, data.at(Fixtures.now), "skills of $id")
    }

    @Test fun trainingAtTheFixtureClockIsTheSitesOwn() = ids.forEach { id ->
        val data = training(id)
        val mine = data.at(Fixtures.now)
        assertEquals(data.entries.map { it.copy(progress = null) }, mine.entries.map { it.copy(progress = null) }, "entries of $id")
        data.entries.zip(mine.entries).forEach { (theirs, ours) -> assertProgress(theirs.progress, ours.progress) }
        assertEquals(data.finishAt, mine.finishAt); assertEquals(data.eta, mine.eta)
    }

    @Test fun overviewAtTheFixtureClockIsTheSitesOwn() = overview().characters.forEach { theirs ->
        val ours = theirs.at(Fixtures.now)
        assertEquals(theirs.copy(progress = null), ours.copy(progress = null), "queue of ${theirs.id}")
        assertProgress(theirs.progress, ours.progress)
    }

    // Drone Interfacing V lands at 2026-03-19 18:45; Gallente Drone Specialization IV at 03-22 03:10.
    private val afterHead = at("2026-03-20T00:00:00Z")
    private val afterSecond = at("2026-03-23T00:00:00Z")

    @Test fun sheetMovesOnWhenTheHeadFinishes() {
        val later = skills(9000001).at(afterHead)
        assertEquals(2, later.queueLength)
        // The stored sheet has not caught up, so the finished level simply stops showing as queued.
        val interfacing = later.skill(3442)
        assertEquals(4, interfacing.level); assertEquals(0, interfacing.queued); assertFalse(interfacing.training)
        val spec = later.skill(12486)
        assertEquals(3, spec.level); assertEquals(2, spec.queued); assertTrue(spec.training)
        assertEquals(2, later.group(273).queued)

        // Its level IV finished while the sheet still says III: the level in between shows as trained.
        val last = skills(9000001).at(afterSecond).skill(12486)
        assertEquals(4, last.level); assertEquals(1, last.queued); assertTrue(last.training)
    }

    @Test fun activeLevelNeverExceedsTheStoredOne() {
        // The stored active level is 3 under a trained 3, so a level shown as trained by the queue stays inactive.
        val spec = skills(9000001).at(afterSecond).skill(12486)
        assertEquals(3, spec.trainedActiveLevel)
        assertEquals(minOf(spec.trainedActiveLevel, spec.level), spec.activeLevel)
    }

    @Test fun trainingDropsTheFinishedHead() {
        val later = training(9000001).at(afterHead)
        assertEquals(listOf(1, 2), later.entries.map { it.position })
        val head = later.entries[0]
        assertEquals(12486L, head.skillId); assertEquals(4, head.targetLevel)
        assertEquals("2d 3h 10m", head.remaining)
        // 5h15m into a 56h25m level that started at its first SP: the share of the wall clock.
        assertEquals(315.0 / 3385.0, head.progress!!, 1e-9)
        assertEquals("14d 17h 50m", later.entries[1].remaining); assertNull(later.entries[1].progress)
        assertEquals("16d 21h 0m 0s", later.eta); assertEquals("2026-04-05T21:00:00.000Z", later.finishAt)
    }

    @Test fun trainingEndsEmpty() {
        val done = training(9000001).at(at("2026-04-05T21:00:00Z"))
        assertTrue(done.entries.isEmpty()); assertNull(done.finishAt); assertEquals("—", done.eta)
    }

    @Test fun aPausedQueueNeverMoves() {
        val paused = training(9000002)
        val muchLater = paused.at(at("2027-01-01T00:00:00Z"))
        assertEquals(paused.entries, muchLater.entries); assertEquals("—", muchLater.eta)
        val sheet = skills(9000002).at(at("2027-01-01T00:00:00Z"))
        assertEquals(2, sheet.queueLength); assertFalse(sheet.skill(3329).training); assertEquals(1, sheet.skill(3329).queued)
    }

    @Test fun overviewMovesOnWhenTheHeadFinishes() {
        val one = overview().characters[0].at(afterHead)
        assertEquals("eta", one.status.kind); assertEquals("16d 21h", one.status.text)
        assertEquals(2, one.count); assertFalse(one.truncated)
        assertEquals("Gallente Drone Specialization", one.rows[0].skill)
        assertEquals(1, one.rows[0].position); assertEquals(3, one.rows[0].trainedLevel); assertEquals(4, one.rows[0].targetLevel)
        assertTrue(one.rows[0].training); assertEquals("2d 3h 10m", one.rows[0].remaining)
        assertFalse(one.rows[1].training)
        assertEquals(315.0 / 3385.0, one.progress!!, 1e-9)

        val done = overview().characters[0].at(at("2026-04-06T00:00:00Z"))
        assertEquals("empty", done.status.kind); assertEquals(0, done.count); assertNull(done.progress); assertTrue(done.rows.isEmpty())
    }

    @Test fun overviewStopsAtTenRows() {
        val start = at("2026-03-14T12:00:00Z")
        val hour = 3_600_000L
        fun iso(ms: Long) = kotlin.time.Instant.fromEpochMilliseconds(ms).toString()
        val queue = (0 until 12).map { RawQueueEntry(100L + it, "Skill $it", 1, "Skill $it I", iso(start + it * hour), iso(start + (it + 1) * hour)) }
        val view = TrainingOverviewCharacter(1, "Example Pilot", synced = true, queue = queue).at(start + hour / 2)
        assertEquals(12, view.count); assertEquals(10, view.rows.size); assertTrue(view.truncated)
        assertEquals("30m", view.rows[0].remaining); assertEquals("1h", view.rows[1].remaining)
        assertEquals("11h 30m", view.status.text); assertEquals(0.5, view.progress!!, 1e-9)
        assertEquals(0, view.rows[0].trainedLevel)
    }
}
