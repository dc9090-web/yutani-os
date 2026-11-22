package com.yutanios.app.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.AmmoRow
import com.yutanios.app.model.FitSheet
import com.yutanios.app.model.HoldEntry
import com.yutanios.app.model.ModuleRow
import com.yutanios.app.model.SkillGap
import com.yutanios.app.model.SlotColumn
import com.yutanios.app.model.grouped
import com.yutanios.app.time.roman
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Info
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.LevelBlocks
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.TagTone
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.describable
import com.yutanios.app.ui.type

private fun info(title: String, vararg parts: String?): Info? =
    parts.filterNot { it.isNullOrBlank() }.joinToString("\n\n").takeIf { it.isNotEmpty() }?.let { Info(title, it) }

private sealed interface RackLine {
    val key: String
    data class Head(val rack: SlotColumn) : RackLine { override val key get() = "rack:${rack.slot}" }
    data class Module(val row: ModuleRow) : RackLine { override val key get() = "row:${row.key}" }
    data class EmptySlots(val slot: String, val count: Int) : RackLine { override val key get() = "empty:$slot" }
}

/** Modules by rack. A slot kind the hull does not have (subsystems on a frigate) is left out, as on the site. */
internal fun LazyListScope.modules(view: FitSheet, onInfo: (Info) -> Unit) {
    val lines = buildList {
        view.slots.filter { it.total > 0 || it.rows.isNotEmpty() }.forEach { rack ->
            add(RackLine.Head(rack))
            rack.rows.forEach { add(RackLine.Module(it)) }
            if (rack.total > rack.used) add(RackLine.EmptySlots(rack.slot, rack.total - rack.used))
        }
    }
    item(key = "modules-head") { CardSeg(Seg.Top) { Txt("Modules", type.h2); Gap(8.dp) } }
    items(lines, key = { "modules-${it.key}" }) { line ->
        CardSeg(Seg.Mid) {
            when (line) {
                is RackLine.Head -> GroupHead(line.rack.title, "${line.rack.used} / ${line.rack.total}", over = line.rack.used > line.rack.total)
                is RackLine.Module -> ModuleLine(line.row, onInfo)
                is RackLine.EmptySlots -> {
                    Box(Modifier.heightIn(min = 36.dp), contentAlignment = Alignment.CenterStart) {
                        Txt(plural(line.count, "empty slot"), type.meta, color = Yo.textLabel)
                    }
                    RowLine()
                }
            }
        }
    }
    cardEnd("modules-end")
}

/** Icon, quantity, name over its charge, state tag; optimal and falloff fold into a line beneath. */
@Composable
private fun ModuleLine(row: ModuleRow, onInfo: (Info) -> Unit) {
    Column(Modifier.fillMaxWidth().describable(info(row.name, row.desc), onInfo).heightIn(min = 48.dp).padding(vertical = 6.dp), verticalArrangement = Arrangement.Center) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Tile(EveImage.icon(row.typeId), 32.dp)
            Txt(if (row.quantity > 1) "${row.quantity}×" else "", type.mono, Modifier.padding(start = 12.dp).width(22.dp), Yo.textMuted, maxLines = 1)
            Column(Modifier.weight(1f).padding(start = 12.dp, end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Txt(row.name, type.body)
                if (row.charge != null) {
                    Txt(row.charge + if (row.chargeAssumed) " · best in cargo" else "", type.meta, Modifier.describable(info(row.charge, row.chargeDesc), onInfo))
                }
            }
            val state = row.state.uppercase()
            // The site draws OFFLINE with a dashed outline; the plain outline is the nearest tag there is here.
            Tag(state, when (state) { "ACTIVE" -> TagTone.Accent; "OVERLOAD" -> TagTone.Bad; else -> TagTone.Outline })
        }
        val range = row.range
        if (range != null) {
            val mono = type.mono.toSpanStyle().copy(color = Yo.textMuted)
            Rich(buildAnnotatedString {
                append("Optimal ")
                withStyle(mono) { append(range.optimal ?: "—") }
                append(" · Falloff ")
                withStyle(mono) { append(range.falloff ?: "—") }
            }, type.meta, Modifier.padding(start = 78.dp, top = 2.dp))
        }
    }
    RowLine()
}

