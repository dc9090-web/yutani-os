package com.yutanios.app.model

import kotlinx.serialization.Serializable

/** `GET /api/v1/characters/{id}/clones`: the active clone, the home station and the jump clones by station. */
@Serializable
data class Clones(
    val synced: Boolean = false,
    val home: ClonePlace? = null,
    val active: Clone = Clone(),
    val locations: List<CloneLocation> = emptyList(),
    /** Sent raw; the site shows nothing from it, so neither does the app. */
    val lastCloneJumpAt: String? = null,
)

@Serializable data class ClonePlace(val name: String = "", val kind: String = "unknown", val system: SystemRef? = null)

/** `slots` is ten flags, one per implant slot, true where the slot is taken. */
@Serializable data class Clone(val implants: List<Implant> = emptyList(), val slots: List<Boolean> = emptyList(), val used: Int = 0)

@Serializable data class Implant(val typeId: Long, val name: String = "", val slot: Int? = null, val bonus: String? = null, val desc: String? = null)

@Serializable
data class CloneLocation(
    val key: String, val title: String = "", val station: String? = null, val system: SystemRef? = null,
    val clones: List<JumpClone> = emptyList(),
)

@Serializable
data class JumpClone(
    val jumpCloneId: Long, val code: String = "", val name: String? = null,
    val implants: List<Implant> = emptyList(), val slots: List<Boolean> = emptyList(), val used: Int = 0,
)
