package com.yutanios.app.model

import com.yutanios.app.time.duration
import com.yutanios.app.time.epochMs
import com.yutanios.app.time.queueProgress
import kotlinx.serialization.Serializable
import kotlin.math.roundToInt

/** One stored queue entry as plain values: `RawQueueEntry` in the site's `src/lib/pages/raw.ts`. */
@Serializable
data class RawQueueEntry(
    val skillId: Long, val skill: String, val level: Int, val label: String,
    val startAt: String? = null, val finishAt: String? = null,
    val levelStartSp: Long? = null, val levelEndSp: Long? = null, val trainingStartSp: Long? = null,
) {
    val start: Long? get() = epochMs(startAt)
    val finish: Long? get() = epochMs(finishAt)
    fun progress(now: Long): Double = queueProgress(start, finish, levelStartSp, levelEndSp, trainingStartSp, now)
}

/** The site's `liveQueue`: entries still to finish. A paused entry has no dates and always stays. */
fun List<RawQueueEntry>.live(now: Long): List<RawQueueEntry> = filter { it.finish?.let { end -> end > now } ?: true }

/** What a training line shows right now: the site's `overviewTraining`, worked out on the phone's clock. */
sealed interface TrainingNow {
    data class Active(val skill: String, val time: String, val percent: Int, val finish: Long?) : TrainingNow
    data class Idle(val label: String) : TrainingNow
}

fun trainingNow(queue: List<RawQueueEntry>, synced: Boolean, now: Long): TrainingNow {
    if (!synced) return TrainingNow.Idle("Not synced")
    val head = queue.live(now).firstOrNull() ?: return TrainingNow.Idle("Queue empty")
    val finish = head.finish ?: return TrainingNow.Active(head.label, "paused", 0, null)
    return TrainingNow.Active(head.label, duration(finish - now), (head.progress(now) * 100).roundToInt(), finish)
}
