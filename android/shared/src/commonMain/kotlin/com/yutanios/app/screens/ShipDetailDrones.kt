package com.yutanios.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.DroneControl
import com.yutanios.app.model.DroneLimits
import com.yutanios.app.model.DroneOption
import com.yutanios.app.model.OffenseNow
import com.yutanios.app.model.StatRow
import com.yutanios.app.model.dpsText
import com.yutanios.app.model.fixed1
import com.yutanios.app.model.launchedSummary
import com.yutanios.app.model.launchedTotals
import com.yutanios.app.model.plainNumber
import com.yutanios.app.model.roomFor
import com.yutanios.app.model.volleyText
import com.yutanios.app.ui.Chevron
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.type

/** The Offense panel: total DPS in the header, then weapons, drones and one full volley, all following the selection. */
internal fun LazyListScope.offenseCard(offense: OffenseNow, note: String?) {
    card("offense") {
        StatCard(
            "Offense", if (offense.totalDps > 0) "${dpsText(offense.totalDps)} DPS" else "—",
            listOf(
                StatRow("Weapons", if (offense.weaponDps > 0) "${dpsText(offense.weaponDps)} dps" else "—"),
                StatRow("Drones", if (offense.droneDps > 0) "${dpsText(offense.droneDps)} dps" else "—"),
                StatRow("Volley", if (offense.volley > 0) "${volleyText(offense.volley)} HP" else "—"),
            ),
            note = note,
        )
    }
}

/**
 * The Drones panel: the drone types in this ship's bay, each with minus and plus steppers. A type's
 * limit is the lowest of what is in the bay, the bandwidth left and the pilot's drone control limit;
 * several types can be out together.
 */
internal fun LazyListScope.dronesCard(control: DroneControl, launched: Map<Long, Int>, open: Boolean, onToggle: () -> Unit, onSet: (Long, Int) -> Unit) {
    card("drones") {
        val limits = control.limits
        val totals = launchedTotals(limits, launched)
        SheetHead("Drones", "${dpsText(totals.dps)} DPS")
        Gap(14.dp)
        if (control.types.isEmpty()) Txt("No drones in the bay.", type.meta, color = Yo.textLabel)
        else DroneSelect(limits, launched, open, onToggle, onSet)
        Gap(14.dp)
        val drones = if (totals.active == 1 && control.maxActive == null) "drone" else "drones"
        StatRows(listOf(
            StatRow("Launched", "${totals.active}${control.maxActive?.let { " / $it" } ?: ""} $drones"),
            StatRow("Bandwidth", "${plainNumber(totals.bandwidthUsed)} / ${plainNumber(control.bandwidth)} Mbit/s"),
            StatRow("Control range", control.controlRange),
            StatRow("Drone bay", control.bay),
        ))
    }
}

@Composable
private fun DroneSelect(limits: DroneLimits, launched: Map<Long, Int>, open: Boolean, onToggle: () -> Unit, onSet: (Long, Int) -> Unit) {
    val shape = RoundedCornerShape(6.dp)
    Label("Drones launched")
    Gap(6.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(Yo.surfaceSunken).border(1.dp, Yo.borderControl, shape)
            .clickable(role = Role.Button, onClickLabel = if (open) "Hide the drones" else "Choose drones", onClick = onToggle)
            .heightIn(min = 44.dp).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Txt(launchedSummary(limits, launched), type.bodyStrong, Modifier.weight(1f))
        // Down when shut, up when open, as the site's arrow turns.
        Chevron(open = true, modifier = Modifier.rotate(if (open) 180f else 0f))
    }
    if (!open) return
    Gap(6.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(Yo.surfaceSunken).border(1.dp, Yo.borderControl, shape)) {
        limits.types.forEach { option ->
            DroneRow(option, launched[option.typeId] ?: 0, roomFor(limits, launched, option), onSet)
            RowLine(color = Yo.border)
        }
        Txt(
            "Only drones in this ship’s drone bay are listed. The limit per drone follows the ship’s bandwidth and your drone control limit.",
            type.meta, Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
        )
    }
}

@Composable
private fun DroneRow(option: DroneOption, count: Int, room: Int, onSet: (Long, Int) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Tile(EveImage.icon(option.typeId), 28.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Txt(option.name, type.body)
            // The word joiner keeps "Mbit/s" from breaking at its slash in this narrow column.
            Txt("${option.inBay} in bay · ${plainNumber(option.bandwidth)} Mbit/⁠s · ${fixed1(option.dpsEach)} dps each", type.monoSmall)
        }
        Step("−", "One fewer ${option.name}", enabled = count > 0) { onSet(option.typeId, count - 1) }
        val max = type.mono.toSpanStyle().copy(color = Yo.textLabel)
        Rich(buildAnnotatedString { append("$count "); withStyle(max) { append("/ ${count + room}") } }, type.mono, Modifier.width(44.dp), maxLines = 1, align = TextAlign.Center)
        Step("+", "One more ${option.name}", enabled = room > 0) { onSet(option.typeId, count + 1) }
    }
}

/** `.sd-step`: a 32dp outlined square, as on the site at phone width. */
@Composable
private fun Step(sign: String, label: String, enabled: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(3.dp)
    Box(
        Modifier.size(32.dp).clip(shape).border(1.dp, Yo.borderControl, shape).clickable(enabled = enabled, role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Txt(sign, type.h2, color = if (enabled) Yo.text else Yo.textDisabled) }
}
