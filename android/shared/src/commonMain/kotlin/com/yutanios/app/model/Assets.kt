package com.yutanios.app.model

import kotlinx.serialization.Serializable

/**
 * `GET /api/v1/characters/{id}/assets`: the whole tree, most items first. Searching and grouping
 * are the client's, as they are in the browser. `descriptions` is keyed by type id.
 */
@Serializable
data class AssetsData(
    val itemCount: Long = 0,
    val locations: List<AssetLocation> = emptyList(),
    val descriptions: Map<String, String> = emptyMap(),
)

@Serializable
data class AssetLocation(
    val locationId: Long, val label: String = "", val itemCount: Long = 0, val volume: Double = 0.0,
    val system: SystemRef? = null, val nodes: List<AssetNode> = emptyList(),
)

/** `flag` is the readable form of `rawFlag` (ESI's own: "HiSlot0"); `volume` is already multiplied by quantity. */
@Serializable
data class AssetNode(
    val itemId: Long, val typeId: Long, val typeName: String = "", val name: String? = null, val quantity: Long = 1,
    val flag: String = "", val rawFlag: String = "", val isBlueprintCopy: Boolean = false, val isCharge: Boolean = false,
    val volume: Double = 0.0, val iconUrl: String = "", val children: List<AssetNode> = emptyList(),
)