internal fun LazyListScope.ammunition(view: FitSheet, note: String?, onInfo: (Info) -> Unit) {
    if (view.ammo.isEmpty()) return
    item(key = "ammo-head") { CardSeg(Seg.Top) { SheetHead("Ammunition", note = note); Gap(14.dp); RowLine(color = Yo.border) } }
    items(view.ammo, key = { "ammo-${it.key}" }) { row -> CardSeg(Seg.Mid) { AmmoLine(row, onInfo) } }
    cardEnd("ammo-end")
}

private fun damageColor(kind: String): Color = when (kind) {
    "em" -> Yo.dmgEm
    "thermal" -> Yo.dmgThermal
    "explosive" -> Yo.dmgExplosive
    else -> Yo.dmgKinetic
}

/** The round and its range band, then its damage types and figures on the line beneath. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AmmoLine(row: AmmoRow, onInfo: (Info) -> Unit) {
    val details = info(row.name, row.damage?.desc, row.dpsDesc, row.band?.desc, row.desc)
    Column(Modifier.fillMaxWidth().describable(details, onInfo).padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Txt(row.name, type.body, Modifier.weight(1f).padding(end = 8.dp))
            val band = row.band
            if (band != null) {
                Txt(band.label.uppercase(), type.tag, maxLines = 1)
                // Reaches further than the ship can lock: still Long, the glyph says why that matters.
                if (band.beyond) BeyondLock()
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp), itemVerticalAlignment = Alignment.CenterVertically) {
            val damage = row.damage
            if (damage == null || damage.types.isEmpty()) Txt("—", type.meta, color = Yo.text2)
            else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                damage.types.forEach { Box(Modifier.size(8.dp).background(damageColor(it.kind), RoundedCornerShape(2.dp))) }
                Txt(damage.types.joinToString(" / ") { it.label }, type.meta, Modifier.padding(start = 2.dp), Yo.text2, maxLines = 1)
            }
            // What every fitted weapon that takes the round would do with it; a dash for a round nothing fitted fires.
            FigureUnit(row.dps ?: "—", "dps", type.mono, unitSize = 12f)
            Txt(row.range?.optimal ?: "—", type.mono, maxLines = 1)
            Txt(row.range?.falloff ?: "—", type.mono, color = Yo.textMuted, maxLines = 1)
        }
    }
    RowLine()
}

/** A crossed-out reticle, standing in for the site's "target off" icon. */
@Composable
private fun BeyondLock() {
    Canvas(Modifier.size(11.dp).semantics { contentDescription = "Further than this ship can lock" }) {
        val line = 1.4.dp.toPx()
        drawCircle(Yo.bad, radius = size.minDimension / 2 - line, style = Stroke(line))
        drawLine(Yo.bad, Offset(0f, size.height), Offset(size.width, 0f), line)
    }
}

internal fun LazyListScope.consumables(view: FitSheet, onInfo: (Info) -> Unit) {
    if (view.consumables.isEmpty()) return
    card("consumables") {
        Txt("Consumables", type.h2)
        Gap(14.dp)
        RowLine(color = Yo.border)
        view.consumables.forEach { row ->
            Row(
                Modifier.fillMaxWidth().describable(info(row.name, row.desc), onInfo).heightIn(min = 44.dp).padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Tile(EveImage.icon(row.typeId), 28.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Txt(row.name, type.body)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Txt(row.effect, type.meta, Modifier.weight(1f, fill = false), Yo.text2)
                        // A dash when no fitted module takes it and it has no slot or duration to show.
                        Txt(row.use ?: "—", type.mono, color = Yo.textMuted, maxLines = 1)
                    }
                }
            }
            RowLine()
        }
    }
}

/** Cargo and drones: what is aboard, each hold a group of lazy rows inside the one card. */
internal fun LazyListScope.holds(view: FitSheet, onInfo: (Info) -> Unit) {
    fun bay(label: String): String? = view.stats.bays.firstOrNull { it.label == label }?.value
    fun hold(name: String, used: String?, entries: List<HoldEntry>, note: String? = null, icons: Boolean = true) {
        if (entries.isEmpty()) return
        item(key = "hold-$name") {
            CardSeg(Seg.Mid) {
                Gap(14.dp)
                GroupHead(name, used)
                RowLine(color = Yo.border)
                if (note != null) Txt(note, type.meta, Modifier.padding(top = 8.dp, bottom = 2.dp))
            }
        }
        items(entries, key = { "hold-$name-${it.key}" }) { entry -> CardSeg(Seg.Mid) { EntryLine(entry, icons, onInfo) } }
    }
    item(key = "holds-head") {
        CardSeg(Seg.Top) {
            Txt("Cargo and drones", type.h2)
            if (view.cargo.isEmpty() && view.drones.isEmpty()) Txt("Nothing in the cargo hold or drone bay.", type.meta, Modifier.padding(top = 14.dp), Yo.textLabel)
        }
    }
    hold("Drone bay", bay("Drone bay"), view.drones)
    hold("Cargo hold", bay("Cargo hold"), view.cargo)
    // The image server has nothing for a type the static data lacks, so these go without icons.
    hold("Unknown types", null, view.unknown, "The static data does not know these types, so they are excluded from the calculation.", icons = false)
    hold("Not fitted", null, view.unfittable, "Saved with no slot, so the fitting window would not place them either.")
    cardEnd("holds-end")
}

