package com.yutanios.app.model

import kotlinx.serialization.Serializable

/** `GET /api/v1/overview`: the Overview page's summary strip and one card per character. */
@Serializable data class Overview(val summary: OverviewSummary = OverviewSummary(), val cards: List<OverviewCard> = emptyList())

/** `queuesActive` and `next` are worked out against the site's clock; the app recomputes both from the cards. */
@Serializable data class OverviewSummary(val wallet: String = "—", val totalSp: String = "—", val queuesActive: Int = 0, val queuesTotal: Int = 0)

@Serializable data class SystemRef(val name: String, val sec: String? = null, val secClass: String? = null)
@Serializable data class ShipRef(val typeId: Long, val typeName: String, val groupName: String? = null)
@Serializable data class TrainingRaw(val synced: Boolean = false, val queue: List<RawQueueEntry> = emptyList())

@Serializable
data class OverviewCard(
    val id: Long, val name: String, val corp: String? = null, val race: String? = null, val needsReauth: Boolean = false,
    val balance: String? = null, val system: SystemRef? = null, val dockedAt: String? = null, val ship: ShipRef? = null,
    val online: Boolean? = null, val trainingRaw: TrainingRaw = TrainingRaw(), val totalSp: String? = null,
    val accountTag: String? = null, val tags: List<String> = emptyList(),
)
