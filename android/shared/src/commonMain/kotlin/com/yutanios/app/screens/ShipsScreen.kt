package com.yutanios.app.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.yutanios.app.model.Paths
import com.yutanios.app.model.ShipCard
import com.yutanios.app.model.Ships
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Chevron
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.EveImage
import com.yutanios.app.ui.Gap
import com.yutanios.app.ui.Label
import com.yutanios.app.ui.Place
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.RowLine
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.Tabs
import com.yutanios.app.ui.Tile
import com.yutanios.app.ui.Txt
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.resource
import com.yutanios.app.ui.type
import com.yutanios.app.ui.whenMissing

/**
 * Fitted ships and saved fits as two tabs, one panel per ship in the order the site sends them.
 * `initialOpen` holds the keys of the cards whose Modules strip starts open.
 */
@Composable
fun ShipsScreen(characterId: Long, onOpenAsset: (Long) -> Unit, onOpenFit: (Long) -> Unit, initialTab: Int = 0, initialOpen: Set<String> = emptySet()) {
    val state by resource(Paths.ships(characterId), Ships.serializer())
    // Saved, so coming back from a saved fit's sheet lands on the Saved fits tab again.
    var tab by rememberSaveable { mutableIntStateOf(initialTab) }
    var open by remember(characterId) { mutableStateOf(initialOpen) }
    Screen("Ships") {
        if (whenMissing(state)) return@Screen
        val data = (state as Res.Ready).data
        val saved = tab == 1
        val cards = if (saved) data.fits else data.ships
        item(key = "tabs") {
            Tabs(listOf("Fitted ships  ${data.ships.size}", "Saved fits  ${data.fits.size}"), tab, { tab = it })
            Gap(20.dp)
        }
        if (!data.skillsSynced) item(key = "banner") {
            Banner("No skills synced yet — every skill is treated as level 0, so fitting numbers and missing-skill counts are worst case. The skills job runs hourly.")
            Gap(20.dp)
        }
        if (saved) item(key = "about") { Txt("Fits saved in game, and the fits you design on the site.", type.meta, Modifier.padding(bottom = 12.dp)) }
        if (cards.isEmpty()) {
            item(key = "empty") {
                Empty(if (saved) "No saved fits — the fittings job runs every 6 hours." else "No assembled ships in your assets yet — the assets job runs hourly.")
            }
            return@Screen
        }
        items(cards, key = { it.key }) { card ->
            ShipPanel(
                card, open = card.key in open,
                onToggle = { open = if (card.key in open) open - card.key else open + card.key },
                onOpen = { card.assetId?.let(onOpenAsset) ?: card.fitId?.let(onOpenFit) },
            )
            Gap(12.dp)
        }
        item(key = "foot") {
            val noun = if (saved) plural(cards.size, "saved fit") else plural(cards.size, "fitted ship")
            Txt("$noun, ordered by hull type", type.meta, Modifier.padding(top = 4.dp))
        }
    }
}

/**
 * One fitted ship or saved fit, stacked as the site stacks it on a phone: identity, the four
 * headline figures two by two, CPU and powergrid, then value, skills, mastery and the Modules button.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShipPanel(card: ShipCard, open: Boolean, onToggle: () -> Unit, onOpen: () -> Unit) {
    val stats = card.stats
    val cpu = card.cpu
    val power = card.power
    Card(Modifier.clickable(onClickLabel = "Open ${card.typeName}", onClick = onOpen)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Tile(EveImage.render(card.typeId, 128), 56.dp, radius = 6.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                val kind = listOfNotNull(card.groupName, card.raceName).joinToString(" · ")
                if (kind.isNotEmpty()) Label(kind)
                Txt(card.typeName, type.h2, maxLines = 1)
                if (card.name != null && card.name != card.typeName) Txt(card.name, type.body, color = Yo.text2, maxLines = 1)
                Place(placeName(card.location, card.system?.name), card.system?.sec, card.system?.secClass)
            }
        }
        if (cpu == null || power == null) {
            Txt(card.error ?: "Could not compute", type.meta, Modifier.padding(top = 14.dp), Yo.bad)
            return@Card
        }
        if (stats != null) {
            // "Stable 43%" / "Lasts 12m 40s": the word goes in the label, the figure in the cell.
            val capWord = stats.capOk?.let { if (it) "Stable" else "Lasts" }
            val cells = listOf(
                Triple("DPS", stats.dps, Color.Unspecified),
                Triple("EHP", stats.ehp, Color.Unspecified),
                Triple("Speed" + (stats.propKind?.let { " · $it" } ?: ""), stats.velocity, Color.Unspecified),
                Triple("Cap" + (capWord?.let { " · $it" } ?: ""), capWord?.let { stats.cap.drop(it.length + 1) } ?: stats.cap, stats.capOk?.let { if (it) Yo.good else Yo.bad } ?: Color.Unspecified),
            )
            Gap(14.dp)
            CellGrid(cells.size) { i ->
                Label(cells[i].first)
                Gap(6.dp)
                Txt(cells[i].second, type.mono14, color = cells[i].third, maxLines = 1)
            }
        }
        Gap(14.dp)
        GaugeBar(cpu)
        Gap(12.dp)
        GaugeBar(power)
        Gap(14.dp)
        RowLine(color = Yo.border)
        FlowRow(
            Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween,
            verticalArrangement = Arrangement.spacedBy(10.dp), itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            FigureUnit(card.value?.removeSuffix(" ISK") ?: "—", "ISK", type.value17, Modifier.padding(end = 16.dp))
            Flag(if (card.missingSkills > 0) "${plural(card.missingSkills, "missing skill")}" else "All skills trained", good = card.missingSkills == 0, modifier = Modifier.padding(end = 16.dp))
            Mastery(card.mastery, Modifier.padding(end = 16.dp))
            ModulesButton(card.weapons.size, open, onToggle)
        }
        if (open) {
            Gap(14.dp)
            RowLine(color = Yo.border)
            Gap(14.dp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Label("Weapons and modules")
                card.unpriced?.let { Txt(" · $it", type.meta, maxLines = 1) }
            }
            if (card.weapons.isEmpty()) Txt("No weapons or modules listed", type.meta, Modifier.padding(top = 10.dp))
            card.weapons.forEach { weapon ->
                Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Tile(EveImage.icon(weapon.typeId), 30.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Txt((if (weapon.count > 1) "${weapon.count}× " else "") + weapon.name, type.body)
                        val detail = listOfNotNull(weapon.charge, weapon.range).joinToString(" · ")
                        if (detail.isNotEmpty()) Txt(detail, type.meta)
                    }
                }
            }
        }
    }
}

/** `.sp-modules-btn`: opens the weapons and modules along the bottom of the panel. */
@Composable
private fun ModulesButton(count: Int, open: Boolean, onToggle: () -> Unit) {
    val shape = RoundedCornerShape(3.dp)
    Row(
        Modifier.clip(shape).background(if (open) Yo.surfaceOpen else Color.Transparent).border(1.dp, Yo.borderControl, shape)
            .clickable(role = Role.Button, onClick = onToggle).heightIn(min = 36.dp).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Txt("Modules $count", type.nav, color = Yo.text, maxLines = 1)
        Chevron(open)
    }
}