/** The item, then its quantity and value on the line beneath. */
@Composable
private fun EntryLine(entry: HoldEntry, icons: Boolean, onInfo: (Info) -> Unit) {
    Row(
        Modifier.fillMaxWidth().describable(info(entry.name, entry.desc), onInfo).padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (icons) Tile(EveImage.icon(entry.typeId), 28.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            val muted = type.body.toSpanStyle().copy(color = Yo.textMuted)
            Rich(buildAnnotatedString {
                append(entry.name)
                if (entry.nickname != null) withStyle(muted) { append(" ${entry.nickname}") }
            }, type.body)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Txt(if (entry.quantity == 1L) "" else "×${grouped(entry.quantity.toString())}", type.mono, Modifier.weight(1f), Yo.textMuted, maxLines = 1)
                // Unit price × quantity; a dash for a type with no price.
                Txt(entry.value ?: "—", type.mono, maxLines = 1)
            }
        }
    }
    RowLine()
}

internal fun LazyListScope.bonuses(view: FitSheet) {
    card("bonuses") {
        Txt("Ship bonuses", type.h2)
        Gap(14.dp)
        if (view.bonuses.isEmpty()) {
            Txt("This hull has no listed bonuses.", type.meta, color = Yo.textLabel)
            return@card
        }
        RowLine(color = Yo.border)
        view.bonuses.forEach { bonus ->
            Column(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                val level = bonus.level
                Txt(if (bonus.skill == null) "Role bonus" else "${bonus.skill} ${if (level == null || level == 0) "0" else roman(level)}", type.meta)
                Txt(bonus.text, type.body)
            }
            RowLine()
        }
    }
}

/** Skills below level 5 that affect the ship, grouped by where they land. */
internal fun LazyListScope.skillGaps(view: FitSheet) {
    val total = view.skillGaps.sumOf { it.skills.size }
    item(key = "gaps-head") {
        CardSeg(Seg.Top) {
            SheetHead("Skills", note = if (total == 0) null else "${plural(total, "skill")} could still improve this ship")
            if (!view.skillsSynced || total == 0) {
                Gap(14.dp)
                RowLine(color = Yo.border)
                if (!view.skillsSynced) Txt("Skills have not synced yet, so there is nothing to compare this ship against.", type.body, Modifier.padding(top = 14.dp), Yo.textMuted)
                else Txt("Every skill that affects this ship, its bonuses, modules and drones is at level 5.", type.body, Modifier.padding(top = 14.dp), Yo.good)
            }
        }
    }
    if (view.skillsSynced) view.skillGaps.forEach { group ->
        if (group.skills.isEmpty()) return@forEach
        item(key = "gaps-${group.name}") {
            CardSeg(Seg.Mid) {
                Gap(14.dp)
                GroupHead(group.name, plural(group.skills.size, "skill"))
                RowLine(color = Yo.border)
            }
        }
        items(group.skills, key = { "gaps-${group.name}-${it.skillTypeId}" }) { skill -> CardSeg(Seg.Mid) { GapLine(skill) } }
    }
    cardEnd("gaps-end")
}

@Composable
private fun GapLine(skill: SkillGap) {
    Column(Modifier.fillMaxWidth().padding(vertical = 11.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LevelBlocks(skill.level)
            Txt(skill.name, type.bodyStrong, Modifier.weight(1f))
        }
        if (skill.effect != null) Txt(skill.effect, type.meta, Modifier.padding(top = 5.dp), Yo.text2)
        Label("Affects", Modifier.padding(top = 8.dp))
        Txt(skill.affects, type.meta, Modifier.padding(top = 3.dp), Yo.text)
    }
    RowLine()
}
