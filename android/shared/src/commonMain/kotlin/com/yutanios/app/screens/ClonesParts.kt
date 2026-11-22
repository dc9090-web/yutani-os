package com.yutanios.app.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.yutanios.app.model.Implant
import com.yutanios.app.model.JumpClone
import com.yutanios.app.ui.Disclosure
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.Info
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.describable
import com.yutanios.app.ui.type

/** The ten implant slots as blocks, filled where the slot is taken. Slots fill by position, not from the left. */
@Composable
internal fun SlotStrip(slots: List<Boolean>, used: Int, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(1.dp)
    Row(modifier.semantics { contentDescription = "$used of 10 implant slots used" }, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        slots.forEach { taken ->
            Box(if (taken) Modifier.size(10.dp).background(Yo.blockFilled, shape) else Modifier.size(10.dp).border(1.dp, Yo.blockEmpty, shape))
        }
    }
}

/** `.yo-info-btn`: the circled "i"; amber on a raised tile while its panel is open. */
@Composable
private fun InfoMark(open: Boolean) {
    val color = if (open) Yo.accent else Yo.textLabel
    Box(Modifier.size(28.dp).background(if (open) Yo.surfaceControl else Color.Transparent, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(14.dp)) {
            val u = size.width / 14f
            val w = 1.3f * u
            drawCircle(color, 5.6f * u, style = Stroke(w))
            drawLine(color, Offset(7f * u, 6.4f * u), Offset(7f * u, 9.8f * u), w, StrokeCap.Round)
            drawLine(color, Offset(7f * u, 4.25f * u), Offset(7f * u, 4.35f * u), w, StrokeCap.Round)
        }
    }
}

/**
 * `.cl-implants` at phone width: one column of slot number, icon, name, info mark and the bonus in
 * teal. Tapping a row opens its description beneath it, as the site's info button does; a long
 * press opens the same text in the sheet. `openInfo` is keyed like the site's panels: scope and type.
 */
@Composable
internal fun ImplantList(implants: List<Implant>, scope: String, openInfo: SnapshotStateMap<String, Boolean>, onLongPress: (Info) -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        RowLine(color = Yo.border)
        implants.forEach { implant ->
            val id = "$scope-${implant.typeId}"
            val open = openInfo[id] == true
            val info = implant.desc?.let { Info(implant.name, it) }
            Row(
                Modifier.fillMaxWidth().heightIn(min = 44.dp)
                    .describable(info, onLongPress, onClick = info?.let { { openInfo[id] = !open } }).padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Txt(implant.slot?.toString() ?: "–", type.mono, Modifier.width(18.dp), Yo.textLabel, maxLines = 1, align = TextAlign.End)
                Tile(EveImage.icon(implant.typeId, 64), 30.dp)
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    Txt(implant.name, type.body, Modifier.weight(1f, fill = false))
                    if (info != null) InfoMark(open)
                }
                implant.bonus?.let { Txt(it, type.mono, color = Yo.good, maxLines = 1) }
            }
            if (open && implant.desc != null) {
                // `.yo-info-panel`
                val shape = RoundedCornerShape(6.dp)
                Txt(
                    implant.desc, type.meta,
                    Modifier.padding(top = 2.dp, bottom = 10.dp).fillMaxWidth().background(Yo.surfaceSunken, shape)
                        .border(1.dp, Yo.border, shape).padding(horizontal = 12.dp, vertical = 10.dp),
                    Yo.text2,
                )
            }
            RowLine()
        }
    }
}

/** `.cl-clone`: a collapsible row. Two lines on a phone: code and name, then the slot strip and its count. */
@Composable
internal fun JumpCloneRow(clone: JumpClone, open: Boolean, onToggle: () -> Unit, openInfo: SnapshotStateMap<String, Boolean>, onLongPress: (Info) -> Unit) {
    // `.cl-name`: the display face at 15px, a size the type scale has no step for.
    val nameStyle = type.h2.copy(fontSize = 15.sp)
    Disclosure(open, onToggle, header = {
        Column(Modifier.weight(1f).padding(vertical = 2.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Tag(clone.code)
                if (clone.name == null) Txt("Jump clone", nameStyle.copy(fontWeight = FontWeight.Medium), color = Yo.textMuted, maxLines = 1)
                else Txt(clone.name, nameStyle, maxLines = 2)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SlotStrip(clone.slots, clone.used)
                Txt("${clone.used} / 10 slots", type.mono, color = Yo.textMuted, maxLines = 1)
            }
        }
    }) {
        if (clone.implants.isEmpty()) Empty("No implants")
        else ImplantList(clone.implants, "jc-${clone.jumpCloneId}", openInfo, onLongPress)
    }
}
