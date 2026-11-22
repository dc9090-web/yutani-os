package com.yutanios.app.model

import kotlinx.serialization.Serializable

/** `GET /api/v1/me`. */
@Serializable data class Me(val email: String = "", val ownerInitials: String = "", val apiVersion: Int = 1)

/** One row of the character dropdown: `CharacterOptionView` on the site. */
@Serializable data class CharacterOption(val id: Long, val name: String, val tag: String? = null, val sp: String? = null, val needsReauth: Boolean = false)

object Paths {
    const val ME = "/api/v1/me"
    const val CHARACTERS = "/api/v1/characters"
    const val OVERVIEW = "/api/v1/overview"
    const val TRAINING_OVERVIEW = "/api/v1/training-overview"
    fun skills(id: Long) = "/api/v1/characters/$id/skills"
    fun training(id: Long) = "/api/v1/characters/$id/training"
    fun clones(id: Long) = "/api/v1/characters/$id/clones"
    fun assets(id: Long) = "/api/v1/characters/$id/assets"
    fun ships(id: Long) = "/api/v1/characters/$id/ships"
    fun wallet(id: Long, kind: String, offset: Int = 0, limit: Int = 500) = "/api/v1/characters/$id/wallet?kind=$kind&offset=$offset&limit=$limit"
    fun shipAsset(id: Long, itemId: Long) = "/api/v1/characters/$id/ships/asset/$itemId"
    fun shipFit(id: Long, fittingId: Long) = "/api/v1/characters/$id/ships/fit/$fittingId"
}
