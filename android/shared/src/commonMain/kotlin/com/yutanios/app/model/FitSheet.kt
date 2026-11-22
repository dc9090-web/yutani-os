package com.yutanios.app.model

import kotlinx.serialization.Serializable

/**
 * `GET …/ships/asset/{itemId}` and `…/ships/fit/{fittingId}`. `kind` is "ok" with a `view`, or
 * "error" with a `title` when the site's engine could not compute the fit.
 */
@Serializable data class ShipDetail(val kind: String = "ok", val view: FitSheet? = null, val title: String? = null)

@Serializable data class ShipKind(val typeName: String = "", val groupName: String? = null, val raceName: String? = null)
@Serializable data class SheetLocation(val system: SystemRef? = null, val place: String? = null, val note: String? = null)
@Serializable data class KeyFigure(val value: String = "—", val unit: String? = null, val note: String? = null, val tone: String? = null)
@Serializable data class KeyFigures(
    val ehp: KeyFigure = KeyFigure(), val speed: KeyFigure = KeyFigure(), val capacitor: KeyFigure = KeyFigure(),
    val lock: KeyFigure = KeyFigure(), val align: KeyFigure = KeyFigure(),
)
@Serializable data class WeaponTotals(val dps: Double = 0.0, val volley: Double = 0.0)

/** The site's `DroneSheetView`: the selector's limits plus the selection the sheet opens with. */
@Serializable
data class DroneControl(
    val types: List<DroneOption> = emptyList(), val bandwidth: Double = 0.0, val maxActive: Int? = null,
    val launched: Map<String, Int> = emptyMap(), val controlRange: String = "—", val bay: String = "—",
) {
    val limits: DroneLimits get() = DroneLimits(types, bandwidth, maxActive)
    /** JSON object keys are strings; the selector works on type ids. */
    val opening: Map<Long, Int> get() = launched.mapNotNull { (id, n) -> id.toLongOrNull()?.let { it to n } }.toMap()
}

@Serializable data class StatRow(val label: String, val value: String)
@Serializable data class StatSection(val title: String = "", val headline: String = "—", val rows: List<StatRow> = emptyList(), val note: String? = null, val ok: Boolean? = null)
/** `resists` is em, thermal, kinetic, explosive in whole per cent. */
@Serializable data class ResistRow(val layer: String, val hp: String = "", val note: String? = null, val ehp: String = "", val resists: List<Int> = emptyList())
@Serializable data class DefenseSection(val headline: String = "—", val recharge: String? = null, val layers: List<ResistRow> = emptyList())
@Serializable
data class ShipStats(
    val capacitor: StatSection = StatSection(), val offense: StatSection = StatSection(), val defense: DefenseSection = DefenseSection(),
    val targeting: StatSection = StatSection(), val navigation: StatSection = StatSection(), val bays: List<StatRow> = emptyList(),
)

@Serializable data class Repair(val label: String, val value: String = "—", val idle: Boolean = false)
@Serializable data class Bonus(val skill: String? = null, val level: Int? = null, val text: String = "")
@Serializable data class SlotCounter(val label: String, val used: Int = 0, val total: Int = 0, val over: Boolean = false)
/** A null cell renders as a dash. */
@Serializable data class RangeCells(val optimal: String? = null, val falloff: String? = null)
@Serializable
data class ModuleRow(
    val key: String, val quantity: Int = 1, val name: String, val typeId: Long, val charge: String? = null,
    val chargeAssumed: Boolean = false, val state: String = "", val desc: String? = null, val chargeDesc: String? = null,
    val range: RangeCells? = null,
)
@Serializable data class SlotColumn(val slot: String, val title: String = "", val used: Int = 0, val total: Int = 0, val rows: List<ModuleRow> = emptyList())
@Serializable data class Problem(val kind: String = "", val label: String = "", val text: String = "")
@Serializable data class MissingSkill(val skillTypeId: Long, val name: String, val have: Int = 0, val need: Int = 0)

@Serializable data class RangeBand(val label: String = "", val beyond: Boolean = false, val desc: String = "")
@Serializable data class DamageType(val kind: String, val label: String = "")
@Serializable data class DamageMix(val types: List<DamageType> = emptyList(), val desc: String = "")
@Serializable
data class AmmoRow(
    val key: String, val typeId: Long, val name: String, val desc: String? = null, val dps: String? = null, val dpsDesc: String? = null,
    val range: RangeCells? = null, val band: RangeBand? = null, val damage: DamageMix? = null,
)
@Serializable data class Consumable(val key: String, val typeId: Long, val name: String, val desc: String? = null, val effect: String = "", val use: String? = null)
@Serializable data class HoldEntry(val key: String, val typeId: Long, val name: String, val nickname: String? = null, val quantity: Long = 1, val desc: String? = null, val value: String? = null)
@Serializable data class ValueBreakdown(val total: String = "—", val totalShort: String = "—", val lines: List<StatRow> = emptyList(), val unpriced: String? = null)
@Serializable data class SkillGap(val skillTypeId: Long, val name: String, val level: Int = 0, val effect: String? = null, val affects: String = "")
@Serializable data class SkillGapGroup(val name: String, val skills: List<SkillGap> = emptyList())

/** `FitSheetView` on the site: one ship's whole sheet, every figure already formatted there. */
@Serializable
data class FitSheet(
    val title: String = "", val typeId: Long = 0, val typeName: String = "", val skillsSynced: Boolean = true,
    val ship: ShipKind = ShipKind(), val location: SheetLocation = SheetLocation(), val mastery: Int? = null,
    val key: KeyFigures = KeyFigures(), val weapons: WeaponTotals = WeaponTotals(), val droneControl: DroneControl? = null,
    val stats: ShipStats = ShipStats(), val repairs: List<Repair> = emptyList(), val bonuses: List<Bonus> = emptyList(),
    val gauges: List<Gauge> = emptyList(), val counters: List<SlotCounter> = emptyList(), val slots: List<SlotColumn> = emptyList(),
    val problems: List<Problem> = emptyList(), val missing: List<MissingSkill> = emptyList(),
    val ammo: List<AmmoRow> = emptyList(), val consumables: List<Consumable> = emptyList(),
    val cargo: List<HoldEntry> = emptyList(), val drones: List<HoldEntry> = emptyList(),
    val unfittable: List<HoldEntry> = emptyList(), val unknown: List<HoldEntry> = emptyList(),
    val value: ValueBreakdown = ValueBreakdown(), val skillGaps: List<SkillGapGroup> = emptyList(),
)
