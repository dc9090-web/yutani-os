package com.yutanios.app.model

import com.yutanios.app.time.countdown
import com.yutanios.app.time.duration
import com.yutanios.app.time.epochMs
import com.yutanios.app.time.queueProgress
import kotlinx.serialization.Serializable

/*
 * The three resources behind the Skills screen. Each carries fields the site worked out against
 * its own clock beside the raw values they came from; `at(now)` works them out again on the
 * phone's clock, the way the site function named on each does.
 */

/** `GET /api/v1/characters/{id}/skills`: the grouped sheet with the live queue laid over it. */
@Serializable
data class SkillsData(val groups: List<SheetGroup> = emptyList(), val queueLength: Int = 0, val queue: List<RawQueueEntry> = emptyList())

@Serializable
data class SheetGroup(val groupId: Long, val name: String, val groupSp: String = "—", val queued: Int = 0, val skills: List<SheetSkill> = emptyList())

@Serializable
data class SheetSkill(
    val skillId: Long, val name: String, val desc: String? = null,
    val level: Int = 0, val activeLevel: Int = 0, val queued: Int = 0, val training: Boolean = false,
    val trainedLevel: Int = 0, val trainedActiveLevel: Int = 0,
)

/**
 * The site's `sheetGroups` (src/lib/view/skills.ts) over the queue as it stands at `now`. The
 * stored sheet lags the queue, so a skill whose lowest live entry sits more than one level above
 * it shows the levels in between as trained.
 */
fun SkillsData.at(now: Long): SkillsData {
    val live = queue.live(now)
    val head = live.firstOrNull()
    val levels = live.groupBy({ it.skillId }, { it.level })
    return copy(
        queueLength = live.size,
        groups = groups.map { group ->
            val skills = group.skills.map { skill ->
                val ahead = levels[skill.skillId].orEmpty().filter { it > skill.trainedLevel }
                val level = if (ahead.isEmpty()) skill.trainedLevel else maxOf(skill.trainedLevel, ahead.min() - 1)
                val queued = ahead.toSet().size
                skill.copy(
                    level = level, activeLevel = minOf(skill.trainedActiveLevel, level), queued = queued,
                    training = queued > 0 && head?.finishAt != null && head.skillId == skill.skillId,
                )
            }
            group.copy(queued = skills.sumOf { it.queued }, skills = skills)
        },
    )
}

/** `GET /api/v1/characters/{id}/training`: the live queue, the head with its progress. */
@Serializable
data class TrainingData(val entries: List<QueueEntry> = emptyList(), val finishAt: String? = null, val eta: String = "—")

@Serializable
data class QueueEntry(
    val position: Int = 0, val skillId: Long, val skill: String, val desc: String? = null, val targetLevel: Int,
    val remaining: String = "—", val progress: Double? = null,
    val startAt: String? = null, val finishAt: String? = null,
    val levelStartSp: Long? = null, val levelEndSp: Long? = null, val trainingStartSp: Long? = null,
) {
    val start: Long? get() = epochMs(startAt)
    val finish: Long? get() = epochMs(finishAt)
}

/** Time still to train: the head counts from now, a later entry from its own start; "—" when paused. */
fun remaining(start: Long?, finish: Long?, now: Long): String =
    if (start != null && finish != null) duration(finish - maxOf(start, now)) else "—"

/** The site's `loadTraining` (src/lib/pages/skills.ts) at `now`: finished entries leave, the rest move up. */
fun TrainingData.at(now: Long): TrainingData {
    val live = entries.filter { it.finish?.let { end -> end > now } ?: true }
    val headActive = live.firstOrNull()?.finishAt != null
    val last = live.lastOrNull()
    val lastFinish = last?.finish
    return TrainingData(
        entries = live.mapIndexed { i, e ->
            e.copy(
                position = i + 1,
                remaining = remaining(e.start, e.finish, now),
                progress = if (i == 0 && headActive) queueProgress(e.start, e.finish, e.levelStartSp, e.levelEndSp, e.trainingStartSp, now) else null,
            )
        },
        finishAt = last?.finishAt,
        eta = if (lastFinish == null) "—" else countdown(lastFinish - now),
    )
}

/** `GET /api/v1/training-overview`: every chosen character's queue, in the saved order. */
@Serializable
data class TrainingOverview(val characters: List<TrainingOverviewCharacter> = emptyList(), val all: List<CharacterName> = emptyList())

@Serializable data class CharacterName(val id: Long, val name: String)

/** `kind` is "eta" (with `text`), "paused", "empty" or "notSynced". */
@Serializable data class TrainingQueueStatus(val kind: String = "empty", val text: String? = null)

@Serializable
data class TrainingQueueRow(
    val position: Int, val skill: String, val trainedLevel: Int = 0, val targetLevel: Int,
    val training: Boolean = false, val remaining: String = "—",
)

@Serializable
data class TrainingOverviewCharacter(
    val id: Long, val name: String, val online: Boolean? = null,
    val status: TrainingQueueStatus = TrainingQueueStatus(), val progress: Double? = null, val count: Int = 0,
    val rows: List<TrainingQueueRow> = emptyList(), val truncated: Boolean = false,
    val synced: Boolean = false, val queue: List<RawQueueEntry> = emptyList(),
)

/** Rows per character: `TRAINING_OVERVIEW_LIMIT` in the site's src/lib/view/training-overview.ts. */
const val TRAINING_OVERVIEW_LIMIT = 10

/** The site's `trainingQueueView` at `now`, from the stored queue. */
fun TrainingOverviewCharacter.at(now: Long): TrainingOverviewCharacter {
    val live = queue.live(now)
    val head = live.firstOrNull()
    val active = head?.finishAt != null
    val lastFinish = live.lastOrNull()?.finish
    val status = when {
        !synced -> TrainingQueueStatus("notSynced")
        head == null -> TrainingQueueStatus("empty")
        !active || lastFinish == null -> TrainingQueueStatus("paused")
        else -> TrainingQueueStatus("eta", duration(lastFinish - now))
    }
    val rows = live.take(TRAINING_OVERVIEW_LIMIT).mapIndexed { i, q ->
        TrainingQueueRow(i + 1, q.skill, maxOf(0, q.level - 1), q.level, i == 0 && active, remaining(q.start, q.finish, now))
    }
    return copy(
        status = status, progress = if (active) head?.progress(now) else null,
        count = live.size, rows = rows, truncated = live.size > rows.size,
    )
}
