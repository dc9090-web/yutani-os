package com.yutanios.app.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import com.yutanios.app.model.ShipDetail
import com.yutanios.app.model.StatRow
import com.yutanios.app.model.offenseNow
import com.yutanios.app.ui.Card
import com.yutanios.app.ui.Empty
import com.yutanios.app.ui.Info
import com.yutanios.app.ui.InfoSheet
import com.yutanios.app.ui.Res
import com.yutanios.app.ui.Screen
import com.yutanios.app.ui.Yo
import com.yutanios.app.ui.resource
import com.yutanios.app.ui.whenMissing

/**
 * One ship's sheet, for an owned ship or a saved fit; `path` is its API path. The order is the
 * site's at phone width: summary, key figures, the main column, then the side column beneath it.
 * `initialLaunched` overrides the drones the sheet opens with (type id to count).
 */
@Composable
fun ShipDetailScreen(path: String, onBack: () -> Unit, initialLaunched: Map<Long, Int>? = null) {
    val state = resource(path, ShipDetail.serializer()).value
    val detail = (state as? Res.Ready)?.data
    val view = detail?.view
    val control = view?.droneControl
    // Keyed on the bay, so a sync that changes what is aboard starts the selection again from the site's.
    var launched by remember(control) { mutableStateOf(initialLaunched ?: control?.opening ?: emptyMap()) }
    var selectorOpen by remember { mutableStateOf(true) }
    var info by remember { mutableStateOf<Info?>(null) }
    val showInfo: (Info) -> Unit = { info = it }

    Screen(view?.typeName ?: detail?.title ?: "Ship", perCharacter = false, back = onBack) {
        if (whenMissing(state)) return@Screen
        if (view == null) {
            item(key = "error") { Card { Empty("Could not compute this fit — the error was logged.") } }
            return@Screen
        }
        // The one sum done on the phone: what the weapons do plus what the launched drones do.
        val offense = offenseNow(view.weapons.dps, view.weapons.volley, control?.limits, launched)
        val assumedNote = view.stats.offense.note

        summary(view)
        keyFigures(view, offense)
        problems(view)
        missingSkills(view)

        modules(view, showInfo)
        ammunition(view, assumedNote, showInfo)
        consumables(view, showInfo)
        holds(view, showInfo)
        bonuses(view)
        skillGaps(view)

        fitting(view)
        defense(view)
        repairs(view)
        val cap = view.stats.capacitor
        card("capacitor") { StatCard("Capacitor", cap.headline, cap.rows, tone = cap.ok?.let { if (it) Yo.good else Yo.bad } ?: Color.Unspecified) }
        offenseCard(offense, note = if (view.ammo.isEmpty()) assumedNote else null)
        if (control != null) dronesCard(control, launched, selectorOpen, { selectorOpen = !selectorOpen }) { typeId, count -> launched = launched + (typeId to count) }
        card("targeting") { StatCard("Targeting", view.stats.targeting.headline, view.stats.targeting.rows) }
        card("navigation") { StatCard("Navigation", view.stats.navigation.headline, view.stats.navigation.rows) }
        card("value") {
            StatCard("Estimated value", view.value.totalShort, view.value.lines + StatRow("Total", view.value.total), note = view.value.unpriced)
        }
    }
    InfoSheet(info) { info = null }
}
