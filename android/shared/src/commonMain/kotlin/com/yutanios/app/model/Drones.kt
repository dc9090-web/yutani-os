package com.yutanios.app.model

import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.floor

/**
 * The drone selector's arithmetic: the one sum the app does itself. The site has already worked out
 * what one drone of each type does; a launched selection is a sum over those. Each function mirrors
 * its namesake in the site's `src/lib/view/drones.ts`, and the tests are the site's cases.
 */
@Serializable
data class DroneOption(val typeId: Long, val name: String, val inBay: Int = 0, val bandwidth: Double = 0.0, val dpsEach: Double = 0.0, val volleyEach: Double = 0.0)

data class DroneLimits(val types: List<DroneOption>, val bandwidth: Double, val maxActive: Int?)

data class LaunchedTotals(val dps: Double, val volley: Double, val active: Int, val bandwidthUsed: Double)

fun launchedTotals(limits: DroneLimits, launched: Map<Long, Int>): LaunchedTotals {
    var dps = 0.0
    var volley = 0.0
    var active = 0
    var bandwidthUsed = 0.0
    for (type in limits.types) {
        val n = minOf(launched[type.typeId] ?: 0, type.inBay)
        dps += n * type.dpsEach
        volley += n * type.volleyEach
        active += n
        bandwidthUsed += n * type.bandwidth
    }
    return LaunchedTotals(dps, volley, active, bandwidthUsed)
}

/**
 * How many more of `type` can go out on top of `launched`: the lowest of what is left in the bay,
 * what is left of the pilot's drone control limit, and what the remaining bandwidth carries.
 */
fun roomFor(limits: DroneLimits, launched: Map<Long, Int>, type: DroneOption): Int {
    val totals = launchedTotals(limits, launched)
    val byBay = type.inBay - (launched[type.typeId] ?: 0)
    val byControl = limits.maxActive?.let { it - totals.active } ?: Int.MAX_VALUE
    // The sliver added before dividing stops a bandwidth that divides exactly from losing a drone to rounding.
    val byBandwidth = if (type.bandwidth > 0) floor((limits.bandwidth - totals.bandwidthUsed + 1e-9) / type.bandwidth).toInt() else Int.MAX_VALUE
    return maxOf(0, minOf(byBay, byControl, byBandwidth))
}

/** "4× Imperial Navy Infiltrator, 1× Hobgoblin II", or "No drones launched". */
fun launchedSummary(limits: DroneLimits, launched: Map<Long, Int>): String {
    val parts = limits.types.mapNotNull { type -> (launched[type.typeId] ?: 0).takeIf { it > 0 }?.let { "$it× ${type.name}" } }
    return if (parts.isEmpty()) "No drones launched" else parts.joinToString(", ")
}

/** What the sheet shows for a selection (`useTotals` in the site's Drones.tsx): the weapons' own figures plus the launched drones'. */
data class OffenseNow(val weaponDps: Double, val droneDps: Double, val volley: Double, val active: Int, val bandwidthUsed: Double) {
    val totalDps: Double get() = weaponDps + droneDps
}

fun offenseNow(weaponDps: Double, weaponVolley: Double, limits: DroneLimits?, launched: Map<Long, Int>): OffenseNow {
    val out = limits?.let { launchedTotals(it, launched) } ?: LaunchedTotals(0.0, 0.0, 0, 0.0)
    return OffenseNow(weaponDps, out.dps, weaponVolley + out.volley, out.active, out.bandwidthUsed)
}

/** The site's `grouped`: thousands separators in the whole part of a plain decimal string. */
fun grouped(raw: String): String {
    val negative = raw.startsWith("-")
    val body = raw.removePrefix("-")
    val separated = body.substringBefore(".").reversed().chunked(3).joinToString(",").reversed()
    return (if (negative) "-" else "") + separated + (if ("." in body) "." + body.substringAfter(".") else "")
}

/** JavaScript's `toFixed(1)`, which is how the site prints every DPS figure. */
fun fixed1(value: Double): String {
    val tenths = floor(abs(value) * 10 + 0.5).toLong()
    val sign = if (value < 0 && tenths != 0L) "-" else ""
    return "$sign${tenths / 10}.${tenths % 10}"
}

/** "1,234.5": a DPS figure as the site's drone component prints it. */
fun dpsText(value: Double): String = grouped(fixed1(value))

/** A whole number of hit points, rounded half up as JavaScript's `Math.round` does. */
fun volleyText(value: Double): String = grouped(floor(value + 0.5).toLong().toString())

/** A number as JavaScript prints it, with no ".0" on a whole one, then grouped. Bandwidths are whole in practice. */
fun plainNumber(value: Double): String = grouped(if (value == floor(value) && abs(value) < 1e15) value.toLong().toString() else value.toString())
