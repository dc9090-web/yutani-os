package com.yutanios.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.yutanios.app.model.DefenseSection
import com.yutanios.app.model.FitSheet
import com.yutanios.app.model.ResistRow
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.type

/** CPU, powergrid and calibration bars, then the slot, turret and launcher counts as chips. */
@OptIn(ExperimentalLayoutApi::class)
internal fun LazyListScope.fitting(view: FitSheet) {
    card("fitting") {
        Txt("Fitting", type.h2)
        view.gauges.forEach { Gap(14.dp); GaugeBar(it) }
        Gap(14.dp)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val shape = RoundedCornerShape(3.dp)
            view.counters.forEach { counter ->
                Row(
                    Modifier.background(Yo.surfaceSunken, shape).border(1.dp, if (counter.over) Yo.bad else Yo.border, shape).padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Txt(counter.label, type.meta, maxLines = 1)
                    Txt("${counter.used} / ${counter.total}", type.mono, color = if (counter.over) Yo.bad else Yo.text, maxLines = 1)
                }
            }
        }
    }
}

// `.sd-resists`: the layer, four resists and the layer's EHP, in the grid's own proportions.
private const val LAYER = 1.5f
private const val RESIST = 1f
private const val EHP = 1.3f
private val RESIST_COLORS = listOf(Yo.dmgEm, Yo.dmgThermal, Yo.dmgKinetic, Yo.dmgExplosive)

internal fun LazyListScope.defense(view: FitSheet) {
    card("defense") { Defense(view.stats.defense) }
}

@Composable
private fun Defense(defense: DefenseSection) {
    // The headline arrives as "3,242 ehp"; the sheet shows the figure with EHP as its unit.
    val total = if (defense.headline.endsWith(" ehp", ignoreCase = true)) defense.headline.dropLast(4) else defense.headline
    SheetHead("Defense", total, unit = "EHP")
    Gap(14.dp)
    if (defense.layers.isEmpty()) {
        Txt("No tank figures for this hull.", type.meta, color = Yo.textLabel)
        return
    }
    // The label's usual tracking would cut "THERM" short in a column this narrow.
    val head = type.label.copy(letterSpacing = 0.02.em)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.weight(LAYER))
        listOf("EM", "Therm", "Kin", "Exp").forEach { Txt(it.uppercase(), head, Modifier.weight(RESIST), maxLines = 1, align = TextAlign.End) }
        Txt("EHP", head, Modifier.weight(EHP), maxLines = 1, align = TextAlign.End)
    }
    defense.layers.forEach { Gap(8.dp); ResistLine(it) }
    Gap(8.dp)
    RowLine(color = Yo.border)
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Txt("Total", type.meta, Modifier.weight(1f))
        Txt("$total EHP", type.mono.copy(fontWeight = FontWeight.Medium))
    }
}

/** One layer: its name and hit points, each resist as a percentage over a bar in the damage type's colour, its EHP. */
@Composable
private fun ResistLine(layer: ResistRow) {
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Column(Modifier.weight(LAYER), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Txt(layer.layer, type.bodyStrong, maxLines = 1)
            Txt(layer.hp, type.monoSmall, maxLines = 1)
            if (layer.note != null) Txt("${layer.note} recharge", type.monoSmall)
        }
        layer.resists.take(4).forEachIndexed { i, pct ->
            Column(Modifier.weight(RESIST), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Txt("$pct%", type.mono, Modifier.fillMaxWidth(), maxLines = 1, align = TextAlign.End)
                Box(Modifier.fillMaxWidth().height(3.dp).background(Yo.track)) {
                    Box(Modifier.fillMaxWidth((pct / 100f).coerceIn(0f, 1f)).height(3.dp).background(RESIST_COLORS.getOrElse(i) { Color.Unspecified }))
                }
            }
        }
        Txt(layer.ehp, type.mono, Modifier.weight(EHP).align(Alignment.Top), maxLines = 1, align = TextAlign.End)
    }
}

/** Passive shield and the three active repair rates; the ones the fit lacks are muted. */
internal fun LazyListScope.repairs(view: FitSheet) {
    card("repairs") {
        Txt("Repairs", type.h2)
        Gap(14.dp)
        CellGrid(view.repairs.size) { i ->
            val repair = view.repairs[i]
            Label(repair.label)
            Gap(6.dp)
            FigureUnit(repair.value, "hp/s", type.mono14, color = if (repair.idle) Yo.textMuted else Color.Unspecified)
        }
    }
}
