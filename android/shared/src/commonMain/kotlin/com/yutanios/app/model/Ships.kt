package com.yutanios.app.model

import kotlinx.serialization.Serializable

/** `GET /api/v1/characters/{id}/ships`: the fitted ships and the saved fits, one card each. */
@Serializable data class Ships(val skillsSynced: Boolean = true, val ships: List<ShipCard> = emptyList(), val fits: List<ShipCard> = emptyList())

/** One resource bar: CPU, powergrid, calibration. `percent` is 0–100 and stops at 100 when `over`. */
@Serializable data class Gauge(val label: String = "", val unit: String = "", val text: String = "", val percent: Double = 0.0, val over: Boolean = false)

@Serializable data class ShipCardStats(
    val dps: String = "—", val ehp: String = "—", val velocity: String = "—", val cap: String = "—",
    val capOk: Boolean? = null, val propKind: String? = null,
)

@Serializable data class ShipWeapon(val key: String, val typeId: Long, val name: String, val count: Int = 1, val charge: String? = null, val range: String? = null)

/** `ShipCardView` on the site. `stats`, `cpu` and `power` are all null when the fit could not be computed. */
@Serializable
data class ShipCard(
    val key: String, val name: String? = null, val typeId: Long, val typeName: String,
    val groupName: String? = null, val raceName: String? = null,
    val location: String = "", val system: SystemRef? = null,
    val stats: ShipCardStats? = null, val cpu: Gauge? = null, val power: Gauge? = null,
    val missingSkills: Int = 0, val weapons: List<ShipWeapon> = emptyList(),
    val value: String? = null, val unpriced: String? = null, val error: String? = null, val mastery: Int? = null,
) {
    /** The key is "asset:{itemId}" or "fit:{fittingId}": the number names the detail route. */
    val assetId: Long? get() = idAfter("asset:")
    val fitId: Long? get() = idAfter("fit:")
    private fun idAfter(prefix: String): Long? = if (key.startsWith(prefix)) key.removePrefix(prefix).toLongOrNull() else null
}
