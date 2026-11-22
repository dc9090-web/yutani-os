package com.yutanios.app.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.Clone
import com.yutanios.app.model.CloneLocation
import com.yutanios.app.model.ClonePlace
import com.yutanios.app.model.Clones
import com.yutanios.app.model.Paths
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Info
import com.yutanios.app.ui.InfoSheet
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.Place
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.Tag
import com.yutanios.app.ui.TagTone
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.resource
import com.yutanios.app.ui.secColor
import com.yutanios.app.ui.type
import com.yutanios.app.ui.whenMissing

private fun plural(count: Int, noun: String) = "$count $noun${if (count == 1) "" else "s"}"

/** The active clone's panel, then the jump clones grouped by station, each a collapsible row. */
@Composable
fun ClonesScreen(characterId: Long) {
    val state = resource(Paths.clones(characterId), Clones.serializer()).value
    // What the reader has opened stays open while a sync rewrites the copy, but not across characters.
    val toggled = remember(characterId) { mutableStateMapOf<Long, Boolean>() }
    val openInfo = remember(characterId) { mutableStateMapOf<String, Boolean>() }
    var sheet by remember { mutableStateOf<Info?>(null) }
    Screen("Clones") {
        if (whenMissing(state)) return@Screen
        val clones = (state as Res.Ready).data
        if (!clones.synced) {
            item(key = "unsynced") { Card { Empty("Not synced yet — the clones job runs every six hours.") } }
            return@Screen
        }
        item(key = "active") { ActiveClone(clones.active, clones.home, openInfo) { sheet = it } }
        val cloneCount = clones.locations.sumOf { it.clones.size }
        item(key = "jump-head") {
            Row(Modifier.fillMaxWidth().padding(top = 28.dp), verticalAlignment = Alignment.CenterVertically) {
                Txt("Jump clones", type.h2, Modifier.weight(1f))
                if (cloneCount > 0) Txt("${plural(cloneCount, "clone")} · ${plural(clones.locations.size, "station")}", type.mono, color = Yo.textMuted)
            }
        }
        if (cloneCount == 0) {
            item(key = "jump-none") { Empty("No jump clones.") }
            return@Screen
        }
        clones.locations.forEachIndexed { locationIndex, location ->
            item(key = "loc-${location.key}") { LocationHead(location) }
            items(location.clones.size, key = { location.clones[it].jumpCloneId }) { i ->
                val clone = location.clones[i]
                val last = i == location.clones.lastIndex
                // The site opens the first clone of the first station to begin with.
                val open = toggled[clone.jumpCloneId] ?: (locationIndex == 0 && i == 0)
                Column(Modifier.cardSegment(first = i == 0, last = last)) {
                    JumpCloneRow(clone, open, { toggled[clone.jumpCloneId] = !open }, openInfo) { sheet = it }
                    if (!last) RowLine(color = Yo.border)
                }
            }
        }
    }
    InfoSheet(sheet) { sheet = null }
}

@Composable
private fun ActiveClone(active: Clone, home: ClonePlace?, openInfo: SnapshotStateMap<String, Boolean>, onLongPress: (Info) -> Unit) {
    Card {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Txt("Active clone", type.h2)
            Tag("ACTIVE", TagTone.Main)
        }
        Txt(if (active.used == 0) "No implants fitted" else "${plural(active.used, "implant")} fitted", type.meta, Modifier.padding(top = 6.dp))
        Gap(16.dp)
        Label("Home station")
        Gap(6.dp)
        if (home == null) Txt("—", type.bodyStrong) else Place(home.name, home.system?.sec, home.system?.secClass, style = type.bodyStrong)
        Gap(16.dp)
        Label("Implant slots")
        Gap(8.dp)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SlotStrip(active.slots, active.used)
            Txt("${active.used} / 10", type.mono, color = Yo.textMuted)
        }
        if (active.implants.isNotEmpty()) {
            Gap(18.dp)
            ImplantList(active.implants, "active", openInfo, onLongPress)
        }
    }
}

/** `.cl-location-head`: security and system, the clone count at the right, the full station beneath. */
@Composable
private fun LocationHead(location: CloneLocation) {
    Column(Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            location.system?.sec?.let { Txt(it, type.mono, Modifier.padding(end = 8.dp), secColor(location.system.secClass)) }
            Txt(location.title, type.h2, Modifier.weight(1f), maxLines = 2)
            Txt(plural(location.clones.size, "clone"), type.mono, Modifier.padding(start = 12.dp), Yo.textMuted)
        }
        location.station?.let { Txt(it, type.meta, Modifier.padding(top = 4.dp)) }
        Gap(10.dp)
        RowLine(color = Yo.border)
    }
}
